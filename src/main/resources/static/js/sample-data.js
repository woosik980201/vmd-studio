// Week 1 예시 데이터: 서버(API)가 생기기 전까지 화면 확인용으로만 사용한다.
// API를 연결하면 이 파일은 삭제하고, 각 화면이 서버에서 데이터를 받아온다.

const sampleTasks = [
    {
        id: 1, name: '10월 입구 DP 교체', storeName: '성수점',
        status: 'IN_PROGRESS', step: 'EDITOR', updatedAt: '10/01',
        product: { name: '베이직 무지 티셔츠', code: 'TS-0001', color: 'Black' }
    },
    {
        id: 2, name: '신상 니트 배치', storeName: '더현대 서울',
        status: 'REVIEWED', step: 'PLAN', updatedAt: '09/30',
        product: { name: '울 크루넥 니트', code: 'KN-0012', color: 'Ivory' }
    },
    {
        id: 3, name: '가방 진열 변경', storeName: '홍대점',
        status: 'SHARED', step: 'PLAN', updatedAt: '09/28',
        product: { name: '레더 토트백', code: 'BG-0105', color: 'Black' }
    }
];

// taskId로 예시 작업 하나를 찾는다. 없으면 null
function findSampleTask(taskId) {
    return sampleTasks.find(task => String(task.id) === String(taskId)) || null;
}