# 2026-10-01 | Week 1 — 개발환경 구축과 Click Prototype

## 목표

AnyDoor를 연결하지 않은 상태에서, **AnyDoor가 붙어 있다고 가정한 서비스 흐름과 화면**을 먼저 만든다. (1차 미팅 1~2주차 방향)

## 개발환경

| 항목 | 내용 |
| --- | --- |
| OS | Windows 11 (학교 실습실 PC) |
| JDK | Temurin 25 |
| IDE | IntelliJ IDEA Ultimate |
| Framework | Spring Boot 4.1.1 (Gradle) — Spring Web, Spring Data JPA, H2 |
| 저장소 | woosik980201/vmd-studio (Private) |

- Java Backend는 아직 수업에서 배우지 않았지만, 교수님이 Frontend뿐 아니라 Backend까지, AI를 활용해 진도를 내라고 권장하셔서 Spring Boot를 선택했다.

## 결과

화면 5개를 클릭으로 끝까지 따라갈 수 있는 상태:

```
Dashboard → Store Setup → DP Editor → AI Preview → 채택 → DP Plan → 작성 완료 → 공유 → 직원 보기
```

| 항목 | 상태 |
| --- | --- |
| Frontend | HTML / CSS / JavaScript (Spring Boot static 폴더) |
| 데이터 | `sample-data.js` 예시 데이터 (새로고침하면 초기화) |
| Backend API | 미연결 |
| AnyDoor | 미연결 (AI Preview 자리는 Placeholder) |
| DP Editor 영역 | \[임시\] 클릭 시 예시 영역 표시 |

상태 규칙은 경계 상황까지 확인했다: 검토 완료 후 작업 지시를 고치고 바로 공유하면 공유되지 않음.

## 주요 결정

- **명시적 채택** — AI Preview가 나왔다고 자동으로 넘어가지 않고 \[✓ 이 안 채택\]을 눌러야 DP Plan으로 간다. AI가 제안한 채택 확인 팝업은 흐름을 끊는다고 판단해 **넣지 않았다**. (D10)
- **VMD 메모와 작업 지시 분리** — 내부 메모는 직원 보기에서 숨기고, 직원에게는 작업 지시만 보인다. (D7)
- Store Setup 필수 항목을 늘렸다가, 재검토 후 원래 조건(사진 2장 + 상품명 + 품번)으로 되돌렸다.

## 해결한 문제

| 문제 | 원인 | 해결 |
| --- | --- | --- |
| JDK 설치 후 `java` 명령 인식 실패 | 열려 있던 터미널이 설치 전 환경변수를 사용 | 터미널 재시작 |
| setup.html 한글 깨짐 + 스타일 사라짐 | 부분 붙여넣기로 `<head>`의 charset·CSS 링크 누락 | HTML 전체 구조 다시 작성 |
| 숨겨야 할 요소가 보일 수 있음 | CSS `display: flex`가 `hidden` 속성보다 우선 | `[hidden] { display: none !important; }` 전역 규칙 |
| 패키지가 `vmd_studio`로 생성 | Initializr가 Artifact 변경 시 패키지명을 덮어씀 | IntelliJ Refactor → Rename |

## Git

기능 단위 커밋 7개: 개발환경 → 공통 UI → Store Setup → DP Editor → AI Preview → DP Plan → 상태/UI 수정
