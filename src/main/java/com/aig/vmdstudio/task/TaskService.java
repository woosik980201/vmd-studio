package com.aig.vmdstudio.task;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 작업에 관한 규칙을 처리하는 곳.
 * Controller는 요청을 받고 응답만 하고, '무엇을 해도 되는지' 판단은 여기서 한다.
 */
@Service
@Transactional(readOnly = true)
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<Task> findAll() {
        return taskRepository.findAllByOrderByUpdatedAtDesc();
    }

    /** 없는 작업 번호면 404를 돌려준다 */
    public Task findById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "작업을 찾을 수 없습니다: " + id));
    }
}
