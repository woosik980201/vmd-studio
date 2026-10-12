package com.aig.vmdstudio.task;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * VMD가 DP Editor에서 지정한 변경 영역.
 * 사진 크기와 상관없이 위치가 유지되도록 0~1 비율로 저장한다 (기능 명세 v0.2).
 * 4단계(AnyDoor 연동)에서 이 값을 Background Mask 이미지로 변환한다.
 *
 * Task 테이블 안의 칸(region_x ...)으로 함께 저장된다 (@Embeddable).
 */
@Embeddable
public class Placement {

    @Column(name = "region_x")
    private Double x;

    @Column(name = "region_y")
    private Double y;

    @Column(name = "region_width")
    private Double width;

    @Column(name = "region_height")
    private Double height;

    protected Placement() {
        // JPA가 사용하는 기본 생성자
    }

    public Placement(double x, double y, double width, double height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    /** (getter 이름 규칙을 피해서 JSON에 섞이지 않게 함) 0~1 범위 안에 있고, 사진 밖으로 나가지 않으며, 크기가 0보다 큰지 확인한다 */
    public boolean hasValidRange() {
        if (x == null || y == null || width == null || height == null) {
            return false;
        }
        return x >= 0 && y >= 0 && width > 0 && height > 0
                && x + width <= 1.0001 && y + height <= 1.0001;
    }

    /** 다른 영역과 위치·크기가 같은지 */
    public boolean sameAs(Placement other) {
        return other != null
                && java.util.Objects.equals(x, other.x) && java.util.Objects.equals(y, other.y)
                && java.util.Objects.equals(width, other.width) && java.util.Objects.equals(height, other.height);
    }

    public Double getX() { return x; }
    public Double getY() { return y; }
    public Double getWidth() { return width; }
    public Double getHeight() { return height; }
}
