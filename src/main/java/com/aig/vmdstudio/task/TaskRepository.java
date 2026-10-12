package com.aig.vmdstudio.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Task를 DB에 저장하고 꺼내는 역할.
 * JpaRepository를 상속하면 save, findById, count 같은 기본 기능을 Spring이 자동으로 만들어 준다.
 */
public interface TaskRepository extends JpaRepository<Task, Long> {

    /** Dashboard용: 최근에 수정한 작업이 위로 오도록 정렬 (메서드 이름 규칙으로 쿼리가 자동 생성됨) */
    List<Task> findAllByOrderByUpdatedAtDesc();
}
