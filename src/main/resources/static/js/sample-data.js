// Week 1 예시 데이터: 서버(API)가 생기기 전까지 화면 확인용으로만 사용한다.
// API를 연결하면 이 파일은 삭제하고, 각 화면이 서버에서 데이터를 받아온다.
//
// product.memo     : VMD 메모 (Store Setup, 내부 참고용)
// plan.instruction : VMD 작업 지시 (DP Plan, 매장 직원 전달용) — 두 데이터는 서로 별개

const sampleTasks = [
    {
        id: 1, name: '10월 입구 DP 교체', storeName: '성수점',
        status: 'IN_PROGRESS', step: 'EDITOR', updatedAt: '10/01',
        product: { name: '베이직 무지 티셔츠', code: 'TS-0001', color: 'Black', memo: '입구 행거 기존 그래픽 티 자리에 교체 예정' },
        plan: { instruction: '' }
    },
    {
        id: 2, name: '신상 니트 배치', storeName: '더현대 서울',
        status: 'REVIEWED', step: 'PLAN', updatedAt: '09/30',
        product: { name: '울 크루넥 니트', code: 'KN-0012', color: 'Ivory', memo: '입고 수량 확인 필요' },
        plan: { instruction: '입구 왼쪽 행거 두 번째 칸에 니트 3장을 걸어 주세요.' }
    },
    {
        id: 3, name: '가방 진열 변경', storeName: '홍대점',
        status: 'SHARED', step: 'PLAN', updatedAt: '09/28',
        product: { name: '레더 토트백', code: 'BG-0105', color: 'Black', memo: '' },
        plan: { instruction: '중앙 테이블 오른쪽에 토트백을 세워서 진열해 주세요.' }
    }
];

// taskId로 예시 작업 하나를 찾는다. 없으면 null
function findSampleTask(taskId) {
    return sampleTasks.find(task => String(task.id) === String(taskId)) || null;
}