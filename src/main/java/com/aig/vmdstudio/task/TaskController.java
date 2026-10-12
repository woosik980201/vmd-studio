package com.aig.vmdstudio.task;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 화면에서 보내는 /api/tasks 요청을 받는 곳.
 * 결과는 TaskResponse 모양의 JSON으로 돌려준다.
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** Dashboard: 작업 목록 */
    @GetMapping
    public List<TaskResponse> list() {
        return taskService.findAll().stream()
                .map(TaskResponse::from)
                .toList();
    }

    /** 각 화면: 작업 1건 */
    @GetMapping("/{id}")
    public TaskResponse get(@PathVariable Long id) {
        return TaskResponse.from(taskService.findById(id));
    }
}
