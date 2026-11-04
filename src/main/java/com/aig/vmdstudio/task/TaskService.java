package com.aig.vmdstudio.task;

import com.aig.vmdstudio.preview.PreviewGenerator;
import com.aig.vmdstudio.preview.PreviewRequest;
import com.aig.vmdstudio.storage.ImageStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 작업에 관한 규칙을 처리하는 곳.
 * Controller는 요청을 받고 응답만 하고, '무엇을 해도 되는지' 판단은 여기서 한다.
 */
@Service
@Transactional(readOnly = true)
public class TaskService {

    // AnyDoor 결과만 파일로 저장된다. Mock 예시 이미지(/mock/...)는 지우지 않는다
    private static final String PREVIEW_URL_PREFIX = "/api/previews/";

    private final TaskRepository taskRepository;
    private final ImageStorageService imageStorage;
    private final PreviewGenerator previewGenerator; // 지금은 MockPreviewGenerator가 들어온다

    public TaskService(TaskRepository taskRepository, ImageStorageService imageStorage,
                       PreviewGenerator previewGenerator) {
        this.taskRepository = taskRepository;
        this.imageStorage = imageStorage;
        this.previewGenerator = previewGenerator;
    }

    public List<Task> findAll() {
        return taskRepository.findAllByOrderByUpdatedAtDesc();
    }

    /** 없는 작업 번호면 404를 돌려준다 */
    public Task findById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "작업을 찾을 수 없습니다: " + id));
    }

    /**
     * Store Setup: 새 작업 만들기.
     * [다음] 활성 조건과 같은 규칙을 서버에서도 한 번 더 확인한다 (화면만 믿지 않기 위해)
     *   → 매장 사진 + 실제 상품 이미지 + 상품명 + 품번
     */
    @Transactional
    public Task create(SetupForm form, MultipartFile storePhoto, MultipartFile productImage) {
        requireText(form.productName(), "상품명");
        requireText(form.productCode(), "품번");
        requireFile(storePhoto, "현재 매장 사진");
        requireFile(productImage, "실제 상품 이미지");

        Task task = new Task(form.name(), form.storeName(),
                form.productName(), form.productCode(), form.productColor(), form.vmdMemo());
        task.replaceStorePhoto(imageStorage.store(storePhoto));
        task.replaceProductImage(imageStorage.store(productImage));
        task.finishSetup();
        return taskRepository.save(task);
    }

    /**
     * Store Setup: 기존 작업 수정.
     * 이미지는 새로 고른 경우에만 바꾸고, 고르지 않으면 이전 이미지를 그대로 쓴다.
     */
    @Transactional
    public Task update(Long id, SetupForm form, MultipartFile storePhoto, MultipartFile productImage) {
        requireText(form.productName(), "상품명");
        requireText(form.productCode(), "품번");

        Task task = findById(id);
        task.updateSetupInfo(form.name(), form.storeName(),
                form.productName(), form.productCode(), form.productColor(), form.vmdMemo());

        if (hasFile(storePhoto)) {
            task.replaceStorePhoto(imageStorage.store(storePhoto));
        }
        if (hasFile(productImage)) {
            task.replaceProductImage(imageStorage.store(productImage));
        }
        if (!task.hasImages()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 매장 사진과 실제 상품 이미지가 모두 필요합니다.");
        }
        task.finishSetup();
        return task; // @Transactional 안에서 바뀐 값은 끝날 때 자동으로 DB에 반영된다
    }

    /**
     * Dashboard: 작업 삭제 (D26). 되돌릴 수 없으므로 확인은 화면에서 받는다.
     * 공유 완료 작업도 지울 수 있다 (화면에서 직원 화면도 사라진다고 안내).
     * DB에서 먼저 지운 뒤 이 작업의 사진과 현재 Preview 파일을 지운다.
     */
    @Transactional
    public void delete(Long id) {
        Task task = findById(id);
        String storePhoto = task.getStorePhotoFile();
        String productImage = task.getProductImageFile();
        String previewUrl = task.getPreviewImageUrl();

        taskRepository.delete(task);
        taskRepository.flush();

        imageStorage.deleteQuietly(storePhoto);
        imageStorage.deleteQuietly(productImage);
        if (previewUrl != null && previewUrl.startsWith(PREVIEW_URL_PREFIX)) {
            imageStorage.deleteQuietly(previewUrl.substring(PREVIEW_URL_PREFIX.length()));
        }
    }

    /** DP Editor: 변경 영역 저장 */
    @Transactional
    public Task updatePlacement(Long id, Placement placement) {
        Task task = findById(id);
        task.updatePlacement(placement);
        return task;
    }

    /**
     * AI Preview 생성.
     * 저장된 매장 사진·상품 이미지·영역을 Preview 엔진에 넘기고, 결과 이미지 주소를 기록한다.
     * 어떤 엔진(Mock / AnyDoor)이 쓰이는지 이 메서드는 모른다.
     */
    @Transactional
    public Task generatePreview(Long id) {
        Task task = findById(id);
        if (!task.hasImages() || task.getPlacement() == null) {
            throw new IllegalStateException("매장 사진, 상품 이미지, 영역이 모두 있어야 Preview를 만들 수 있습니다.");
        }

        PreviewRequest request = new PreviewRequest(
                imageStorage.pathOf(task.getStorePhotoFile()),
                imageStorage.pathOf(task.getProductImageFile()),
                task.getPlacement()
        );
        task.applyPreview(previewGenerator.generate(request));
        return task;
    }

    /** AI Preview: VMD의 명시적 채택 */
    @Transactional
    public Task adoptPreview(Long id) {
        Task task = findById(id);
        task.adoptPreview();
        return task;
    }

    /** DP Plan: 작업 지시 저장 (검토 완료 상태였다면 작업 중으로 되돌아감) */
    @Transactional
    public Task updateInstruction(Long id, String instruction) {
        Task task = findById(id);
        task.updateInstruction(instruction);
        return task;
    }

    /** DP Plan: 작성 완료 → 검토 완료 */
    @Transactional
    public Task completePlan(Long id) {
        Task task = findById(id);
        task.completePlan();
        return task;
    }

    /** DP Plan: 매장에 공유 → 공유 완료 */
    @Transactional
    public Task sharePlan(Long id) {
        Task task = findById(id);
        task.sharePlan();
        return task;
    }

    /** DP Plan: 공유 취소 → 작업 중 (다시 수정 가능) */
    @Transactional
    public Task unsharePlan(Long id) {
        Task task = findById(id);
        task.unsharePlan();
        return task;
    }

    // ----- 입력 확인 -----

    private static boolean hasFile(MultipartFile file) {
        return file != null && !file.isEmpty();
    }

    private static void requireFile(MultipartFile file, String label) {
        if (!hasFile(file)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + "을(를) 선택해 주세요.");
        }
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + "을(를) 입력해 주세요.");
        }
    }
}
