package com.aig.vmdstudio.task;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 서버를 처음 켰을 때 DB가 비어 있으면 Week 1 예시 작업 3개를 넣는다.
 * (sample-data.js에 있던 데이터를 DB로 옮긴 것. 이미지는 없음)
 *
 * DB는 파일(data 폴더)에 저장되므로, 한 번 넣은 뒤에는 서버를 다시 켜도 중복으로 들어가지 않는다.
 * 처음 상태로 되돌리고 싶으면 서버를 끄고 프로젝트의 data 폴더를 지운 뒤 다시 켜면 된다.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private final TaskRepository taskRepository;

    public DataInitializer(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Override
    public void run(String... args) {
        if (taskRepository.count() > 0) {
            return;
        }

        Task bag = new Task("가방 진열 변경", "홍대점",
                "레더 토트백", "BG-0105", "Black", "");
        bag.setStatusAndStepForSample(TaskStatus.SHARED, TaskStep.PLAN,
                "중앙 테이블 오른쪽에 토트백을 세워서 진열해 주세요.");

        Task knit = new Task("신상 니트 배치", "더현대 서울",
                "울 크루넥 니트", "KN-0012", "Ivory", "입고 수량 확인 필요");
        knit.setStatusAndStepForSample(TaskStatus.REVIEWED, TaskStep.PLAN,
                "입구 왼쪽 행거 두 번째 칸에 니트 3장을 걸어 주세요.");

        Task tee = new Task("10월 입구 DP 교체", "성수점",
                "베이직 무지 티셔츠", "TS-0001", "Black", "입구 행거 기존 그래픽 티 자리에 교체 예정");
        tee.setStatusAndStepForSample(TaskStatus.IN_PROGRESS, TaskStep.EDITOR, "");

        // 오래된 것부터 저장해서, 수정일 순 정렬 시 '10월 입구 DP 교체'가 맨 위에 오게 한다
        taskRepository.save(bag);
        taskRepository.save(knit);
        taskRepository.save(tee);
    }
}
