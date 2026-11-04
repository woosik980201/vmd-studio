package com.aig.vmdstudio.task;

import com.aig.vmdstudio.storage.ImageStorageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 화면에서 보내는 /api/tasks 요청을 받는 곳.
 * 결과는 TaskResponse 모양의 JSON으로 돌려준다.
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final ImageStorageService imageStorage;

    public TaskController(TaskService taskService, ImageStorageService imageStorage) {
        this.taskService = taskService;
        this.imageStorage = imageStorage;
    }

    /** Dashboard: 작업 목록 */
    @GetMapping
    public List<TaskResponse> list() {
        return taskService.findAll().stream()
                .map(TaskResponse::from)
                .toList();
    }

    /** 각 화면: 작업 1건 */
    @GetMapping("/{id}")
    public TaskResponse get(@PathVariable Long id) {
        return TaskResponse.from(taskService.findById(id));
    }

    /** Dashboard: 작업 삭제 (사진·Preview 파일 포함, 되돌릴 수 없음) */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        taskService.delete(id);
    }

    /**
     * Store Setup: 새 작업 만들기.
     * 글자와 이미지 파일을 함께 보내야 하므로 JSON이 아니라 multipart/form-data로 받는다.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@ModelAttribute SetupForm form,
                               @RequestParam(required = false) MultipartFile storePhoto,
                               @RequestParam(required = false) MultipartFile productImage) {
        return TaskResponse.from(taskService.create(form.trimmed(), storePhoto, productImage));
    }

    /** Store Setup: 기존 작업 수정 (이미지는 새로 고른 것만 교체) */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TaskResponse update(@PathVariable Long id,
                               @ModelAttribute SetupForm form,
                               @RequestParam(required = false) MultipartFile storePhoto,
                               @RequestParam(required = false) MultipartFile productImage) {
        return TaskResponse.from(taskService.update(id, form.trimmed(), storePhoto, productImage));
    }

    /** DP Editor: 변경 영역 저장 (JSON, 0~1 비율) */
    @PutMapping("/{id}/placement")
    public TaskResponse updatePlacement(@PathVariable Long id, @RequestBody PlacementRequest request) {
        return TaskResponse.from(taskService.updatePlacement(id, request.toPlacement()));
    }

    /** AI Preview 생성 (vmd.preview.engine에 따라 Mock 또는 AnyDoor. AnyDoor는 fp16 적용 후 약 10초, 10/31) */
    @PostMapping("/{id}/preview")
    public TaskResponse generatePreview(@PathVariable Long id) {
        return TaskResponse.from(taskService.generatePreview(id));
    }

    /** AI Preview 채택 → DP Plan 작성 가능 */
    @PostMapping("/{id}/preview/adopt")
    public TaskResponse adoptPreview(@PathVariable Long id) {
        return TaskResponse.from(taskService.adoptPreview(id));
    }

    /** DP Plan: 작업 지시 저장 */
    @PutMapping("/{id}/plan/instruction")
    public TaskResponse updateInstruction(@PathVariable Long id, @RequestBody InstructionRequest request) {
        return TaskResponse.from(taskService.updateInstruction(id, request.instruction()));
    }

    /** DP Plan: 작성 완료 (작업 중 → 검토 완료) */
    @PostMapping("/{id}/plan/complete")
    public TaskResponse completePlan(@PathVariable Long id) {
        return TaskResponse.from(taskService.completePlan(id));
    }

    /** DP Plan: 매장에 공유 (검토 완료 → 공유 완료) */
    @PostMapping("/{id}/plan/share")
    public TaskResponse sharePlan(@PathVariable Long id) {
        return TaskResponse.from(taskService.sharePlan(id));
    }

    /** DP Plan: 공유 취소 (공유 완료 → 작업 중, 다시 수정 가능) */
    @PostMapping("/{id}/plan/unshare")
    public TaskResponse unsharePlan(@PathVariable Long id) {
        return TaskResponse.from(taskService.unsharePlan(id));
    }

    /**
     * 저장된 이미지 보여주기. kind: store-photo(매장 사진) / product(실제 상품 이미지)
     * 화면의 img 태그가 이 주소를 그대로 사용한다.
     */
    @GetMapping("/{id}/images/{kind}")
    public ResponseEntity<Resource> image(@PathVariable Long id, @PathVariable String kind) {
        Task task = taskService.findById(id);
        String fileName = switch (kind) {
            case "store-photo" -> task.getStorePhotoFile();
            case "product" -> task.getProductImageFile();
            default -> null;
        };
        if (fileName == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다.");
        }
        return ResponseEntity.ok()
                .contentType(imageStorage.mediaTypeOf(fileName))
                .body(imageStorage.load(fileName));
    }
}
