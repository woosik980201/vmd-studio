# 2026-09-28 ~ 10-01 | AnyDoor 사전 검증 · 1차 교수 미팅 · 기획

## 1. AnyDoor 로컬 실행 (9/28, 1차 미팅 전 개인 검증)

- Windows + RTX 3080에서 AnyDoor-for-windows를 로컬 실행 (Conda `anydoor`, Python 3.8, PyTorch 2.0 + CUDA 11.8, Gradio 데모)
- Reference + Mask + Background + Mask 입력으로 이미지 객체 합성 성공 → 입력 구조를 미리 이해

## 2. 1차 교수 미팅 (9/29)

교수님이 제시한 진행 방향:

| 기간 | 단계 |
| --- | --- |
| 1~2주 | Java / HTML 등 수업에서 배운 방식으로 Web UI (AnyDoor는 연결하지 않고 가정) |
| 2~4주 | Python 기반 Web / App |
| 4~8주 | AnyDoor 학습 · 실제 연동 · 테스트 · 보고서 |

- 팀은 AnyDoor라는 공통 기술을 공유하되, **참여자마다 다른 서비스 카테고리**를 정해 구현 (예시: 가구 배치, 관광지 합성, 퍼스널 컬러)
- 주 1회 정기 미팅, 진행 과정과 회의 내용을 지속적으로 기록
- **Notion처럼 Git도 관리하라**는 말씀도 이때 있었다 (→ 10/27 저장소 문서화 시작, [10/27 기록](2026-10-27_anydoor-ai-server.md) 참고)

## 3. 주제 선정 — VMD Studio

기술에서 출발하지 않고 **직접 겪은 문제 중 이미지 합성으로 풀 가치가 있는 것**을 찾았다.

- DIESEL **VMD 인턴**: 본사 매뉴얼과 매장 재고가 달라 대체 상품을 판단해야 했고, 바꿔 보기 전에는 결과를 머릿속으로만 상상했다.
- Tom Greyhound **매장 직원**(VMD 직무 아님): VM 사진을 Band로 공유했지만 최종 모습이 잘 전달되지 않았다.

## 4. VMD 상황 PoC #01~#03

날짜: 9/29 이후 \[확인 필요: 정확한 날짜\]
설정: Control Strength 1 · Steps 30 · Guidance 4.5 · Seed 42 · Refine OFF · Shape Control OFF

> ⚠️ **10/27 정정**: 원본 Gradio 데모는 Seed를 적용하지 않아 실제로는 고정되지 않았고, Refine OFF도 실제로는 켜져 있었을 가능성이 있다. 관찰 자체가 무효는 아니지만 비교에 무작위성이 섞여 있었다.

| 실험 | 바꾼 조건 | 관찰 | 다음 판단 |
| --- | --- | --- | --- |
| #01 가방 독립 배치 | Mask 크기, Shape Control | Mask 크기로 위치·크기를 조절할 가능성. Shape Control ON에서 Artifact | VMD가 영역을 직접 지정하는 UI |
| #02 빈 공간에 의류 삽입 | 평면 상품 이미지, Mask 확장 | 공간에 떠 있는 듯 부자연 | 교체 방식 시험 |
| #03A 그래픽 티 → 무지 티 교체 | 의류 영역만 Mask, 행거는 배경 | 행거·목 관계, 어깨선·주름 비교적 자연 | 기존 DP 교체 Workflow |
| #03B 그래픽 SKU 보존 | 흰 그래픽 티 Reference | 그래픽·글자 변형, **없는 팔 생성** | AI Preview를 상품 확인 수단으로 쓰면 안 됨 |

- #03A·#03B는 실제 매장 사진이 아니라 상품 사진 배경이었다 (10/05 확인 후 정정). 실제 매장 사진 교체는 연동 단계 검증 항목.
- 소수의 실험이므로 AnyDoor 전체 성능으로 일반화하지 않는다.

## 5. 설계로 이어진 판단

- **#03B 한계 → AI Preview는 "배치 참고용"** (D4). 기능을 포기하지 않고, DP Plan에 실제 상품 이미지·품번을 함께 보여 주는 UX로 보완했다.
- #02 → #03A: 빈 공간 생성보다 **현재 DP에서 기존 상품을 교체**하는 흐름 중심 (D3)

## 6. 기획·설계 문서 (10/01)

8주 로드맵, 기능 명세 v0.2, Low-Fidelity Wireframe v0.2, Prototype Architecture v0.1 작성.
주요 결정: 1 Task = 사진 1 + 영역 1 + 상품 1 (D5), 상태 3단계 (D6), DP Plan 두 상태 (D7), `PreviewGenerator` 분리 (D9). → [decisions.md](../decisions.md)
