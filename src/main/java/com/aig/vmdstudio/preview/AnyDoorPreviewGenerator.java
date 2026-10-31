package com.aig.vmdstudio.preview;

import com.aig.vmdstudio.storage.ImageStorageService;
import com.aig.vmdstudio.task.Placement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.Map;

/**
 * 실제 AnyDoor로 Preview를 만드는 엔진 (10/29, D20의 Spring 쪽 연결).
 *
 * Spring은 AnyDoor를 직접 실행하지 않고, 학교 PC의 Python AI 서버(ai-server/vmd_ai_server.py)에 맡긴다.
 *   ① 매장 사진·상품 이미지·영역(0~1)을 AI 서버 POST /generate 로 보낸다
 *   ② 돌아온 결과 PNG를 uploads/ 에 preview-*.png 로 저장한다
 *   ③ 화면이 보여줄 주소(/api/previews/파일이름)를 돌려준다
 *
 * TaskService와 화면은 이 클래스를 모른다. PreviewGenerator 약속(D9)만 지키면 되므로
 * application.properties의 vmd.preview.engine 값만 바꿔 Mock ↔ AnyDoor를 오갈 수 있다.
 */
@Component
@ConditionalOnProperty(name = "vmd.preview.engine", havingValue = "anydoor")
public class AnyDoorPreviewGenerator implements PreviewGenerator {

    private static final Logger log = LoggerFactory.getLogger(AnyDoorPreviewGenerator.class);

    private final RestClient restClient;
    private final ImageStorageService imageStorage;
    private final String serverUrl;

    public AnyDoorPreviewGenerator(
            ImageStorageService imageStorage,
            @Value("${vmd.ai-server.url:http://127.0.0.1:8000}") String serverUrl,
            @Value("${vmd.ai-server.connect-timeout:3s}") Duration connectTimeout,
            @Value("${vmd.ai-server.read-timeout:5m}") Duration readTimeout) {
        this.imageStorage = imageStorage;
        this.serverUrl = serverUrl;

        // 연결은 짧게(꺼져 있으면 바로 안내), 응답 대기는 넉넉하게(fp16 적용 후 약 10초지만, VMD_FP16=0으로 되돌리면 2~5분 걸리므로 5분 유지)
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);

        this.restClient = RestClient.builder()
                .baseUrl(serverUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public String generate(PreviewRequest request) {
        Placement placement = request.placement();

        // AI 서버 /generate 의 입력 이름에 맞춘다 (FastAPI Form/File 이름과 같아야 함)
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("store_image", new FileSystemResource(request.storePhoto()));
        form.add("product_image", new FileSystemResource(request.productImage()));
        form.add("x", String.valueOf(placement.getX()));
        form.add("y", String.valueOf(placement.getY()));
        form.add("w", String.valueOf(placement.getWidth()));
        form.add("h", String.valueOf(placement.getHeight()));
        // strength·steps·scale·seed 등은 AI 서버 기본값(PoC 기준 설정, Seed 42)을 그대로 쓴다

        log.info("[AnyDoor] Preview 생성 요청 → {} (영역 x={}, y={}, w={}, h={})", serverUrl,
                placement.getX(), placement.getY(), placement.getWidth(), placement.getHeight());
        long started = System.currentTimeMillis();

        byte[] png;
        try {
            png = restClient.post()
                    .uri("/generate")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.IMAGE_PNG)
                    .body(form)
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientResponseException e) {
            // AI 서버가 응답은 했지만 실패한 경우 (409 생성 중, 400 영역 오류, 422 상품 영역 못 찾음, 503 GPU 메모리 등)
            throw new ResponseStatusException(HttpStatus.valueOf(e.getStatusCode().value()), detailOf(e), e);
        } catch (ResourceAccessException e) {
            // 응답 자체를 받지 못한 경우 (서버 꺼짐, 시간 초과)
            throw translateAccessError(e);
        }

        if (png == null || png.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 서버가 빈 결과를 돌려주었습니다.");
        }

        String fileName = imageStorage.storeGenerated(png, ".png");
        log.info("[AnyDoor] Preview 생성 완료 {}초 → {}", (System.currentTimeMillis() - started) / 1000.0, fileName);
        return "/api/previews/" + fileName;
    }

    /** FastAPI 오류 응답 {"detail": "..."} 에서 안내 문구를 꺼낸다. 읽지 못하면 기본 문구 */
    private static String detailOf(RestClientResponseException e) {
        try {
            Map<?, ?> body = e.getResponseBodyAs(Map.class);
            if (body != null && body.get("detail") instanceof String detail && !detail.isBlank()) {
                return detail;
            }
        } catch (RuntimeException ignored) {
            // JSON이 아니거나 detail이 목록(입력 검증 오류)인 경우
        }
        return "AI Preview 생성에 실패했습니다. (AI 서버 응답 " + e.getStatusCode().value() + ")";
    }

    /** 연결 실패와 생성 시간 초과를 구분해서 안내한다 */
    private ResponseStatusException translateAccessError(ResourceAccessException e) {
        Throwable cause = e.getMostSpecificCause();
        boolean cannotConnect = cause instanceof ConnectException
                || (cause instanceof SocketTimeoutException && String.valueOf(cause.getMessage()).toLowerCase().contains("connect"));

        if (cannotConnect) {
            log.warn("[AnyDoor] AI 서버에 연결할 수 없음: {} ({})", serverUrl, cause.toString());
            return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI Preview 서버에 연결할 수 없습니다. AI 서버(" + serverUrl + ")가 켜져 있는지 확인해 주세요.", e);
        }
        if (cause instanceof SocketTimeoutException) {
            log.warn("[AnyDoor] 생성 시간 초과: {}", cause.toString());
            return new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,
                    "AI Preview 생성 시간이 너무 오래 걸려 중단했습니다. AI 서버 터미널을 확인해 주세요.", e);
        }
        log.warn("[AnyDoor] AI 서버 통신 오류: {}", cause.toString());
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "AI 서버와 통신 중 오류가 발생했습니다: " + cause.getMessage(), e);
    }
}
