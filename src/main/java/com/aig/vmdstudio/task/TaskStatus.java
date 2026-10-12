package com.aig.vmdstudio.task;

/**
 * 작업 상태. AI 처리 여부가 아니라 실제 업무 진행을 나타낸다 (기능 명세 v0.2).
 * 화면의 common.js STATUS_LABELS와 같은 값을 사용한다.
 */
public enum TaskStatus {
    IN_PROGRESS, // 작업 중
    REVIEWED,    // 검토 완료 (공유 전, 매장 직원에게 보이지 않음)
    SHARED       // 공유 완료 (매장 직원 확인 가능, 수정 불가)
}
