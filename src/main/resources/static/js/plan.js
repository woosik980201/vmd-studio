// DP Plan 화면 동작
// 한 화면을 두 상태로 사용한다 (Wireframe v0.2)
//   - VMD 작성 상태: 작업 지시 작성·수정, [작성 완료], [매장에 공유]
//   - 매장 직원 보기 상태: 확인만 가능. 단계 표시·상태 배지·VMD 메모·버튼 숨김
//
// Week 2: 작업 지시 저장·작성 완료·공유를 서버에 요청한다.
// 상태를 바꿀지 판단하는 규칙은 서버(Task.java)에 있고, 이 파일은 서버가 돌려준 결과를 render()로 그리기만 한다.

const taskId = requireTaskId();
let task = null; // init()에서 서버 데이터로 채운다

// ----- 화면 요소 -----
const prototypeBar = document.getElementById('prototype-bar');
const stateBanner = document.getElementById('state-banner');
const memoRow = document.getElementById('memo-row');
const instructionInput = document.getElementById('instruction-input');
const instructionText = document.getElementById('instruction-text');
const actionBar = document.getElementById('action-bar');
const completeButton = document.getElementById('complete-button');
const shareButton = document.getElementById('share-button');
const saveStatus = document.getElementById('save-status');
const backToPreviewLink = document.getElementById('back-to-preview-link');
const ownerBar = document.getElementById('owner-bar');
const unshareButton = document.getElementById('unshare-button');

// ----- 화면 상태 -----
// status      : 작업 상태 (IN_PROGRESS / REVIEWED / SHARED)
// instruction : VMD 작업 지시 (VMD 메모와 별개)
const state = {
    status: 'IN_PROGRESS',
    instruction: ''
};

// ----- 작업 지시 저장 상태 (A안) -----
// 'clean'  : 서버와 같음 (아무것도 표시하지 않음)
// 'dirty'  : 화면에서 고쳤지만 아직 서버에 저장되지 않음
// 'saving' : 저장 요청을 보내는 중
// 'saved'  : 방금 저장 성공
// 'failed' : 저장 실패 (다시 시도 필요)
let saveState = 'clean';

// 화면의 작업 지시가 서버에 저장된 값과 다른지
function hasUnsavedChanges() {
    return task !== null && state.instruction !== (task.plan.instruction || '');
}

// 주소에 mode=view가 있으면 보기 상태로 연다 (Dashboard에서 공유 완료 작업을 열 때)
const openedAsViewMode = getQueryParam('mode') === 'view';

// [Prototype 전용] 보기 상태 미리보기 중인지
let isPreviewingViewMode = false;

// 보기 상태 조건: 공유 완료 / 주소에 mode=view / 미리보기 중
function isViewMode() {
    return state.status === 'SHARED' || openedAsViewMode || isPreviewingViewMode;
}


// ----- 화면 그리기: state 값만 보고 화면 전체를 맞춘다 -----
function render() {
    const viewMode = isViewMode();

    // 상단: 보기 상태에서는 단계 표시와 상태 배지를 숨긴다
    if (viewMode) {
        // 매장 직원 화면(직원용 주소 / 직원 보기 미리보기)에서는 로고를 눌러도 VMD Dashboard로 가지 않는다
        // VMD가 연 공유 완료 화면은 로고 링크 유지 (+ 띠의 [← 대시보드로])
        const isStaffScreen = openedAsViewMode || isPreviewingViewMode;
        renderHeader({ taskName: task.name, storeName: task.storeName, brandLink: !isStaffScreen });
    } else {
        renderHeader({
            taskName: task.name,
            storeName: task.storeName,
            status: state.status,
            currentStep: 'PLAN'
        });
    }


    // 상태 안내 띠: 상단 배지와 같은 상태를 말하도록 작업 상태에 따라 문구를 바꾼다 (10/1 결정)
    // 채택한 Preview가 없으면(영역·이미지를 바꿔 채택이 풀린 경우) 작성·공유를 진행할 수 없다
    const isAdopted = task.preview.adopted;

    if (viewMode) {
        stateBanner.textContent = '확정된 DP Plan · 확인 전용';
    } else if (!isAdopted) {
        stateBanner.textContent = '채택한 Preview가 없습니다 · 영역이나 이미지가 바뀌었다면 Preview 화면에서 다시 채택해 주세요';
    } else if (state.status === 'REVIEWED') {
        stateBanner.textContent = '검토 완료 · 공유 전 (매장 직원에게 아직 보이지 않음)';
    } else {
        stateBanner.textContent = '작성 중 · 매장 직원에게 아직 보이지 않음';
    }
    stateBanner.className = viewMode ? 'state-banner is-viewing' : 'state-banner is-editing';

    // 보기 상태에서 숨기거나 바꾸는 부분
    memoRow.hidden = viewMode;
    instructionInput.hidden = viewMode;
    instructionInput.disabled = !isAdopted; // 채택이 풀린 상태에서는 서버가 저장을 거부하므로 입력도 막는다
    instructionText.hidden = !viewMode;
    instructionText.textContent = state.instruction.trim() !== ''
        ? state.instruction
        : '(작성된 작업 지시가 없습니다)';
    actionBar.hidden = viewMode;
    prototypeBar.hidden = !isPreviewingViewMode;

    // [공유 취소하고 수정]: VMD가 공유 완료 작업을 열었을 때만 보인다
    // 직원용 주소(mode=view)나 미리보기 중에는 숨긴다 → 직원 화면에는 수정 관련 버튼이 하나도 없다
    ownerBar.hidden = !(state.status === 'SHARED' && !openedAsViewMode && !isPreviewingViewMode);
    unshareButton.disabled = false;

    // [작성 완료]: 채택한 Preview가 있고, 작업 중이고, 작업 지시가 비어 있지 않을 때만
    const canComplete = isAdopted && state.status === 'IN_PROGRESS' && state.instruction.trim() !== '';
    completeButton.disabled = !canComplete;
    completeButton.textContent = state.status === 'IN_PROGRESS' ? '작성 완료' : '작성 완료 ✓';

    // [매장에 공유]: 채택한 Preview가 있고 검토 완료일 때만
    shareButton.disabled = !isAdopted || state.status !== 'REVIEWED';

    renderSaveStatus();
}

// 저장 상태 표시를 그린다. 보기 상태에서는 입력 칸이 없으므로 숨긴다
function renderSaveStatus() {
    saveStatus.hidden = isViewMode();
    saveStatus.className = `save-status is-${saveState}`;

    const messages = {
        clean: '',
        dirty: '● 저장되지 않은 변경 있음 · 입력 칸 바깥을 클릭하면 저장됩니다',
        saving: '저장 중...',
        saved: '✓ 저장됨',
        failed: '저장 실패 · '
    };
    saveStatus.textContent = messages[saveState];

    // 실패했을 때는 같은 내용으로 다시 보낼 수 있는 버튼을 붙인다
    // (내용이 그대로면 입력 칸의 change 이벤트가 다시 일어나지 않기 때문)
    if (saveState === 'failed') {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'link-button';
        retryButton.textContent = '다시 시도';
        retryButton.addEventListener('click', () => {
            saveInstruction().catch(() => {});
        });
        saveStatus.appendChild(retryButton);
    }
}

// ----- 사용자 행동 -----

// 서버 요청을 '보낸 순서대로' 하나씩 처리한다.
// 예: 작업 지시를 입력하고 바로 [작성 완료]를 누르면 '저장 → 작성 완료' 두 요청이 거의 동시에 나간다.
//     순서가 뒤바뀌면 서버가 "작업 지시가 비어 있음"으로 판단할 수 있어서, 앞 요청이 끝난 뒤 다음 요청을 보낸다.
let requestQueue = Promise.resolve();
function runInOrder(job) {
    requestQueue = requestQueue.then(job, job);
    return requestQueue;
}

// 서버가 돌려준 작업으로 화면 상태를 맞춘다 (상태 판단은 서버가 이미 했음)
function applyServerTask(savedTask) {
    task = savedTask;
    state.status = savedTask.status;
    render();
}

// 서버에 저장된 작업 지시와 다를 때만 저장 요청을 보낸다
function saveInstruction() {
    return runInOrder(async () => {
        if (!hasUnsavedChanges()) {
            return;
        }
        saveState = 'saving';
        renderSaveStatus();
        try {
            const savedTask = await apiRequest(`/api/tasks/${taskId}/plan/instruction`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instruction: state.instruction })
            });
            applyServerTask(savedTask);
            // 저장하는 사이에 더 입력했다면 아직 '저장 안 됨'이다
            saveState = hasUnsavedChanges() ? 'dirty' : 'saved';
        } catch (error) {
            saveState = 'failed';
            throw error;
        } finally {
            renderSaveStatus();
        }
    });
}

// 입력하는 동안: [작성 완료] 활성 여부와 '저장되지 않은 변경' 표시만 바로 반영한다 (저장은 아직 안 함)
instructionInput.addEventListener('input', () => {
    state.instruction = instructionInput.value;
    if (hasUnsavedChanges()) {
        saveState = 'dirty';
    } else if (saveState === 'dirty') {
        saveState = 'clean'; // 고쳤다가 원래대로 되돌린 경우
    }
    render();
});

// 입력 칸에서 커서가 빠져나갈 때(내용이 바뀐 경우만) = 저장 시점 (blur 저장 유지, 10/12 결정)
// 검토 완료 상태에서 고치면 서버가 '작업 중'으로 되돌린다 (Wireframe v0.2 결정)
// 실패하면 알림창 대신 입력 칸 아래에 '저장 실패 · 다시 시도'를 보여준다
instructionInput.addEventListener('change', () => {
    saveInstruction().catch(() => {});
});

// [← Preview로]: 저장 중이거나 저장 안 된 내용이 있으면 먼저 저장한 뒤 이동한다
backToPreviewLink.addEventListener('click', event => {
    event.preventDefault();
    const target = backToPreviewLink.href;
    // saveInstruction은 대기열 맨 뒤에 붙으므로, 앞서 보낸 저장 요청까지 모두 끝난 뒤에 이동한다
    saveInstruction()
        .then(() => { window.location.href = target; })
        .catch(() => {
            // 저장에 실패하면 이동하지 않고 화면에 남는다 (입력 칸 아래 '저장 실패' 표시)
        });
});

// 새로고침·탭 닫기·다른 주소로 이동할 때 저장되지 않은 내용이 있으면 브라우저가 확인창을 띄운다
window.addEventListener('beforeunload', event => {
    if (hasUnsavedChanges() || saveState === 'saving') {
        event.preventDefault();
        event.returnValue = ''; // 일부 브라우저는 이 값이 있어야 확인창을 띄운다
    }
});

// [작성 완료]: 작업 지시를 먼저 저장한 뒤 작성 완료를 요청한다
completeButton.addEventListener('click', () => {
    completeButton.disabled = true;
    saveInstruction()
        .then(() => runInOrder(async () => {
            applyServerTask(await apiRequest(`/api/tasks/${taskId}/plan/complete`, { method: 'POST' }));
        }))
        .catch(error => {
            showError(error);
            render();
        });
});

// [공유 취소하고 수정]: 확인 후 서버에 공유 취소를 요청한다 (10/12 결정, A안)
// 성공하면 서버가 '작업 중'으로 돌려주므로 render()가 자동으로 작성 상태 화면을 그린다
unshareButton.addEventListener('click', () => {
    const ok = window.confirm(
        '공유를 취소하면 매장 직원 화면에서 이 DP Plan이 내려갑니다.\n' +
        '수정한 뒤 [작성 완료] → [매장에 공유]를 다시 눌러야 직원에게 보입니다.\n\n공유를 취소할까요?'
    );
    if (!ok) {
        return;
    }
    unshareButton.disabled = true;
    runInOrder(async () => {
        applyServerTask(await apiRequest(`/api/tasks/${taskId}/plan/unshare`, { method: 'POST' }));
        saveState = 'clean';
        renderSaveStatus();
    }).catch(error => {
        showError(error);
        render();
    });
});

// [매장에 공유]: 공유 완료가 되면 보기 상태로 바뀐다. 다시 고치려면 [공유 취소하고 수정] (10/12)
shareButton.addEventListener('click', () => {
    shareButton.disabled = true;
    runInOrder(async () => {
        isPreviewingViewMode = false;
        applyServerTask(await apiRequest(`/api/tasks/${taskId}/plan/share`, { method: 'POST' }));
    }).catch(error => {
        showError(error);
        render();
    });
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

// ----- 서버에서 작업을 받아 화면을 채운다 -----
async function init() {
    task = await fetchTask(taskId);
    state.status = task.status;
    state.instruction = task.plan.instruction || '';

    // 바뀌지 않는 정보는 처음에 한 번만 채운다
    document.getElementById('plan-product-name').textContent = task.product.name;
    document.getElementById('plan-product-code').textContent = task.product.code;
    document.getElementById('plan-product-color').textContent = task.product.color || '-';
    document.getElementById('vmd-memo').textContent = task.product.memo || '-';
    backToPreviewLink.href = `/preview.html?taskId=${taskId}`;
    instructionInput.value = state.instruction;

    // 이미지 3칸: Before · 채택한 AI Preview(배치 참고용) · 실제 상품(SKU 확인 기준)
    const [beforeSlot, previewSlot, productSlot] = document.querySelectorAll('.image-grid .image-placeholder');
    showImage(beforeSlot, task.storePhotoUrl, '현재 매장 사진 (Before)');
    showImage(previewSlot, task.preview.adopted ? task.preview.imageUrl : null, '채택한 AI Preview');
    showImage(productSlot, task.product.imageUrl, '실제 상품 이미지');

    render();
}

init().catch(showError);
