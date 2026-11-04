package com.aig.vmdstudio.task;

import com.aig.vmdstudio.storage.ImageStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 작업 삭제 (D26): DB 기록과 이 작업의 이미지 파일이 함께 지워지고, 다른 작업은 남는다 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:delete-test",
        "vmd.upload-dir=build/test-uploads",
        "vmd.preview.engine=mock"
})
@AutoConfigureMockMvc
class TaskDeleteTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TaskService taskService;

    @Autowired
    private ImageStorageService imageStorage;

    private Task createTask() {
        return taskService.create(
                new SetupForm("성수점", "삭제 테스트", "빨간 반팔 티", "T-01", "RED", ""),
                new MockMultipartFile("storePhoto", "store.png", "image/png", new byte[]{1}),
                new MockMultipartFile("productImage", "tee.jpg", "image/jpeg", new byte[]{2}));
    }

    @Test
    void 삭제하면_작업과_이미지가_사라지고_다른_작업은_남는다() throws Exception {
        Task target = createTask();
        Task other = createTask();
        Path storePhoto = imageStorage.pathOf(target.getStorePhotoFile());
        Path productImage = imageStorage.pathOf(target.getProductImageFile());
        assertTrue(Files.exists(storePhoto));

        mockMvc.perform(delete("/api/tasks/" + target.getId())).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks/" + target.getId())).andExpect(status().isNotFound());
        assertFalse(Files.exists(storePhoto));
        assertFalse(Files.exists(productImage));
        mockMvc.perform(get("/api/tasks/" + other.getId())).andExpect(status().isOk());
        assertTrue(Files.exists(imageStorage.pathOf(other.getStorePhotoFile())));
    }

    @Test
    void 없는_작업을_삭제하면_404() throws Exception {
        mockMvc.perform(delete("/api/tasks/999999")).andExpect(status().isNotFound());
    }
}
