package com.aig.vmdstudio.preview;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Week 2용 가짜(Mock) Preview 엔진.
 *
 * 입력(사진·상품·영역)은 사용하지 않고, 설정한 예시 이미지 주소를 그대로 돌려준다.
 * 목적: 실제 AI 없이도 "영역 지정 → Preview 생성 → 채택 → DP Plan" 흐름 전체를 먼저 검증하는 것.
 *
 * 예시 이미지는 application.properties의 vmd.preview.mock-image-url로 바꿀 수 있다.
 * (기본값은 자리 표시용 SVG. AnyDoor 사전 실험 #03A 결과 이미지를 static/mock/에 넣고 주소를 바꾸면 된다)
 */
@Component
public class MockPreviewGenerator implements PreviewGenerator {

    private final String mockImageUrl;

    public MockPreviewGenerator(@Value("${vmd.preview.mock-image-url:/mock/mock-preview.svg}") String mockImageUrl) {
        this.mockImageUrl = mockImageUrl;
    }

    @Override
    public String generate(PreviewRequest request) {
        return mockImageUrl;
    }
}
