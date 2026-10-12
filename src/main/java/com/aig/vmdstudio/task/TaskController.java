package com.aig.vmdstudio.task;

import com.aig.vmdstudio.storage.ImageStorageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
