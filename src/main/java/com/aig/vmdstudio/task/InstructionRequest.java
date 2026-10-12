package com.aig.vmdstudio.task;

/**
 * DP Plan 화면이 보내는 작업 지시 (JSON).
 * 예: {"instruction": "입구 행거 두 번째 칸에 걸어 주세요."}
 */
public record InstructionRequest(String instruction) {
}
