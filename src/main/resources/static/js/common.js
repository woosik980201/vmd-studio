// VMD Studio 공통 기능: 상태·단계 이름 정의, 공통 상단 그리기, 주소 값 읽기

// Backend의 TaskStatus enum과 같은 값을 사용한다
const STATUS_LABELS = {
    IN_PROGRESS: '작업 중',
    REVIEWED: '작성 완료',
    SHARED: '공유 완료'
};

// Backend의 TaskStep enum과 같은 값을 사용한다
const STEPS = [
    { code: 'SETUP', label: '① 등록' },
    { code: 'EDITOR', label: '② 영역 지정' },
    { code: 'PREVIEW', label: '③ Preview' },
    { code: 'PLAN', label: '④ DP Plan' }
];

// 사용자가 입력한 글자를 화면에 넣기 전에 HTML 기호를 안전한 문자로 바꾼다
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

// 공통 상단을 그린다
// options 예시: { taskName, storeName, status, currentStep }
// currentStep이 없으면(Dashboard, 매장 직원 보기 상태) 단계 표시를 숨긴다
function renderHeader(options = {}) {
    const header = document.getElementById('app-header');

    const taskInfo = options.taskName
        ? `<span class="task-info">${escapeHtml(options.taskName)} · ${escapeHtml(options.storeName)}</span>`
        : '';

    const statusBadge = options.status
        ? `<span class="badge badge-${options.status}">${STATUS_LABELS[options.status]}</span>`
        : '';

    let stepsHtml = '';
    if (options.currentStep) {
        const stepItems = STEPS.map(step => {
            const currentClass = step.code === options.currentStep ? 'is-current' : '';
            return `<span class="step ${currentClass}">${step.label}</span>`;
        });
        stepsHtml = `<nav class="steps">${stepItems.join('<span>─</span>')}</nav>`;
    }

    // 로고는 보통 Dashboard로 가는 링크다.
    // 매장 직원 보기처럼 Dashboard에 갈 필요가 없는 화면은 brandLink: false로 글자만 보여준다 (10/12 결정)
    const brand = options.brandLink === false
        ? '<span class="brand">VMD Studio</span>'
        : '<a class="brand" href="/">VMD Studio</a>';

    header.innerHTML = `
    <div class="app-header">
      <div class="header-top">
        ${brand}
        <div class="header-right">${taskInfo}${statusBadge}</div>
      </div>
      ${stepsHtml}
    </div>
  `;
}

// 주소의 ?taskId=1 같은 값을 읽는다
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// 작업 번호가 꼭 있어야 하는 화면(영역 지정·Preview·DP Plan)에서 사용한다
// 주소에 taskId가 없으면 어떤 작업인지 알 수 없으므로 Dashboard로 돌려보낸다
function requireTaskId() {
    const taskId = getQueryParam('taskId');
    if (!taskId) {
        window.location.href = '/';
    }
    return taskId;
}

// ----- 서버(API) 요청 -----

// fetch를 감싼 공통 함수: 실패하면 서버가 보낸 안내 문구로 오류를 만든다
async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        let message = `요청에 실패했습니다 (${response.status})`;
        try {
            const body = await response.json();
            if (body.message) {
                message = body.message;
            }
        } catch (ignored) {
            // 응답이 JSON이 아니면 기본 문구를 쓴다
        }
        throw new Error(message);
    }

    // 돌려줄 내용이 없는 응답(204)
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

// 작업 1건 가져오기 (Week 1의 findSampleTask를 대신한다)
function fetchTask(taskId) {
    return apiRequest(`/api/tasks/${taskId}`);
}

// 이미지 자리(placeholder)를 실제 이미지로 바꾼다. url이 없으면 자리 표시를 그대로 둔다
function showImage(container, url, altText) {
    if (!url) {
        return;
    }
    const img = document.createElement('img');
    img.src = url;
    img.alt = altText;
    container.innerHTML = '';
    container.appendChild(img);
    container.classList.add('has-image');
}

// 오류를 사용자에게 알린다 (Prototype 단계: 간단히 alert)
function showError(error) {
    console.error(error);
    alert(error.message);
}