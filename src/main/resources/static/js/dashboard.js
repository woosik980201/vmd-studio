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

function loadTasks() {
    return apiRequest('/api/tasks')
        .then(renderTaskList)
        .catch(showError);
}

// 되돌릴 수 없으므로 작업 이름을 보여 주고 확인을 받는다. 공유 완료 작업은 직원 화면도 사라진다고 알린다 (D26)
async function deleteTask(task) {
    const title = task.name || '이름 없는 작업';
    const sharedNotice = task.status === 'SHARED' ? '\n공유 완료 작업이라 매장 직원 화면에서도 사라집니다.' : '';
    const ok = window.confirm(`'${title}' 작업을 삭제할까요?${sharedNotice}\n사진과 Preview도 함께 지워지며 되돌릴 수 없습니다.`);
    if (!ok) {
        return;
    }
    try {
        await apiRequest(`/api/tasks/${task.id}`, { method: 'DELETE' });
    } catch (error) {
        showError(error);
    }
    await loadTasks();
}

function renderTaskList(tasks) {
    const tbody = document.getElementById('task-list');
    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="task-empty">아직 작업이 없습니다. 새 작업을 만들어 시작해 보세요.</td></tr>';
        return;
    }

    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.className = 'clickable';
        row.innerHTML = `
      <td>${escapeHtml(task.storeName)}</td>
      <td>${escapeHtml(task.name)}</td>
      <td><span class="badge badge-${task.status}">${STATUS_LABELS[task.status]}</span></td>
      <td>${escapeHtml(task.updatedAt)}</td>
      <td class="task-action"><button type="button" class="link-button task-delete">삭제</button></td>
    `;
        row.querySelector('.task-delete').addEventListener('click', event => {
            event.stopPropagation(); // 줄을 누른 것으로 처리되어 작업이 열리지 않게 한다
            deleteTask(task);
        });
        row.addEventListener('click', () => {
            window.location.href = getTaskUrl(task);
        });
        tbody.appendChild(row);
    });
}

renderHeader();
loadTasks();