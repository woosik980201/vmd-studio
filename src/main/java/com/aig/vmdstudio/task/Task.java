package com.aig.vmdstudio.task;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * DP 작업 1건.
 * MVP 기준: 1 Task = 매장 사진 1 + 변경 영역 1 + 상품 1 (기능 명세 v0.2)
 *
 * 화면에서 쓰던 sample-data.js의 구조를 그대로 DB 칸으로 옮겼다.
 *  - vmdMemo     : VMD 메모 (Store Setup, 내부 참고용, 직원 보기에서 숨김)
 *  - instruction : VMD 작업 지시 (DP Plan, 매장 직원 전달용)
 *  두 값은 역할이 달라서 처음부터 다른 칸에 저장한다.
 */
@Entity
@Table(name = "dp_task")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ----- 작업 정보 -----
    private String name;
    private String storeName;

    @Enumerated(EnumType.STRING)
    private TaskStatus status;

    @Enumerated(EnumType.STRING)
    private TaskStep step;

    // ----- 적용 상품 -----
    private String productName;
    private String productCode;
    private String productColor;

    @Column(length = 1000)
    private String vmdMemo;

    // ----- 이미지: 파일 자체는 업로드 폴더에, DB에는 파일 이름만 저장한다 -----
    private String storePhotoFile;
    private String productImageFile;

    // ----- 변경 영역 -----
    @Embedded
    private Placement placement;

    // ----- AI Preview -----
    // Mock 단계에서는 고정 이미지 주소, AnyDoor 단계에서는 생성된 이미지 파일을 가리킨다
    private String previewImageUrl;
    private boolean previewAdopted;

    // ----- DP Plan -----
    @Column(length = 2000)
    private String instruction;

    private LocalDateTime updatedAt;

    protected Task() {
        // JPA가 사용하는 기본 생성자
    }

    /** 새 작업은 항상 '작업 중' 상태로 시작한다 */
    public Task(String name, String storeName,
                String productName, String productCode, String productColor, String vmdMemo) {
        this.name = name;
        this.storeName = storeName;
        this.productName = productName;
        this.productCode = productCode;
        this.productColor = productColor;
        this.vmdMemo = vmdMemo;
        this.status = TaskStatus.IN_PROGRESS;
        this.step = TaskStep.SETUP;
        this.instruction = "";
    }

    /** 저장·수정될 때마다 수정일을 자동으로 기록한다 */
    @PrePersist
    @PreUpdate
    void touchUpdatedAt() {
        this.updatedAt = LocalDateTime.now();
    }

    // ----- Store Setup -----

    /** 등록 정보(글자) 수정. 공유 완료 작업은 수정할 수 없다 (MVP 결정) */
    public void updateSetupInfo(String name, String storeName,
                                String productName, String productCode, String productColor, String vmdMemo) {
        requireNotShared();
        this.name = name;
        this.storeName = storeName;
        this.productName = productName;
        this.productCode = productCode;
        this.productColor = productColor;
        this.vmdMemo = vmdMemo;
    }

    /**
     * 매장 사진 교체.
     * 사진이 바뀌면 이전 Preview는 다른 사진으로 만든 결과가 되므로 지운다.
     */
    public void replaceStorePhoto(String fileName) {
        requireNotShared();
        this.storePhotoFile = fileName;
        clearPreview();
    }

    /** 상품 이미지 교체. 같은 이유로 이전 Preview를 지운다 */
    public void replaceProductImage(String fileName) {
        requireNotShared();
        this.productImageFile = fileName;
        clearPreview();
    }

    /** 등록을 마치면 다음 단계(영역 지정)로. 이미 더 뒤 단계에 있었다면 그대로 둔다 */
    public void finishSetup() {
        if (this.step == TaskStep.SETUP) {
            this.step = TaskStep.EDITOR;
        }
    }

    // ----- DP Editor -----

    /**
     * 변경 영역 저장 (1 Task = 영역 1개이므로 항상 덮어쓴다).
     * 영역이 바뀌면 이전 Preview는 다른 영역으로 만든 결과이므로 지운다.
     */
    public void updatePlacement(Placement newPlacement) {
        requireNotShared();
        if (newPlacement == null || !newPlacement.hasValidRange()) {
            throw new IllegalArgumentException("영역 값이 올바르지 않습니다. (0~1 비율, 사진 안쪽)");
        }
        if (!newPlacement.sameAs(this.placement)) {
            clearPreview();
        }
        this.placement = newPlacement;
    }

    // ----- AI Preview -----

    /** Preview 결과 기록. 새로 만든 Preview는 아직 채택되지 않은 상태다 */
    public void applyPreview(String imageUrl) {
        requireNotShared();
        if (!hasImages() || placement == null) {
            throw new IllegalStateException("매장 사진, 상품 이미지, 영역이 모두 있어야 Preview를 만들 수 있습니다.");
        }
        this.previewImageUrl = imageUrl;
        this.previewAdopted = false;
        if (this.step == TaskStep.SETUP || this.step == TaskStep.EDITOR) {
            this.step = TaskStep.PREVIEW;
        }
    }

    /**
     * VMD의 명시적 채택. DP Plan으로 가는 유일한 길 (Wireframe v0.2, Human-in-the-loop).
     * Preview가 만들어졌다고 자동으로 채택되지 않는다.
     */
    public void adoptPreview() {
        requireNotShared();
        if (this.previewImageUrl == null) {
            throw new IllegalStateException("채택할 Preview가 없습니다. 먼저 Preview를 생성해 주세요.");
        }
        this.previewAdopted = true;
        this.step = TaskStep.PLAN;
    }

    // ----- DP Plan: 상태 전환 규칙 (Week 1에는 plan.js 안에 있던 규칙을 서버로 옮김) -----

    /**
     * 작업 지시 저장.
     * 검토 완료 상태에서 작업 지시를 고치면 다시 '작업 중'으로 되돌린다 (Wireframe v0.2 결정)
     */
    public void updateInstruction(String text) {
        requireNotShared();
        requireAdopted();
        this.instruction = text == null ? "" : text;
        if (this.status == TaskStatus.REVIEWED) {
            this.status = TaskStatus.IN_PROGRESS;
        }
    }

    /** 작성 완료: 작업 중이고 작업 지시가 비어 있지 않을 때만 → 검토 완료 */
    public void completePlan() {
        requireAdopted();
        if (this.status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("작업 중 상태에서만 작성 완료할 수 있습니다.");
        }
        if (this.instruction == null || this.instruction.isBlank()) {
            throw new IllegalStateException("작업 지시를 입력해야 작성 완료할 수 있습니다.");
        }
        this.status = TaskStatus.REVIEWED;
    }

    /** 매장에 공유: 검토 완료일 때만 → 공유 완료. 이후에는 수정할 수 없다 (MVP 결정) */
    public void sharePlan() {
        if (this.status != TaskStatus.REVIEWED) {
            throw new IllegalStateException("검토 완료 상태에서만 매장에 공유할 수 있습니다.");
        }
        this.status = TaskStatus.SHARED;
    }

    /** DP Plan은 VMD가 채택한 Preview가 있어야 작성할 수 있다 */
    private void requireAdopted() {
        if (!this.previewAdopted) {
            throw new IllegalStateException("채택한 Preview가 있어야 DP Plan을 작성할 수 있습니다.");
        }
    }

    public boolean hasImages() {
        return storePhotoFile != null && productImageFile != null;
    }

    private void clearPreview() {
        this.previewImageUrl = null;
        this.previewAdopted = false;
    }

    /** 공유 완료 작업을 고치려 하면 오류 (Service에서 409 응답으로 바꾼다) */
    private void requireNotShared() {
        if (this.status == TaskStatus.SHARED) {
            throw new IllegalStateException("공유 완료된 작업은 수정할 수 없습니다.");
        }
    }

    // ----- 예시 데이터(DataInitializer) 전용 -----
    // DP Plan 단계까지 진행된 예시 작업은 '채택까지 마친 상태'로 본다 (이미지는 없음)
    void setStatusAndStepForSample(TaskStatus status, TaskStep step, String instruction) {
        this.status = status;
        this.step = step;
        this.instruction = instruction;
        this.previewAdopted = (step == TaskStep.PLAN);
    }

    // ----- getter -----
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getStoreName() { return storeName; }
    public TaskStatus getStatus() { return status; }
    public TaskStep getStep() { return step; }
    public String getProductName() { return productName; }
    public String getProductCode() { return productCode; }
    public String getProductColor() { return productColor; }
    public String getVmdMemo() { return vmdMemo; }
    public String getStorePhotoFile() { return storePhotoFile; }
    public String getProductImageFile() { return productImageFile; }
    public Placement getPlacement() { return placement; }
    public String getPreviewImageUrl() { return previewImageUrl; }
    public boolean isPreviewAdopted() { return previewAdopted; }
    public String getInstruction() { return instruction; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
