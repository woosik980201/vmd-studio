# 개발 기록

날짜순으로 무엇을 했고, 왜 그렇게 판단했고, 무엇이 실패했는지 남깁니다.
기록 형식: Problem → Context → AI 활용 → 사용자 결정 → 구현/실험 → 결과 → 문제 → 개선 → 다음 단계

| 날짜 | 기록 | 핵심 |
| --- | --- | --- |
| 9/28 ~ 10/01 | [AnyDoor 사전 검증 · 1차 미팅 · 기획](2026-09-28_anydoor-poc-and-planning.md) | PoC #03B 한계 → AI Preview는 "배치 참고용" |
| 10/01 | [Week 1 Click Prototype](2026-10-01_week1-click-prototype.md) | 화면 5개, 명시적 채택 |
| 10/12 | [Week 2 Spring Boot Backend](2026-10-12_week2-spring-backend.md) | 서버 저장, 직접 테스트·외부 검토로 찾은 문제 수정, PR #1~#6 |
| 10/16 | [2차 교수 미팅](2026-10-16_2nd-meeting.md) | Python 전환은 필요할 때로 (D19) |
| 10/27 | [AnyDoor 실행 · 속도 진단 · AI 서버](2026-10-27_anydoor-ai-server.md) | 4분 → 2분대, Seed 미적용 발견, PR #7 |
| 10/29 | [Spring ↔ AnyDoor 연결](2026-10-29_spring-anydoor-connection.md) | 버튼 하나로 실제 AnyDoor Preview (152.7초), Mock 단계 가정 2개 발견·수정, PR #9 |

주요 결정 전체는 [decisions.md](../decisions.md)에 있습니다.
