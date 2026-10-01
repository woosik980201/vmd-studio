// Dashboard 화면 동작
// Week 1: 서버 대신 고정 예시 데이터를 사용한다.
// 나중에 GET /api/tasks 결과로 바꿀 때, 아래 renderTaskList 함수는 그대로 쓴다.

const sampleTasks = [
    { id: 1, name: '10월 입구 DP 교체', storeName: '성수점', status: 'IN_PROGRESS', step: 'EDITOR', updatedAt: '10/01' },
    { id: 2, name: '신상 니트 배치', storeName: '더현대 서울', status: 'REVIEWED', step: 'PLAN', updatedAt: '09/30' },
    { id: 3, name: '가방 진열 변경', storeName: '홍대점', status: 'SHARED', step: 'PLAN', updatedAt: '09/28' }
];

// 단계 값 → 화면 파일
const STEP_PAGES = {
    SETUP: 'setup.html',
    EDITOR: 'editor.html',
    PREVIEW: 'preview.html',
    PLAN: 'plan.html'
};

// 기존 작업을 열 때 어느 화면으로 갈지 정한다 (Wireframe v0.2 결정)
// 공유 완료 → DP Plan 보기 상태 / 검토 완료 → DP Plan 작성 상태 / 작업 중 → 마지막으로 머문 화면
function getTaskUrl(task) {
    if (task.status === 'SHARED') {
        return `/plan.html?taskId=${task.id}&mode=view`;
    }
    if (task.status === 'REVIEWED') {
        return `/plan.html?taskId=${task.id}`;
    }
    return `/${STEP_PAGES[task.step]}?taskId=${task.id}`;
}

function renderTaskList(tasks) {
    const tbody = document.getElementById('task-list');
    tbody.innerHTML = '';

    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.className = 'clickable';
        row.innerHTML = `
      <td>${escapeHtml(task.storeName)}</td>
      <td>${escapeHtml(task.name)}</td>
      <td><span class="badge badge-${task.status}">${STATUS_LABELS[task.status]}</span></td>
      <td>${escapeHtml(task.updatedAt)}</td>
    `;
        row.addEventListener('click', () => {
            window.location.href = getTaskUrl(task);
        });
        tbody.appendChild(row);
    });
}

renderHeader();
renderTaskList(sampleTasks);