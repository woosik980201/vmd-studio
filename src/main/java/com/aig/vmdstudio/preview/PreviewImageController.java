package com.aig.vmdstudio.preview;

import com.aig.vmdstudio.storage.ImageStorageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.regex.Pattern;

/**
 * AnyDoor가 만든 Preview 이미지를 화면에 보여주는 주소: GET /api/previews/{파일이름}
 *
 * 매장 사진·상품 이미지는 작업 번호로 찾지만(/api/tasks/{id}/images/...),
 * Preview는 PreviewGenerator가 '이미지 주소'를 돌려주는 약속(D9)이라 파일 이름으로 바로 찾는다.
 * 업로드 폴더의 다른 파일을 이름으로 꺼내 가지 못하도록 preview-*.png 모양만 허용한다.
 */
@RestController
public class PreviewImageController {

    private static final Pattern PREVIEW_FILE = Pattern.compile("preview-[0-9a-f\\-]{36}\\.png");

    private final ImageStorageService imageStorage;

    public PreviewImageController(ImageStorageService imageStorage) {
        this.imageStorage = imageStorage;
    }

    @GetMapping("/api/previews/{fileName:.+}")
    public ResponseEntity<Resource> preview(@PathVariable String fileName) {
        if (!PREVIEW_FILE.matcher(fileName).matches()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다.");
        }
        return ResponseEntity.ok()
                .contentType(imageStorage.mediaTypeOf(fileName))
                .body(imageStorage.load(fileName));
    }
}
