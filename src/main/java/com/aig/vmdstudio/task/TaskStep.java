package com.aig.vmdstudio.task;

/**
 * 작업이 마지막으로 머문 단계. Dashboard에서 '작업 중' 작업을 열 때 이 화면으로 이동한다.
 * 화면의 common.js STEPS와 같은 값을 사용한다.
 */
public enum TaskStep {
    SETUP,   // ① 등록
    EDITOR,  // ② 영역 지정
    PREVIEW, // ③ Preview
    PLAN     // ④ DP Plan
}
