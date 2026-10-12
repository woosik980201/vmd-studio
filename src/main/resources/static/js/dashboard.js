// Dashboard 화면 동작
// Week 2: 서버의 GET /api/tasks 결과로 목록을 그린다. (renderTaskList는 Week 1 코드 그대로)

// 단계 값 → 화면 파일
const STEP_PAGES = {
    SETUP: 'setup.html',
    EDITOR: 'editor.html',
    PREVIEW: 'preview.html',
    PLAN: 'plan.html'
};

// 기존 작업을 열 때 어느 화면으로 갈지 정한다 (Wireframe v0.2 결정)
// 공유 완료·검토 완료 → DP Plan / 작업 중 → 마지막으로 머문 화면
// 공유 완료 작업은 DP Plan이 알아서 보기 상태로 그린다.
// Dashboard는 VMD 화면이므로 mode=view(직원용 주소)를 붙이지 않는다 → [공유 취소하고 수정]이 보인다 (10/12)
function getTaskUrl(task) {
    if (task.status === 'SHARED' || task.status === 'REVIEWED') {
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
apiRequest('/api/tasks')
    .then(renderTaskList)
    .catch(showError);