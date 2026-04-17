# AI Chat (Chat-First Shell) 6개월 로드맵

**작성**: 2026-04-17
**최근 개정**: 2026-04-17 (Phase T 축 신설)
**상태**: L1 70% · L2 80% · L3 25% (Phase A 완주 후)
**전략**: L1/L2 표준 추종 + L3 도메인 선도 + **GUI↔내러티브 전환 축**

---

## 전략 3층 + 전환 축

| 층 | 전략 | 설명 |
|----|------|------|
| **L1** 인프라·표준 | 철저히 따라감 | AI SDK v6, MCP, UIMessage, RSC 등 |
| **L2** 핵심 UX 패턴 | 빠르게 복제 | Chat shell, Artifact, Tool disclosure 등 |
| **L3** 도메인 특화 | **선도한다** | 교육·컨설턴트·학부모·3자 대화 |
| **전환 축 (Bridge)** | 합의된 축 | 기존 GUI ↔ AI 내러티브 환경을 자연스럽게 오가는 인터페이스 |

> **전환 축**은 2026-04-17 세션에서 합의. 에듀엣톡은 "기존 GUI 환경"(대시보드/플랜/성적/분석 등)과 "AI 내러티브 환경"(/ai-chat)을 동시에 유지하며, 두 환경의 인터페이스 개념을 확장 중. Phase T가 그 축의 전용 단계이고, D유형(Artifact Canvas 편집)은 Phase C에서 이어받음.

---

## 전환 4유형 (Bridge 관점)

| 유형 | 방향 | 본 로드맵 위치 |
|------|------|----------------|
| **A. GUI → 내러티브 진입점** | /scores 등에서 "AI와 대화" 버튼 + 컨텍스트 승계 | **Phase T-1** |
| **B. 내러티브 → GUI 복귀 개선** | navigateTo 결과에 "대화 계속" 플로팅, Artifact에서 원본 GUI 점프 | **Phase T-2** |
| **C. 양방향 토글** | 같은 페이지 "GUI 보기 ↔ 대화 보기" 모드 전환 | **Phase T-3** |
| **D. 내러티브 안에 GUI 재현** | Artifact 패널이 편집 가능한 Canvas (성적 수정/플랜 편집) | **Phase C-3** (기존) |

---

## Phase A (2주) — L2 즉시 임팩트 ✅ 완료 (2026-04-17)

**목표**: 채팅 품질 "일상 ChatGPT 수준"

| # | 작업 | 난이도 | 시간 | 상태 |
|---|------|--------|------|------|
| A-1 | 마크다운 + 수식 + 코드 렌더 (react-markdown + remark-gfm + KaTeX + Shiki) | Low | 반일 | ✅ |
| A-2 | Reasoning 접기/펼치기 ("Thought for Ns" chip) | Low | 2h | ✅ |
| A-3 | 사이드바 hover 액션 (rename / pin / archive / delete) | Low | 4h | ✅ |
| A-4 | 접근성 (aria-live, role=log) + 다크모드 토글 | Low | 4h | ✅ |
| A-5 | Adaptive pane (3→2→1) + 모바일 drawer | Med | 반일 | ✅ |

**산출**: ChatGPT 2024 수준 일상 품질 도달. 커밋 3df3138d ~ 6178c02d.

---

## Phase T (1-2주) — Transition Bridge ✅ v0 완료 (2026-04-17)

**목표**: 기존 GUI 환경과 AI 내러티브 환경을 자연스럽게 오가는 **전환 UX** 구축.

**배경**: Phase A 완료 시점 기준으로, 두 환경 간 교차점이 `navigateTo`(단방향 점프) + `getScores`(데이터 소환) 2개뿐. 사용자 실제 흐름(학생이 /scores에서 "이 성적 의미 물어보기" → 컨설턴트가 /admin/students/xxx에서 "이 학생 분석 대화")을 지원하려면 전용 축 필요.

**전략 3층 매핑**: L2 복제(ChatGPT "Ask about this" 패턴) + L3 선도(교육 도메인 컨텍스트 승계).

| # | 작업 | 난이도 | 시간 | 대응 유형 | 상태 | 커밋 |
|---|------|--------|------|-----------|------|------|
| T-1 | 기존 GUI 페이지에 "AI와 대화" 버튼 + 컨텍스트 프리필 | Med | 3d | A | ✅ | 9a9bfc03 |
| T-2 | navigateTo 결과 개선 + Artifact "원본 보기" 링크 | Low | 2d | B | ✅ | 02668ce7 |
| T-3 | 우측 슬라이드 패널 "이 화면에서 대화" (split 모드) | Med | 2d | C | ✅ (v0) | 42761ab1 |
| T-4 | 전환 시 컨텍스트 승계 규약 (URL + 검증 + 주입) | Med | 1d | 공통 | ✅ | 0366de3c |
| T-1 후속 | admin-record 리졸버 + 진입점 | Low | 반일 | A | ✅ | ac555eef |
| 핸드오프 #2 | tenant RLS 확장 (admin/consultant 읽기) | Low | 반일 | 공통 | ✅ | ac555eef |

**산출**: 두 환경 사이의 마찰 0 근접. 학생·컨설턴트가 "필요한 데이터 → 자연어 질문" 흐름을 중단 없이 연결.

**v0 미포함 (v1 승격)**:
- T-3 모바일 bottom sheet
- #3 admin `/scores` navigateTo 경로 매핑 (navigateTo tool role-aware 리팩터 필요)

**산출 후 L2/L3 수치**: L2 80→90, L3 25→45.

---

## Phase B (3주) — L1 업그레이드 + L2 고급

**목표**: 2026 표준 스펙 완성

| # | 작업 | 난이도 | 시간 |
|---|------|--------|------|
| B-1 | UIMessage metadata (duration, model, tool latency) 주입 | Low | 1d |
| B-2 | Cmd+K 팔레트 (cmdk) — 검색·이동·액션 통합 | Med | 2d |
| B-3 | Slash `/` / @mentions / # tags — composer 확장 | Med | 2d |
| B-4 | HITL approval 표준 컴포넌트 `<InlineConfirm>` | Med | 1d |
| B-5 | 모바일 bottom sheet (artifact) | Med | 1d |
| B-6 | 이미지 첨부 + paste + drag-drop | Med | 1d |

**산출**: Cursor/Claude.ai와 UX 격차 소멸.

---

## Phase C (1개월) — MCP + 고급 Artifact

**목표**: 외부 AI 생태계 플러그인 가능. Artifact 본격화. **전환 유형 D** 완성 지점.

| # | 작업 | 난이도 | 시간 | 비고 |
|---|------|--------|------|------|
| C-1 | MCP 서버 래핑 (`@modelcontextprotocol/sdk`) + Streamable HTTP | High | 1w | |
| C-2 | Artifact 버전 관리 (`artifacts` 테이블 + 버전 탭) | High | 1w | |
| C-3 | Artifact Canvas 편집 (성적 수정 / 플랜 편집) | High | 1w | **전환 유형 D** — 내러티브 안에서 GUI 재현 |
| C-4 | Citation + sources 패널 | Med | 3d | |

**산출**: Claude Desktop·Cursor 등 외부 AI가 에듀엣톡 tool 호출. ChatGPT Canvas 수준 아티팩트. Phase T에서 시작된 전환 축의 최종 완성(D).

---

## Phase D (1개월) — Agent + Memory (Gen 4 진입)

**목표**: 상주·기억. 세션을 넘는 정체성.

| # | 작업 | 난이도 | 시간 |
|---|------|--------|------|
| D-1 | Agent 추상화 (`ToolLoopAgent`) 도입 + multi-step | High | 4d |
| D-2 | Agent Status Bar (하단 live tool 실행 표시) | Low | 2d |
| D-3 | Memory Panel (ChatGPT Memory 스타일, 편집 가능) | Med | 4d |
| D-4 | mem0 OSS + Supabase pgvector 장기 기억 | High | 2w |
| D-5 | Resumable streaming (Upstash Redis + @vercel/kv) | Low | 2d |

**산출**: "3년 기억하는 AI 컨설턴트" 기반. Gen 4 진입.

---

## Phase E (2개월) — L3 도메인 차별화 (북극성)

**목표**: 빅테크가 못 하는 교육 특화. 차별화 지점.

| # | 작업 | 난이도 | 시간 |
|---|------|--------|------|
| E-1 | 추가 tool 5종 (createPlan, findGuide, analyzeRecord, listStudents, scheduleMeeting) | Med | 2w |
| E-2 | Persona 라우터 분리 (`/api/chat/student` vs `/admin/consultant`) | Med | 1w |
| E-3 | Multi-student 컨설턴트 Workspace (학생 비교 아티팩트) | High | 2w |
| E-4 | Sensitivity 표시 (성적·생기부 공유 경고) | Low | 3d |
| E-5 | Background agent (성적 변동·출결 이상 감지 선제 알림) | High | 1w |
| E-6 | Voice 입력 (Web Speech API, 학생용) | Med | 3d |
| E-7 | 3자 대화 (학생·학부모·컨설턴트 shared thread) | High | 2w |

**산출**: 교육 도메인에서 ChatGPT가 못 하는 것을 제공. 도메인 확립.

---

## L1 표준 채택 체크리스트

| # | 표준 | 채택 | 이유 |
|---|------|------|------|
| 1 | react-markdown + remark-gfm | ✅ | A-1에서 채택 (Markdown.tsx) |
| 2 | KaTeX + remark-math + rehype-katex | ✅ | A-1에서 채택 |
| 3 | Shiki | ✅ | A-1 동적 import + A-4 테마 스위칭 |
| 4 | @modelcontextprotocol/sdk | ❌ | 외부 AI 생태계 연결 (Phase C) |
| 5 | cmdk | ❌ | Cmd+K 표준 (Phase B-2) |
| 6 | @vercel/kv + resumable-stream | ❌ | 긴 응답 중단 복구 (Phase D-5) |
| 7 | UIMessage metadata 활용 | ❌ | duration/model/reasoning (Phase B-1) |
| 8 | Web Speech API | ❌ | 음성 입력 (Phase E-6) |
| 9 | View Transitions API | ❌ | 부드러운 패널 전환 |
| 10 | framer-motion | ✅ | 설치됨 (미사용, 향후 스트리밍 애니메이션) |

---

## 타임라인 요약 (Phase T 삽입 반영)

```
Week 1-2   │ Phase A ✅          │ ChatGPT 수준 도달 (2026-04-17 완료)
Week 3-4   │ Phase T 🆕          │ GUI↔내러티브 전환 브리지 (A/B/C 유형)
Week 5-7   │ Phase B             │ 2026 표준 완성 (Cmd+K, slash, HITL, 모바일)
Week 8-11  │ Phase C (+D 유형)   │ MCP + Memory + Artifact Canvas 편집
Week 12-19 │ Phase D + E         │ Gen 4 + 도메인 차별화
Week 20-26 │ Phase E 완성        │ L3 선도 포지션
```

**6개월 후 목표**: 에듀엣톡 = 교육 도메인 Gen 4 AI 파트너. 빅테크 L1/L2 표준 + **GUI↔내러티브 전환 축** + 교육 L3 독점.

---

## 개정 이력

- **2026-04-17 (초안)**: Phase A~E 5단계 수립
- **2026-04-17 (Phase A 완료 + Phase T 신설)**:
  - Phase A 5단계 전부 완주 표시
  - "GUI↔내러티브 전환 축"이 초안에서 누락됨을 식별 → **Phase T (Transition Bridge)** 신설
  - 전환 4유형(A/B/C/D) 명시. A/B/C는 Phase T, D는 Phase C-3로 배치
  - 배경: `feedback_ai-narrative-ui-strategy.md` "AI 내러티브 환경으로 전환 중" 원칙을 UX 축으로 구체화
- **2026-04-17 (Phase T v0 완주)**:
  - T-4(규약) → T-1(학생 진입) → T-2(복귀) → T-3(split) → T-1 후속(admin-record) + 핸드오프 #2 RLS 순차 완료
  - 6 커밋 (`0366de3c`, `9a9bfc03`, `02668ce7`, `42761ab1`, `ac555eef`, `20260417600000~700000` 마이그레이션 2건)
  - Phase T 축 실측 진입. gemma4:31b 모델 전환 실측 병행 (ollama 로컬)
