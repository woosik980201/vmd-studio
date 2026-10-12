package com.aig.vmdstudio.task;

/**
 * DP Editor가 보내는 영역 값 (JSON). 0~1 비율.
 * 예: {"x": 0.35, "y": 0.25, "width": 0.30, "height": 0.50}
 */
public record PlacementRequest(Double x, Double y, Double width, Double height) {

    public Placement toPlacement() {
        if (x == null || y == null || width == null || height == null) {
            return null;
        }
        return new Placement(x, y, width, height);
    }
}
