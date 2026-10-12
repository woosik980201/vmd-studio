package com.aig.vmdstudio;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Objects;

/**
 * API에서 오류가 나면 항상 {"message": "안내 문구"} 모양으로 돌려준다.
 * 화면의 apiRequest()가 이 message를 읽어 사용자에게 보여준다.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    /** 404(없는 작업), 400(잘못된 입력) 등 */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        String message = Objects.requireNonNullElse(e.getReason(), "요청을 처리하지 못했습니다.");
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", message));
    }

    /** 지금 상태에서는 할 수 없는 행동 (예: 공유 완료 작업 수정) → 409 Conflict */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleConflict(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    /** application.properties의 업로드 크기 제한을 넘은 경우 */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("message", "이미지는 10MB 이하만 올릴 수 있습니다."));
    }
}
