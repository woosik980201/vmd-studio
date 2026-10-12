// DP Editor 화면 동작
// 저장된 매장 사진 위에 VMD가 직접 변경 영역을 그리고, 영역 저장 → Preview 생성을 서버에 요청한다.
//
// 영역 지정 방식 (10/12 결정: P0 + P1)
//   - 그리기  : 사진의 빈 곳을 누른 채 끌기
//   - 이동    : 영역 안쪽을 누른 채 끌기
//   - 크기 조절: 네 모서리 핸들(가로·세로 함께) 또는 네 변 가운데 핸들(한 방향만)을 누른 채 끌기
//   - 마우스·터치패드·터치를 같은 코드로 처리하기 위해 Pointer Events를 사용한다
//
// 좌표는 항상 사진 기준 0~1 비율로 저장한다 (Backend Placement와 같은 구조).
// 캔버스 비율을 사진 비율과 똑같이 맞추므로, 캔버스 안의 위치 비율 = 사진 안의 위치 비율이다.

const taskId = requireTaskId();

const photoCanvas = document.getElementById('photo-canvas');
const regionBox = document.getElementById('region-box');
const regionStatus = document.getElementById('region-status');
const resetButton = document.getElementById('reset-button');
const previewButton = document.getElementById('preview-button');

// 너무 작은 영역은 Preview 결과를 판단하기 어려우므로 막는다 (사진 가로·세로의 5% 미만)
const MIN_SIZE = 0.05;

// 지정된 영역 { x, y, width, height } (0~1 비율). null이면 아직 없음
let placement = null;

// 매장 사진이 다 불러와졌는지. 불러오기 전에는 캔버스 비율이 사진과 달라서 그리면 좌표가 어긋난다
let photoReady = false;

// 지금 진행 중인 끌기 동작. null이면 끌고 있지 않음
// { mode: 'draw' | 'move' | 'resize', start, handle, before }
let drag = null;

// 잠깐 보여줄 안내 문구 (예: 영역이 너무 작음). 다음 동작을 시작하면 지운다
let warning = '';

// ----- 계산 도우미 -----

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// 화면 좌표(마우스 위치) → 캔버스 기준 0~1 비율. 사진 밖으로 끌어도 사진 가장자리에서 멈춘다
function toPhotoPoint(event) {
    const rect = photoCanvas.getBoundingClientRect();
    return {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    };
}

// 두 점을 대각선 끝으로 하는 사각형 (어느 방향으로 끌어도 같은 결과)
function rectFromPoints(a, b) {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x),
        height: Math.abs(a.y - b.y)
    };
}

// 서버로 보낼 값은 소수점 4자리로 정리한다 (1장 사진 기준 0.01% 단위, 충분히 정밀함)
function roundPlacement(rect) {
    const round = value => Math.round(value * 10000) / 10000;
    return { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) };
}

// 핸들 방향에 해당하는 변만 point 위치로 옮긴 사각형
// handle 글자: n=위 변, s=아래 변, w=왼쪽 변, e=오른쪽 변 (모서리는 두 글자, 예: 'ne' = 위 + 오른쪽)
// 반대쪽 변을 넘어가도록 끌면 rectFromPoints가 방향을 알아서 뒤집어 준다
function resizeByHandle(rect, handle, point) {
    let left = rect.x;
    let right = rect.x + rect.width;
    let top = rect.y;
    let bottom = rect.y + rect.height;

    if (handle.includes('w')) left = point.x;
    if (handle.includes('e')) right = point.x;
    if (handle.includes('n')) top = point.y;
    if (handle.includes('s')) bottom = point.y;

    return rectFromPoints({ x: left, y: top }, { x: right, y: bottom });
}

function isTooSmall(rect) {
    return rect.width < MIN_SIZE || rect.height < MIN_SIZE;
}

// ----- 화면 그리기 -----

// placement 값에 맞춰 화면(영역 상자, 상태 문구, 버튼)을 다시 그린다
function renderPlacement() {
    if (placement) {
        regionBox.style.left = `${placement.x * 100}%`;
        regionBox.style.top = `${placement.y * 100}%`;
        regionBox.style.width = `${placement.width * 100}%`;
        regionBox.style.height = `${placement.height * 100}%`;
        regionBox.hidden = false;
    } else {
        regionBox.hidden = true;
    }

    if (warning) {
        regionStatus.textContent = warning;
        regionStatus.className = 'region-status is-warning';
    } else if (placement) {
        regionStatus.textContent = '영역: 지정됨 · 안쪽을 끌면 이동, 모서리·변의 핸들을 끌면 크기 조절';
        regionStatus.className = 'region-status is-set';
    } else {
        regionStatus.textContent = photoReady
            ? '영역: 미지정 · 사진 위를 끌어서 영역을 그려주세요'
            : '영역: 미지정';
        regionStatus.className = 'region-status';
    }

    // [Preview 생성] 활성 조건 (Wireframe v0.2): 영역 1개가 지정되어 있을 것. 끌고 있는 중에는 막는다
    previewButton.disabled = placement === null || drag !== null;
}

// ----- 끌기 동작 (Pointer Events) -----

photoCanvas.addEventListener('pointerdown', event => {
    // 사진이 준비되지 않았거나, 마우스 오른쪽 버튼 등 주 버튼이 아니면 무시
    if (!photoReady || event.button !== 0) {
        return;
    }
    warning = '';
    const point = toPhotoPoint(event);
    const handle = event.target.dataset.handle; // 모서리 핸들이면 'nw' / 'ne' / 'sw' / 'se'
    const before = placement ? { ...placement } : null;

    if (handle && placement) {
        // 크기 조절: 잡은 핸들이 가리키는 변만 끄는 위치로 옮기고, 나머지 변은 그대로 둔다
        //   모서리(nw/ne/sw/se) → 가로·세로 두 변이 함께 움직임
        //   변 가운데(n/s/e/w)  → 한 변만 움직임 (가로 또는 세로 한 방향만 조절)
        drag = { mode: 'resize', before, handle };
    } else if (event.target === regionBox && placement) {
        // 이동: 처음 누른 위치에서 얼마나 움직였는지만큼 영역을 옮긴다
        drag = { mode: 'move', before, start: point };
    } else {
        // 그리기: 누른 위치를 한쪽 모서리로 새 사각형을 만든다 (1 Task = 영역 1개이므로 기존 영역은 대체)
        drag = { mode: 'draw', before, start: point };
    }

    // 끄는 도중 포인터가 캔버스 밖으로 나가도 계속 이벤트를 받도록 붙잡는다
    photoCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    renderPlacement();
});

photoCanvas.addEventListener('pointermove', event => {
    if (!drag) {
        return;
    }
    const point = toPhotoPoint(event);

    if (drag.mode === 'draw') {
        placement = rectFromPoints(drag.start, point);
    } else if (drag.mode === 'resize') {
        placement = resizeByHandle(drag.before, drag.handle, point);
    } else if (drag.mode === 'move') {
        const origin = drag.before;
        // 사진 밖으로 나가지 않도록 시작점의 범위를 제한한다
        placement = {
            x: clamp(origin.x + (point.x - drag.start.x), 0, 1 - origin.width),
            y: clamp(origin.y + (point.y - drag.start.y), 0, 1 - origin.height),
            width: origin.width,
            height: origin.height
        };
    }
    renderPlacement();
});

// 손을 뗐을 때: 크기를 확인하고 최종 값을 정리한다
function finishDrag() {
    if (!drag) {
        return;
    }

    if (placement && isTooSmall(placement)) {
        const wasJustClick = drag.mode === 'draw' && placement.width < 0.01 && placement.height < 0.01;
        // 단순 클릭(거의 안 끈 경우)은 조용히 원래대로, 일부러 작게 그렸다면 안내
        if (!wasJustClick) {
            warning = '영역이 너무 작습니다. 사진 가로·세로의 5% 이상 크기로 지정해 주세요.';
        }
        placement = drag.before; // 이전 영역으로 되돌림 (없었다면 미지정)
    }

    if (placement) {
        placement = roundPlacement(placement);
    }
    drag = null;
    renderPlacement();
}

photoCanvas.addEventListener('pointerup', finishDrag);
photoCanvas.addEventListener('pointercancel', finishDrag);

resetButton.addEventListener('click', () => {
    placement = null;
    warning = '';
    renderPlacement();
});

// ----- Preview 생성 -----

// [Preview 생성]: ① 영역 저장 → ② Preview 생성 요청 → ③ Preview 화면으로 이동
previewButton.addEventListener('click', async () => {
    previewButton.disabled = true;
    previewButton.textContent = 'Preview 생성 중...';

    try {
        await apiRequest(`/api/tasks/${taskId}/placement`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(placement)
        });
        await apiRequest(`/api/tasks/${taskId}/preview`, { method: 'POST' });
        window.location.href = `/preview.html?taskId=${taskId}`;
    } catch (error) {
        showError(error);
        previewButton.textContent = 'Preview 생성 →';
        renderPlacement();
    }
});

// ----- 매장 사진 -----

// 사진이 준비되면 그리기를 허용한다
function setPhotoReady(ready) {
    photoReady = ready;
    photoCanvas.classList.toggle('is-disabled', !ready);
    renderPlacement();
}

// 매장 사진을 보여주고, 캔버스 비율을 사진 비율과 같게 맞춘다
// 이렇게 해야 화면에서 지정한 영역(0~1 비율)이 실제 사진의 같은 위치를 가리킨다 → 4단계에서 Mask로 변환 가능
function showStorePhoto(url) {
    if (!url) {
        document.getElementById('photo-message').textContent =
            '등록된 매장 사진이 없습니다. 이전 단계(등록)에서 사진을 올려주세요.';
        return;
    }

    const placeholder = photoCanvas.querySelector('.photo-placeholder');
    showImage(placeholder, url, '현재 매장 사진');

    const img = placeholder.querySelector('img');
    img.addEventListener('load', () => {
        photoCanvas.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        setPhotoReady(true);
    });
    img.addEventListener('error', () => {
        placeholder.innerHTML = '<span>매장 사진을 불러오지 못했습니다. 새로고침해 주세요.</span>';
        setPhotoReady(false);
    });
}

// ----- 서버에서 작업을 받아 화면을 채운다 -----
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

    // 서버에 저장된 이미지 표시 (예시 작업처럼 이미지가 없으면 안내 문구)
    showStorePhoto(task.storePhotoUrl);
    showImage(document.querySelector('.product-card-image'), task.product.imageUrl, '실제 상품 이미지');

    // 이전 단계로 돌아갈 때도 같은 작업 번호를 유지한다
    document.getElementById('prev-link').href = `/setup.html?taskId=${taskId}`;

    // 이미 저장된 영역이 있으면 그대로 보여준다
    placement = task.placement;
    renderPlacement();
}

renderPlacement();
init().catch(showError);
