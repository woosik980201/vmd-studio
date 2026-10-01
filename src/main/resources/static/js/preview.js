// AI Preview 화면 동작
// Week 1 골격: 이미지는 자리만 표시한다.
// 실제 Mock 이미지(#03A 세트)는 API와 MockPreviewGenerator 단계에서 연결한다.

const taskId = getQueryParam('taskId') || 1;
const task = findSampleTask(taskId);

renderHeader({
    taskName: task.name,
    storeName: task.storeName,
    status: task.status,
    currentStep: 'PREVIEW'
});

// 생성 조건 요약: 어떤 상품으로 만든 결과인지 VMD가 확인할 수 있게 한다
document.getElementById('product-name').textContent = task.product.name;
document.getElementById('product-code').textContent = task.product.code;

// 영역을 바꾸고 싶으면 DP Editor로 돌아간다 (같은 작업 번호 유지)
document.getElementById('edit-link').href = `/editor.html?taskId=${taskId}`;

// DP Plan으로 가는 유일한 길: VMD의 명시적 채택 (Wireframe v0.2)
// - Preview가 생성되었다는 이유만으로 자동 이동하지 않는다
// - 확인 팝업 없이, 이 버튼을 누르는 행동 자체를 채택으로 본다 (사용자 결정)
document.getElementById('adopt-button').addEventListener('click', () => {
    // Week 1 골격: 아직 서버에 채택을 기록하지 않는다.
    // API를 연결하면 POST /api/tasks/{id}/preview/adopt 를 보낸 뒤 이동한다.
    window.location.href = `/plan.html?taskId=${taskId}`;
});