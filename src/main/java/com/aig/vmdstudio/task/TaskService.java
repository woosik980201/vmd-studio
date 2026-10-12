package com.aig.vmdstudio.task;

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

    private final TaskRepository taskRepository;
    private final ImageStorageService imageStorage;

    public TaskService(TaskRepository taskRepository, ImageStorageService imageStorage) {
        this.taskRepository = taskRepository;
        this.imageStorage = imageStorage;
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
