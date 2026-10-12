// AI Preview 화면 동작
// Week 2: 서버에 기록된 Preview 결과를 보여준다.
// 지금 결과 이미지는 MockPreviewGenerator가 돌려준 고정 예시 이미지다 (입력과 무관).

const taskId = requireTaskId();
const adoptButton = document.getElementById('adopt-button');

// DP Plan으로 가는 유일한 길: VMD의 명시적 채택 (Wireframe v0.2)
// - Preview가 생성되었다는 이유만으로 자동 이동하지 않는다
// - 확인 팝업 없이, 이 버튼을 누르는 행동 자체를 채택으로 본다 (사용자 결정)
// - 채택 기록은 서버에 남긴다 (POST /preview/adopt)
adoptButton.addEventListener('click', async () => {
    adoptButton.disabled = true;
    try {
        await apiRequest(`/api/tasks/${taskId}/preview/adopt`, { method: 'POST' });
        window.location.href = `/plan.html?taskId=${taskId}`;
    } catch (error) {
        showError(error);
        adoptButton.disabled = false;
    }
});

// 영역을 바꾸고 싶으면 DP Editor로 돌아간다 (같은 작업 번호 유지)
document.getElementById('edit-link').href = `/editor.html?taskId=${taskId}`;

// 영역을 사진 기준 %로 짧게 보여준다 (어떤 조건으로 만든 결과인지 확인용)
function describePlacement(placement) {
    if (!placement) {
        return '미지정';
    }
    const percent = value => `${Math.round(value * 100)}%`;
    return `가로 ${percent(placement.x)} · 세로 ${percent(placement.y)} 위치, ${percent(placement.width)} × ${percent(placement.height)}`;
}

async function init() {
    const task = await fetchTask(taskId);

    renderHeader({
        taskName: task.name,
        storeName: task.storeName,
        status: task.status,
        currentStep: 'PREVIEW'
    });

    const [beforeSlot, afterSlot] = document.querySelectorAll('.image-grid .image-placeholder');
    showImage(beforeSlot, task.storePhotoUrl, '현재 매장 사진 (Before)');
    showImage(afterSlot, task.preview.imageUrl, 'AI Preview 결과 (After)');

    // 생성 조건 요약: 어떤 상품과 영역으로 만든 결과인지 VMD가 확인할 수 있게 한다
    showImage(document.querySelector('.condition-thumb'), task.product.imageUrl, '적용 상품');
    document.getElementById('product-name').textContent = task.product.name;
    document.getElementById('product-code').textContent = task.product.code;
    document.getElementById('placement-text').textContent = describePlacement(task.placement);

    // Preview가 아직 없으면(주소로 바로 들어온 경우 등) 채택할 수 없다
    if (!task.preview.imageUrl) {
        adoptButton.disabled = true;
        afterSlot.innerHTML = '<span>아직 생성된 Preview가 없습니다.<br><span class="hint">영역 수정 화면에서 Preview를 생성해 주세요.</span></span>';
    }
}

init().catch(showError);
