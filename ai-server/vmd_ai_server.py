"""
VMD Studio - AI Preview Server (AnyDoor)

역할
- Spring Boot(VMD Studio)가 호출하는 AnyDoor 전용 Python API 서버
- 입력: 매장 사진 + 상품 이미지 + 영역 좌표(0~1 비율 x, y, w, h)
- 출력: DP 변경 예상 이미지(PNG)

원칙
- AnyDoor 원본(run_gradio_demo.py)은 수정하지 않는다. 필요한 함수만 이 파일로 옮겼다.
- AI는 Preview만 만든다. 채택/공유 판단은 VMD Studio(사용자)가 한다.

실행 (학교 PC)
    conda activate anydoor
    cd /d C:\dev\vmd-studio\ai-server
    python vmd_ai_server.py
테스트
    브라우저에서 http://127.0.0.1:8000/docs  (Swagger 화면에서 직접 업로드)

주의
- Gradio 데모와 동시에 켜지 말 것 (GPU 메모리 10GB가 이미 빠듯함)
"""

import io
import os
import random
import sys
import threading
import time
from typing import Optional

# ---------------------------------------------------------------------------
# 0. AnyDoor 폴더 연결
#    AnyDoor 코드는 상대 경로(./configs, ./iseg ...)를 쓰므로 작업 폴더를 옮기고
#    import 경로 맨 앞에 추가한다. 위치가 다르면 환경 변수 ANYDOOR_DIR로 바꾼다.
# ---------------------------------------------------------------------------
ANYDOOR_DIR = os.environ.get("ANYDOOR_DIR", r"C:\AI_Project\AnyDoor-for-windows")
if not os.path.isdir(ANYDOOR_DIR):
    raise SystemExit(f"[VMD AI] AnyDoor 폴더를 찾을 수 없습니다: {ANYDOOR_DIR}")
os.chdir(ANYDOOR_DIR)
sys.path.insert(0, ANYDOOR_DIR)

import cv2
import einops
import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from omegaconf import OmegaConf
from PIL import Image, ImageOps

from datasets.data_utils import *  # noqa: F401,F403  (AnyDoor 원본 유틸: bbox, pad, sobel 등)
from cldm.model import create_model, load_state_dict
from cldm.ddim_hacked import DDIMSampler
from cldm.hack import disable_verbosity, enable_sliced_attention

cv2.setNumThreads(0)
cv2.ocl.setUseOpenCL(False)

# ---------------------------------------------------------------------------
# 1. 모델 로딩 (run_gradio_demo.py 설정 + fp16)
#    10/27: save_memory=True로 4분 11초 -> 2분 10초 / 10/31: fp16으로 save_memory 없이 약 10초
# ---------------------------------------------------------------------------
# fp16 (10/31): 가중치를 반정밀도(16bit)로 바꿔 약 9.8GB → 4.9GB.
#   그러면 10GB GPU에 모델 전체가 올라가므로, 생성할 때마다 모델 일부를 CPU↔GPU로 옮기는 save_memory가 필요 없어진다.
#   VMD_FP16=0 으로 실행하면 기존 방식(fp32 + save_memory)과 같다.
#   10/31 측정: A3 195.6초 → 10.2초, A4 297.4초 → 9.1초, 결과는 눈으로 구분 안 됨(픽셀 평균 차 0.02~0.03)
USE_FP16 = os.environ.get("VMD_FP16", "1") == "1"
PORT = int(os.environ.get("VMD_AI_PORT", "8000"))
save_memory = not USE_FP16
disable_verbosity()
if save_memory:
    enable_sliced_attention()

config = OmegaConf.load("./configs/demo.yaml")
model = create_model(config.config_file).cpu()
model.load_state_dict(load_state_dict(config.pretrained_model, location="cuda"))
if USE_FP16:
    model = model.half()
model = model.cuda()
ddim_sampler = DDIMSampler(model)
print(f"[VMD AI] precision={'fp16' if USE_FP16 else 'fp32'} | save_memory={save_memory} | "
      f"GPU 사용 {torch.cuda.memory_allocated() / 1024**3:.2f}GB")

from iseg.coarse_mask_refine_util import BaselineModel

iseg_model = BaselineModel().eval()
_weights = torch.load("./iseg/coarse_mask_refine.pth", map_location="cpu")["state_dict"]
iseg_model.load_state_dict(_weights, strict=True)

GPU_LOCK = threading.Lock()  # GPU가 빠듯하므로 한 번에 한 건만 생성


# ---------------------------------------------------------------------------
# 2. VMD Studio용으로 추가한 함수
# ---------------------------------------------------------------------------
def set_seed(seed: int) -> int:
    """원본 데모는 seed를 받기만 하고 적용하지 않았다.
    process_pairs/expand_bbox가 np.random을 쓰므로 random·numpy·torch를 모두 고정한다."""
    if seed is None or seed < 0:
        seed = random.randint(0, 2**31 - 1)
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    return seed


def load_upload(upload: UploadFile) -> np.ndarray:
    """업로드 파일 -> RGB numpy. 휴대폰 사진의 회전 정보(EXIF)를 반영해
    VMD Studio 화면에 보이는 방향과 같은 기준의 좌표가 되도록 한다."""
    data = upload.file.read()
    if not data:
        raise HTTPException(status_code=400, detail=f"빈 파일입니다: {upload.filename}")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail=f"이미지를 읽을 수 없습니다: {upload.filename}")
    return np.asarray(img).copy()


def region_to_mask(height: int, width: int, x: float, y: float, w: float, h: float) -> np.ndarray:
    """VMD Studio 영역(0~1 비율 사각형) -> 0/1 Mask.
    Shape Control OFF에서 AnyDoor는 Mask를 감싸는 사각형만 쓰므로 사각형 영역으로 충분하다."""
    x1 = int(round(min(max(x, 0.0), 1.0) * width))
    y1 = int(round(min(max(y, 0.0), 1.0) * height))
    x2 = int(round(min(max(x + w, 0.0), 1.0) * width))
    y2 = int(round(min(max(y + h, 0.0), 1.0) * height))
    if x2 - x1 < 8 or y2 - y1 < 8:
        raise HTTPException(status_code=400, detail="영역이 너무 작습니다.")
    mask = np.zeros((height, width), dtype=np.uint8)
    mask[y1:y2, x1:x2] = 1
    return mask


def auto_reference_mask(ref_image: np.ndarray, white_threshold: int = 240):
    """흰 배경 상품 사진에서 상품 부분만 1로 만든다.
    잘 안 되면(너무 작거나 거의 전체) 이미지 전체를 Mask로 쓴다."""
    not_white = (ref_image < white_threshold).any(axis=2).astype(np.uint8)
    kernel = np.ones((5, 5), np.uint8)
    not_white = cv2.morphologyEx(not_white, cv2.MORPH_CLOSE, kernel, iterations=2)
    not_white = cv2.morphologyEx(not_white, cv2.MORPH_OPEN, kernel, iterations=1)

    ratio = not_white.mean()
    if ratio < 0.01 or ratio > 0.98:
        return np.ones(ref_image.shape[:2], dtype=np.uint8), "full"
    return not_white, "auto-white-bg"


# ---------------------------------------------------------------------------
# 3. AnyDoor 원본 함수 (run_gradio_demo.py에서 그대로 옮김, 내용 수정 없음)
# ---------------------------------------------------------------------------
def process_image_mask(image_np, mask_np):
    img = torch.from_numpy(image_np.transpose((2, 0, 1)))
    img = img.float().div(255).unsqueeze(0)
    mask = torch.from_numpy(mask_np).float().unsqueeze(0).unsqueeze(0)
    pred = iseg_model(img, mask)["instances"][0, 0].detach().numpy() > 0.5
    return pred.astype(np.uint8)


def crop_back(pred, tar_image, extra_sizes, tar_box_yyxx_crop):
    H1, W1, H2, W2 = extra_sizes
    y1, y2, x1, x2 = tar_box_yyxx_crop
    pred = cv2.resize(pred, (W2, H2))
    m = 3  # maigin_pixel

    if W1 == H1:
        tar_image[y1 + m:y2 - m, x1 + m:x2 - m, :] = pred[m:-m, m:-m]
        return tar_image

    if W1 < W2:
        pad1 = int((W2 - W1) / 2)
        pad2 = W2 - W1 - pad1
        pred = pred[:, pad1:-pad2, :]
    else:
        pad1 = int((H2 - H1) / 2)
        pad2 = H2 - H1 - pad1
        pred = pred[pad1:-pad2, :, :]
    tar_image[y1 + m:y2 - m, x1 + m:x2 - m, :] = pred[m:-m, m:-m]
    return tar_image


def inference_single_image(ref_image, ref_mask, tar_image, tar_mask,
                           strength, ddim_steps, scale, seed, enable_shape_control):
    raw_background = tar_image.copy()
    item = process_pairs(ref_image, ref_mask, tar_image, tar_mask, enable_shape_control=enable_shape_control)

    ref = item["ref"]
    hint = item["hint"]
    num_samples = 1

    control = torch.from_numpy(hint.copy()).float().cuda()
    control = torch.stack([control for _ in range(num_samples)], dim=0)
    control = einops.rearrange(control, "b h w c -> b c h w").clone()

    clip_input = torch.from_numpy(ref.copy()).float().cuda()
    clip_input = torch.stack([clip_input for _ in range(num_samples)], dim=0)
    clip_input = einops.rearrange(clip_input, "b h w c -> b c h w").clone()

    H, W = 512, 512

    autocast = torch.autocast("cuda", dtype=torch.float16, enabled=USE_FP16)
    autocast.__enter__()
    cond = {"c_concat": [control], "c_crossattn": [model.get_learned_conditioning(clip_input)]}
    un_cond = {"c_concat": [control],
               "c_crossattn": [model.get_learned_conditioning([torch.zeros((1, 3, 224, 224))] * num_samples)]}
    shape = (4, H // 8, W // 8)

    if save_memory:
        model.low_vram_shift(is_diffusing=True)

    model.control_scales = ([strength] * 13)
    samples, _ = ddim_sampler.sample(ddim_steps, num_samples,
                                     shape, cond, verbose=False, eta=0,
                                     unconditional_guidance_scale=scale,
                                     unconditional_conditioning=un_cond)

    if save_memory:
        model.low_vram_shift(is_diffusing=False)

    x_samples = model.decode_first_stage(samples)
    autocast.__exit__(None, None, None)
    x_samples = (einops.rearrange(x_samples.float(), "b c h w -> b h w c") * 127.5 + 127.5).cpu().numpy()

    pred = x_samples[0]
    pred = np.clip(pred, 0, 255)[1:, :, :]
    sizes = item["extra_sizes"]
    tar_box_yyxx_crop = item["tar_box_yyxx_crop"]
    tar_image = crop_back(pred, tar_image, sizes, tar_box_yyxx_crop)

    # keep background unchanged
    y1, y2, x1, x2 = item["tar_box_yyxx"]
    raw_background[y1:y2, x1:x2, :] = tar_image[y1:y2, x1:x2, :]
    return raw_background


def process_pairs(ref_image, ref_mask, tar_image, tar_mask, max_ratio=0.8, enable_shape_control=False):
    # ========= Reference ===========
    ref_box_yyxx = get_bbox_from_mask(ref_mask)

    ref_mask_3 = np.stack([ref_mask, ref_mask, ref_mask], -1)
    masked_ref_image = ref_image * ref_mask_3 + np.ones_like(ref_image) * 255 * (1 - ref_mask_3)

    y1, y2, x1, x2 = ref_box_yyxx
    masked_ref_image = masked_ref_image[y1:y2, x1:x2, :]
    ref_mask = ref_mask[y1:y2, x1:x2]

    ratio = np.random.randint(11, 15) / 10
    masked_ref_image, ref_mask = expand_image_mask(masked_ref_image, ref_mask, ratio=ratio)
    ref_mask_3 = np.stack([ref_mask, ref_mask, ref_mask], -1)

    masked_ref_image = pad_to_square(masked_ref_image, pad_value=255, random=False)
    masked_ref_image = cv2.resize(masked_ref_image.astype(np.uint8), (224, 224)).astype(np.uint8)

    ref_mask_3 = pad_to_square(ref_mask_3 * 255, pad_value=0, random=False)
    ref_mask_3 = cv2.resize(ref_mask_3.astype(np.uint8), (224, 224)).astype(np.uint8)
    ref_mask = ref_mask_3[:, :, 0]

    masked_ref_image_compose, ref_mask_compose = masked_ref_image, ref_mask
    ref_image_collage = sobel(masked_ref_image_compose, ref_mask_compose / 255)

    # ========= Target ===========
    tar_box_yyxx = get_bbox_from_mask(tar_mask)
    tar_box_yyxx = expand_bbox(tar_mask, tar_box_yyxx, ratio=[1.1, 1.2])
    tar_box_yyxx_full = tar_box_yyxx

    tar_box_yyxx_crop = expand_bbox(tar_image, tar_box_yyxx, ratio=[1.3, 3.0])
    tar_box_yyxx_crop = box2squre(tar_image, tar_box_yyxx_crop)
    y1, y2, x1, x2 = tar_box_yyxx_crop

    cropped_target_image = tar_image[y1:y2, x1:x2, :]
    cropped_tar_mask = tar_mask[y1:y2, x1:x2]

    tar_box_yyxx = box_in_box(tar_box_yyxx, tar_box_yyxx_crop)
    y1, y2, x1, x2 = tar_box_yyxx

    ref_image_collage = cv2.resize(ref_image_collage.astype(np.uint8), (x2 - x1, y2 - y1))
    ref_mask_compose = cv2.resize(ref_mask_compose.astype(np.uint8), (x2 - x1, y2 - y1))
    ref_mask_compose = (ref_mask_compose > 128).astype(np.uint8)

    collage = cropped_target_image.copy()
    collage[y1:y2, x1:x2, :] = ref_image_collage

    collage_mask = cropped_target_image.copy() * 0.0
    collage_mask[y1:y2, x1:x2, :] = 1.0
    if enable_shape_control:
        collage_mask = np.stack([cropped_tar_mask, cropped_tar_mask, cropped_tar_mask], -1)

    H1, W1 = collage.shape[0], collage.shape[1]

    cropped_target_image = pad_to_square(cropped_target_image, pad_value=0, random=False).astype(np.uint8)
    collage = pad_to_square(collage, pad_value=0, random=False).astype(np.uint8)
    collage_mask = pad_to_square(collage_mask, pad_value=2, random=False).astype(np.uint8)

    H2, W2 = collage.shape[0], collage.shape[1]

    cropped_target_image = cv2.resize(cropped_target_image.astype(np.uint8), (512, 512)).astype(np.float32)
    collage = cv2.resize(collage.astype(np.uint8), (512, 512)).astype(np.float32)
    collage_mask = cv2.resize(collage_mask.astype(np.uint8), (512, 512), interpolation=cv2.INTER_NEAREST).astype(np.float32)
    collage_mask[collage_mask == 2] = -1

    masked_ref_image = masked_ref_image / 255
    cropped_target_image = cropped_target_image / 127.5 - 1.0
    collage = collage / 127.5 - 1.0
    collage = np.concatenate([collage, collage_mask[:, :, :1]], -1)

    item = dict(ref=masked_ref_image.copy(), jpg=cropped_target_image.copy(), hint=collage.copy(),
                extra_sizes=np.array([H1, W1, H2, W2]),
                tar_box_yyxx_crop=np.array(tar_box_yyxx_crop),
                tar_box_yyxx=np.array(tar_box_yyxx_full))
    return item


# ---------------------------------------------------------------------------
# 4. API
# ---------------------------------------------------------------------------
app = FastAPI(title="VMD Studio AI Preview Server", version="0.1.0")


@app.get("/health")
def health():
    """Spring이 AI 서버가 켜져 있는지 확인하는 용도"""
    return {
        "status": "ok",
        "gpu": torch.cuda.get_device_name(0),
        "save_memory": save_memory,
        "precision": "fp16" if USE_FP16 else "fp32",
        "busy": GPU_LOCK.locked(),
    }


@app.post("/generate")
def generate(
    store_image: UploadFile = File(..., description="현재 매장 사진"),
    product_image: UploadFile = File(..., description="상품 이미지 (흰 배경 권장)"),
    x: float = Form(..., description="영역 왼쪽 (0~1)"),
    y: float = Form(..., description="영역 위쪽 (0~1)"),
    w: float = Form(..., description="영역 너비 (0~1)"),
    h: float = Form(..., description="영역 높이 (0~1)"),
    strength: float = Form(1.0),
    steps: int = Form(30),
    scale: float = Form(4.5),
    seed: int = Form(42, description="-1이면 무작위"),
    shape_control: bool = Form(False),
    ref_refine: bool = Form(True, description="상품 Mask 다듬기 (원본 데모는 사실상 항상 켜져 있었음)"),
):
    # 2분 가까이 걸리므로 줄 세우지 않고 바로 거절한다. (Spring 쪽에서 안내 문구 표시)
    if not GPU_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="다른 Preview를 생성 중입니다. 잠시 후 다시 시도해 주세요.")

    try:
        tar_image = load_upload(store_image)
        ref_image = load_upload(product_image)

        tar_mask = region_to_mask(tar_image.shape[0], tar_image.shape[1], x, y, w, h)
        ref_mask, ref_mask_method = auto_reference_mask(ref_image)
        if ref_refine:
            ref_mask = process_image_mask(ref_image, ref_mask)
            ref_mask_method += "+refine"
            if ref_mask.sum() == 0:
                raise HTTPException(status_code=422, detail="상품 영역을 찾지 못했습니다. 흰 배경 상품 사진을 사용해 주세요.")

        used_seed = set_seed(seed)
        torch.cuda.reset_peak_memory_stats()
        started = time.time()

        result = inference_single_image(
            ref_image.copy(), ref_mask.copy(), tar_image.copy(), tar_mask.copy(),
            strength, steps, scale, used_seed, shape_control,
        )

        elapsed = time.time() - started
        peak_gb = torch.cuda.max_memory_allocated() / 1024**3
        print(f"[VMD AI] 생성 완료 {elapsed:.1f}s | {'fp16' if USE_FP16 else 'fp32'} | seed={used_seed} | ref_mask={ref_mask_method} | peak={peak_gb:.2f}GB")

        buffer = io.BytesIO()
        Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).save(buffer, format="PNG")
        return Response(
            content=buffer.getvalue(),
            media_type="image/png",
            headers={
                "X-Generation-Seconds": f"{elapsed:.1f}",
                "X-Seed": str(used_seed),
                "X-Ref-Mask": ref_mask_method,
                "X-Precision": "fp16" if USE_FP16 else "fp32",
            },
        )
    except HTTPException:
        raise
    except torch.cuda.OutOfMemoryError:
        raise HTTPException(status_code=503, detail="GPU 메모리가 부족합니다. 다른 GPU 프로그램을 종료해 주세요.")
    finally:
        torch.cuda.empty_cache()  # 연속 생성 시 메모리가 쌓이는지 관찰 중 (10/27 0.8GB -> 2.1GB)
        GPU_LOCK.release()


if __name__ == "__main__":
    print(f"[VMD AI] AnyDoor 폴더: {ANYDOOR_DIR}")
    print(f"[VMD AI] 테스트 화면: http://127.0.0.1:{PORT}/docs")
    uvicorn.run(app, host="127.0.0.1", port=PORT)
