// DP Editor 화면 동작
// Week 2: 작업 정보를 서버에서 받아온다.
// 영역 지정은 아직 [임시] 클릭 방식. 이후 마우스 드래그로 그리는 방식으로 교체한다.

const taskId = requireTaskId();

const photoCanvas = document.getElementById('photo-canvas');
const regionBox = document.getElementById('region-box');
const regionStatus = document.getElementById('region-status');
const resetButton = document.getElementById('reset-button');
const previewButton = document.getElementById('preview-button');

// 지정된 영역. Backend의 Placement와 같은 구조로 x, y, width, height를 0~1 비율로 저장한다
// null이면 영역이 아직 없다는 뜻
let placement = null;

// [임시] Week 1 예시 영역: 사진 가로의 35% 지점부터 30% 너비, 세로의 25% 지점부터 50% 높이
const SAMPLE_PLACEMENT = { x: 0.35, y: 0.25, width: 0.30, height: 0.50 };

// placement 값에 맞춰 화면(영역 상자, 상태 문구, 버튼)을 다시 그린다
function renderPlacement() {
    if (placement) {
        regionBox.style.left = `${placement.x * 100}%`;
        regionBox.style.top = `${placement.y * 100}%`;
        regionBox.style.width = `${placement.width * 100}%`;
        regionBox.style.height = `${placement.height * 100}%`;
        regionBox.hidden = false;
        regionStatus.textContent = '영역: 지정됨';
        regionStatus.classList.add('is-set');
    } else {
        regionBox.hidden = true;
        regionStatus.textContent = '영역: 미지정';
        regionStatus.classList.remove('is-set');
    }

    // [Preview 생성] 활성 조건 (Wireframe v0.2): 영역 1개가 지정되어 있을 것
    previewButton.disabled = placement === null;
}

// [임시] 사진 영역을 클릭하면 예시 영역을 지정한다 (1 Task = 영역 1개이므로 항상 하나로 덮어씀)
photoCanvas.addEventListener('click', () => {
    placement = { ...SAMPLE_PLACEMENT };
    renderPlacement();
});

resetButton.addEventListener('click', () => {
    placement = null;
    renderPlacement();
});

previewButton.addEventListener('click', () => {
    // 다음 단계에서 PUT placement → POST preview 순서로 요청한 뒤 이동하도록 바꾼다.
    window.location.href = `/preview.html?taskId=${taskId}`;
});

// 서버에서 작업을 받아 화면을 채운다
async function init() {
    const task = await fetchTask(taskId);

    renderHeader({
        taskName: task.name,
        storeName: task.storeName,
        status: task.status,
        currentStep: 'EDITOR'
    });

    // 적용 상품 정보 표시 (textContent는 글자를 그대로 넣으므로 escapeHtml이 필요 없다)
    document.getElementById('product-name').textContent = task.product.name;
    document.getElementById('product-code').textContent = task.product.code;
    document.getElementById('product-color').textContent = task.product.color || '-';

    // 이전 단계로 돌아갈 때도 같은 작업 번호를 유지한다
    document.getElementById('prev-link').href = `/setup.html?taskId=${taskId}`;

    // 이미 저장된 영역이 있으면 그대로 보여준다
    placement = task.placement;
    renderPlacement();
}

renderPlacement();
init().catch(showError);
