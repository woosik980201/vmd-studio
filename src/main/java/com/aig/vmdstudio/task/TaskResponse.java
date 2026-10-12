package com.aig.vmdstudio.task;

import java.time.format.DateTimeFormatter;

/**
 * 화면(JavaScript)으로 보내는 작업 데이터.
 *
 * Entity(Task)를 그대로 보내지 않고 이 모양으로 바꿔서 보낸다.
 *  - Week 1의 sample-data.js와 같은 구조(task.product.name, task.plan.instruction)라서
 *    화면 코드를 거의 그대로 쓸 수 있다.
 *  - DB 칸 이름(파일 이름 등)이 바뀌어도 화면에는 영향이 없다.
 */
public record TaskResponse(
        Long id,
        String name,
        String storeName,
        TaskStatus status,
        TaskStep step,
        String updatedAt,
        String storePhotoUrl,
        Product product,
        Placement placement,
        Preview preview,
        Plan plan
) {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("MM/dd");

    public record Product(String name, String code, String color, String memo, String imageUrl) {
    }

    public record Preview(String imageUrl, boolean adopted) {
    }

    public record Plan(String instruction) {
    }

    public static TaskResponse from(Task task) {
        String base = "/api/tasks/" + task.getId() + "/images/";

        return new TaskResponse(
                task.getId(),
                task.getName(),
                task.getStoreName(),
                task.getStatus(),
                task.getStep(),
                task.getUpdatedAt() == null ? "" : task.getUpdatedAt().format(DATE_FORMAT),
                imageUrl(base + "store-photo", task.getStorePhotoFile()),
                new Product(
                        task.getProductName(),
                        task.getProductCode(),
                        task.getProductColor(),
                        task.getVmdMemo(),
                        imageUrl(base + "product", task.getProductImageFile())
                ),
                task.getPlacement(),
                new Preview(task.getPreviewImageUrl(), task.isPreviewAdopted()),
                new Plan(task.getInstruction())
        );
    }

    /**
     * 이미지가 없으면 null.
     * 주소 끝에 ?v=파일이름을 붙이는 이유: 이미지를 교체해도 주소가 같으면
     * 브라우저가 예전 이미지를 캐시에서 보여줄 수 있기 때문이다.
     */
    private static String imageUrl(String url, String fileName) {
        return fileName == null ? null : url + "?v=" + fileName;
    }
}
