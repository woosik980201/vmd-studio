package com.aig.vmdstudio.preview;

/**
 * AI Preview를 만드는 엔진의 '약속(인터페이스)'.
 *
 * 서비스의 나머지 부분(TaskService, 화면)은 이 약속만 알고, 실제로 무엇이 이미지를 만드는지는 모른다.
 *  - 지금(Week 2): MockPreviewGenerator — 입력과 관계없이 고정 예시 이미지를 돌려준다
 *  - 10/29~: AnyDoorPreviewGenerator — Python AI 서버(AnyDoor)를 호출한다
 *  어느 쪽을 쓸지는 application.properties의 vmd.preview.engine(mock / anydoor)으로 정한다.
 * 교체할 때 화면과 API는 바꾸지 않아도 된다. (Architecture v0.1 설계)
 */
public interface PreviewGenerator {

    /**
     * 매장 사진 + 상품 이미지 + 영역으로 DP 변경 예상 이미지를 만들고,
     * 화면에서 보여줄 이미지 주소를 돌려준다.
     */
    String generate(PreviewRequest request);
}
