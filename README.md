# VMD Studio

> 매장 DP를 실제로 바꾸기 전에, 현재 매장 사진 위에서 변경 결과를 AI로 미리 보고
> VMD가 확정한 작업 계획을 매장 직원과 공유하는 VMD 업무 지원 서비스

미래내일 일경험 프로젝트형 · 팀 AIG(AnyImageGeneration) · 제안 기업 ㈜큐빅테크
공식 프로젝트명 「마스크 기반의 영상 합성 기술 구현」(8주)에서, 개인 서비스 카테고리로 진행하는 구현입니다.
(`VMD Studio`는 작업명이며 최종 서비스명은 미확정입니다.)

---

## 왜 만드는가

패션 리테일에서 VMD 인턴(DIESEL)과 매장 직원(Tom Greyhound)으로 일하며 겪은 문제에서 출발했습니다.

- VMD는 현재 매장 사진, 본사 가이드, 입고 상품을 보며 DP 변경안을 계획하지만, **상품을 실제로 옮기기 전에는 결과를 볼 수 없습니다.**
- 확정한 작업을 매장 직원에게 전달할 때도 텍스트와 상품 자료만으로는 **최종 모습이 잘 전달되지 않습니다.**

## 설계 원칙

- **Human-in-the-loop** — AI가 "최적의 DP"를 정하지 않습니다. VMD가 판단하고, AI는 그 판단을 빠르게 시각화합니다.
- **AnyDoor = AI Preview Engine** — 서비스 전체가 아니라 `매장 사진 + 상품 이미지 + VMD가 지정한 영역 → 변경 예상 이미지`를 만드는 한 단계입니다.
- **AI Preview는 "배치 참고용"** — 사전 실험에서 그래픽·글자 변형과 없는 팔이 생기는 사례를 확인했습니다. 그래서 매장 공유용 DP Plan에는 AI Preview와 함께 **실제 상품 이미지·품번·작업 지시**를 같은 크기로 보여 줍니다.

## 서비스 흐름

```
Dashboard → Store Setup → DP Editor → AI Preview → [채택] → DP Plan → [작성 완료] → [매장에 공유] → 직원 보기
            매장 사진·상품    바꿀 영역 지정   Before/After    VMD가 직접     작업 지시
```

| 화면 | 역할 |
| --- | --- |
| Dashboard | 매장별 작업과 상태(작업 중 / 검토 완료 / 공유 완료) |
| Store Setup | 매장 사진, 상품 이미지, 상품명·품번(필수), VMD 메모(내부용) |
| DP Editor | 사진 위에 바꿀 영역을 드래그로 지정 (이동·크기 조절, 0~1 비율로 저장) |
| AI Preview | Before / After 비교, 생성 조건 표시, **명시적 채택** |
| DP Plan | Before · AI Preview(배치 참고용) · 실제 상품(SKU 확인 기준) + 작업 지시. VMD 화면과 직원 보기를 한 화면의 두 상태로 운영 |

## 구조

```
브라우저 (HTML/CSS/JS)
   │  REST /api/tasks
   ▼
Spring Boot (:8080) ── H2 (data/) · 이미지 파일 (uploads/)
   │
   └─ PreviewGenerator (인터페이스)
        ├─ MockPreviewGenerator      현재 사용 중 (고정 예시 이미지)
        └─ AnyDoorPreviewGenerator   다음 단계 ──HTTP──▶ AI Preview Server (FastAPI, :8000)
                                                          └─ AnyDoor (PyTorch, RTX 3080)
```

AI 부분을 `PreviewGenerator`로 분리해 두어, AnyDoor를 붙일 때 서비스 전체를 다시 만들지 않고 구현체만 추가합니다.

## 폴더

| 경로 | 내용 |
| --- | --- |
| `src/main/java/com/aig/vmdstudio/task` | 작업(Task) 저장·상태 규칙·REST API |
| `src/main/java/com/aig/vmdstudio/preview` | `PreviewGenerator` 인터페이스와 Mock 구현 |
| `src/main/java/com/aig/vmdstudio/storage` | 업로드 이미지 저장 |
| `src/main/resources/static` | 화면 5개 (HTML/CSS/JS) |
| `ai-server/vmd_ai_server.py` | AnyDoor 전용 Python API 서버 |
| `docs/` | 개발 기록과 주요 결정 |

## 실행

**웹 서비스 (Spring Boot)** — Java 25, IntelliJ에서 `VmdStudioApplication` 실행 → <http://localhost:8080>

- 처음 실행하면 예시 작업 3개가 들어갑니다. 처음 상태로 되돌리려면 서버를 끄고 `data/` 폴더를 지웁니다.
- 업로드 이미지(`uploads/`)와 DB(`data/`)는 Git에 올라가지 않습니다.

**AI Preview 서버 (AnyDoor)** — NVIDIA GPU와 AnyDoor 실행 환경(모델 가중치 포함)이 있는 PC에서만 동작합니다.

```
conda activate anydoor
cd ai-server
python vmd_ai_server.py
```

- 테스트 화면: <http://127.0.0.1:8000/docs> (`GET /health`, `POST /generate`)
- AnyDoor 폴더 위치가 다르면 환경 변수 `ANYDOOR_DIR`을 지정합니다.
- Gradio 데모와 동시에 켜지 않습니다 (GPU 메모리 10GB가 이미 빠듯함).

## 현재 상태 (2026-10-27)

| 단계 | 상태 |
| --- | --- |
| 기획·설계 (기능 명세, Wireframe, Architecture) | ✅ 10/01 |
| Week 1 Click Prototype (화면 5개) | ✅ 10/01 |
| Week 2 Spring Boot Backend 연결 (PR #1~#6) | ✅ 10/12 |
| AnyDoor AI Preview 서버 (PR #7) | ✅ 10/27 — Swagger에서 생성 성공, 약 2분 30초~3분 |
| Spring ↔ AI 서버 연결 | 🔜 다음 단계 |

**아직 아닌 것** — 웹 화면의 AI Preview는 아직 Mock입니다. 생성 속도 개선(fp16), 실제 공유 전달 방식(링크·Band 등)은 미구현입니다.

## 기록

- [개발 기록 (docs/devlog)](docs/devlog/) — 날짜별로 무엇을 했고, 왜 그렇게 판단했고, 무엇이 실패했는지
- [주요 결정 (docs/decisions.md)](docs/decisions.md) — D1~D21
- 상세 기록·캡처는 프로젝트 Notion에 있습니다 (비공개). 매장 사진이 포함된 캡처는 공개 가능 여부 확인 전까지 저장소에 올리지 않습니다.

## AI 활용

Claude(구현 보조·오류 분석·문서화)와 ChatGPT(문제 정의·설계 검토)를 함께 활용했습니다.
**문제 발견, 실행 검증, 기능 채택·제외와 병합 판단은 직접 했습니다.** AI 제안을 거절하거나 수정한 사례는 `docs/decisions.md`에 남깁니다.
