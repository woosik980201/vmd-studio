// VMD Studio 공통 기능: 상태·단계 이름 정의, 공통 상단 그리기, 주소 값 읽기

// Backend의 TaskStatus enum과 같은 값을 사용한다
const STATUS_LABELS = {
    IN_PROGRESS: '작업 중',
    REVIEWED: '검토 완료',
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

    header.innerHTML = `
    <div class="app-header">
      <div class="header-top">
        <a class="brand" href="/">VMD Studio</a>
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