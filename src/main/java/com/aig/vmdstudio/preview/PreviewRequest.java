package com.aig.vmdstudio.preview;

import com.aig.vmdstudio.task.Placement;

import java.nio.file.Path;

/**
 * Preview 엔진에 넘기는 입력. AnyDoor 입력과 이렇게 대응한다.
 *  - storePhoto   → Background Image
 *  - placement    → Background Mask (0~1 비율 영역, 4단계에서 Mask 이미지로 변환)
 *  - productImage → Reference Image
 */
public record PreviewRequest(Path storePhoto, Path productImage, Placement placement) {
}
