package com.aig.vmdstudio.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

/**
 * 업로드한 이미지를 서버의 폴더(기본: 프로젝트의 uploads/)에 저장하고 꺼내는 역할.
 *
 * 왜 DB가 아니라 폴더에 저장하는가?
 *  - 이미지는 크기가 커서 DB에 넣으면 DB가 무거워진다.
 *  - 4단계에서 AnyDoor(Python)가 같은 이미지 파일을 읽어야 하므로 파일로 두는 편이 연결하기 쉽다.
 *  그래서 DB에는 파일 이름만 저장한다.
 */
@Service
public class ImageStorageService {

    // 허용하는 이미지 형식 → 저장할 확장자 (Store Setup 안내 문구: jpg · png)
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            MediaType.IMAGE_JPEG_VALUE, ".jpg",
            MediaType.IMAGE_PNG_VALUE, ".png"
    );

    private final Path uploadDir;

    public ImageStorageService(@Value("${vmd.upload-dir:uploads}") String uploadDir) throws IOException {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDir);
    }

    /**
     * 이미지를 저장하고, 저장한 파일 이름을 돌려준다.
     * 사용자가 올린 원래 파일 이름은 쓰지 않고 무작위 이름(UUID)으로 저장한다.
     * → 같은 이름 파일끼리 덮어쓰는 문제와, 파일 이름에 경로를 섞어 다른 폴더에 쓰는 공격을 막는다.
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일이 비어 있습니다.");
        }

        String extension = ALLOWED_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jpg 또는 png 이미지만 올릴 수 있습니다.");
        }

        String fileName = UUID.randomUUID() + extension;
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, uploadDir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "이미지를 저장하지 못했습니다.", e);
        }
        return fileName;
    }

    /** 저장된 파일을 꺼낸다. 업로드 폴더 밖의 파일은 절대 돌려주지 않는다 */
    public Resource load(String fileName) {
        Path path = uploadDir.resolve(fileName).normalize();
        if (!path.startsWith(uploadDir) || !Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다.");
        }
        try {
            return new UrlResource(path.toUri());
        } catch (MalformedURLException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다.", e);
        }
    }

    /** 확장자로 응답의 이미지 형식을 정한다 */
    public MediaType mediaTypeOf(String fileName) {
        return fileName.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
    }

    /** 4단계(AnyDoor 연동)에서 이미지 파일 경로를 넘길 때 사용한다 */
    public Path pathOf(String fileName) {
        return uploadDir.resolve(fileName).normalize();
    }
}
