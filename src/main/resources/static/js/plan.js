// DP Plan 화면 동작
// 한 화면을 두 상태로 사용한다 (Wireframe v0.2)
//   - VMD 작성 상태: 작업 지시 작성·수정, [작성 완료], [매장에 공유]
//   - 매장 직원 보기 상태: 확인만 가능. 단계 표시·상태 배지·VMD 메모·버튼 숨김
//
// [임시] Week 1에는 서버가 없어서 상태 전환을 이 파일 안에서 처리한다. (새로고침하면 처음 상태로 돌아감)
// API 단계에서는 상태 판단을 Backend(TaskService)로 옮기고, 이 파일은 받은 결과를 render()로 그리기만 한다.

const taskId = getQueryParam('taskId') || 1;
const task = findSampleTask(taskId);

// ----- 화면 요소 -----
const prototypeBar = document.getElementById('prototype-bar');
const stateBanner = document.getElementById('state-banner');
const memoRow = document.getElementById('memo-row');
const instructionInput = document.getElementById('instruction-input');
const instructionText = document.getElementById('instruction-text');
const actionBar = document.getElementById('action-bar');
const completeButton = document.getElementById('complete-button');
const shareButton = document.getElementById('share-button');

// ----- 화면 상태 -----
// status      : 작업 상태 (IN_PROGRESS / REVIEWED / SHARED)
// instruction : VMD 작업 지시 (VMD 메모와 별개)
const state = {
    status: task.status,
    instruction: task.plan.instruction
};

// 주소에 mode=view가 있으면 보기 상태로 연다 (Dashboard에서 공유 완료 작업을 열 때)
const openedAsViewMode = getQueryParam('mode') === 'view';

// [Prototype 전용] 보기 상태 미리보기 중인지
let isPreviewingViewMode = false;

// 보기 상태 조건: 공유 완료 / 주소에 mode=view / 미리보기 중
function isViewMode() {
    return state.status === 'SHARED' || openedAsViewMode || isPreviewingViewMode;
}

// ----- 바뀌지 않는 정보는 처음에 한 번만 채운다 -----
document.getElementById('plan-product-name').textContent = task.product.name;
document.getElementById('plan-product-code').textContent = task.product.code;
document.getElementById('plan-product-color').textContent = task.product.color || '-';
document.getElementById('vmd-memo').textContent = task.product.memo || '-';
document.getElementById('back-to-preview-link').href = `/preview.html?taskId=${taskId}`;
instructionInput.value = state.instruction;

// ----- 화면 그리기: state 값만 보고 화면 전체를 맞춘다 -----
function render() {
    const viewMode = isViewMode();

    // 상단: 보기 상태에서는 단계 표시와 상태 배지를 숨긴다
    if (viewMode) {
        renderHeader({ taskName: task.name, storeName: task.storeName });
    } else {
        renderHeader({
            taskName: task.name,
            storeName: task.storeName,
            status: state.status,
            currentStep: 'PLAN'
        });
    }


    // 상태 안내 띠: 상단 배지와 같은 상태를 말하도록 작업 상태에 따라 문구를 바꾼다 (10/1 결정)
    if (viewMode) {
        stateBanner.textContent = '확정된 DP Plan · 확인 전용';
    } else if (state.status === 'REVIEWED') {
        stateBanner.textContent = '검토 완료 · 공유 전 (매장 직원에게 아직 보이지 않음)';
    } else {
        stateBanner.textContent = '작성 중 · 매장 직원에게 아직 보이지 않음';
    }
    stateBanner.className = viewMode ? 'state-banner is-viewing' : 'state-banner is-editing';

    // 보기 상태에서 숨기거나 바꾸는 부분
    memoRow.hidden = viewMode;
    instructionInput.hidden = viewMode;
    instructionText.hidden = !viewMode;
    instructionText.textContent = state.instruction.trim() !== ''
        ? state.instruction
        : '(작성된 작업 지시가 없습니다)';
    actionBar.hidden = viewMode;
    prototypeBar.hidden = !isPreviewingViewMode;

    // [작성 완료]: 작업 중이고 작업 지시가 비어 있지 않을 때만
    const canComplete = state.status === 'IN_PROGRESS' && state.instruction.trim() !== '';
    completeButton.disabled = !canComplete;
    completeButton.textContent = state.status === 'IN_PROGRESS' ? '작성 완료' : '작성 완료 ✓';

    // [매장에 공유]: 검토 완료일 때만
    shareButton.disabled = state.status !== 'REVIEWED';
}

// ----- 사용자 행동 -----

// 입력하는 동안: [작성 완료] 활성 여부만 바로 반영한다
instructionInput.addEventListener('input', () => {
    state.instruction = instructionInput.value;
    render();
});

// 입력 칸에서 커서가 빠져나갈 때(내용이 바뀐 경우만) = 저장 시점 (blur 저장, Prototype 임시 방식)
// 검토 완료 상태에서 작업 지시를 고치면 작업 중으로 되돌린다 (Wireframe v0.2 결정)
instructionInput.addEventListener('change', () => {
    // [임시] API 단계: PUT /api/tasks/{id}/plan/instruction → Backend가 상태를 판단
    if (state.status === 'REVIEWED') {
        state.status = 'IN_PROGRESS';
    }
    render();
});

completeButton.addEventListener('click', () => {
    // [임시] API 단계: POST /api/tasks/{id}/plan/complete
    // 버튼이 비활성이어도 조건을 한 번 더 확인한다 (서버도 같은 방식으로 다시 검사할 예정)
    if (state.status === 'IN_PROGRESS' && state.instruction.trim() !== '') {
        state.status = 'REVIEWED';
        render();
    }
});

shareButton.addEventListener('click', () => {
    // [임시] API 단계: POST /api/tasks/{id}/plan/share
    if (state.status === 'REVIEWED') {
        state.status = 'SHARED';
        isPreviewingViewMode = false;
        render(); // 공유 완료 → 보기 상태로 바뀐다. 이후 수정 불가 (MVP 결정)
    }
});

// [Prototype 전용] 보기 상태 미리보기 켜기 / 끄기
document.getElementById('view-preview-button').addEventListener('click', () => {
    isPreviewingViewMode = true;
    render();
});

document.getElementById('back-to-edit-button').addEventListener('click', () => {
    isPreviewingViewMode = false;
    render();
});

render();