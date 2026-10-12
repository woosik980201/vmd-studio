package com.aig.vmdstudio.task;

/**
 * Store Setup 화면에서 보내는 글자 입력값.
 * 필수 여부는 Wireframe v0.2 결정을 따른다: 상품명·품번 필수 / 매장명·작업명·컬러·메모는 선택.
 */
public record SetupForm(
        String storeName,
        String name,
        String productName,
        String productCode,
        String productColor,
        String vmdMemo
) {

    /** 앞뒤 공백을 지우고, 비어 있으면 빈 글자로 맞춘다 */
    public SetupForm trimmed() {
        return new SetupForm(trim(storeName), trim(name), trim(productName),
                trim(productCode), trim(productColor), trim(vmdMemo));
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
