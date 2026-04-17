# AI Chat (Chat-First Shell) 6개월 로드맵

**작성**: 2026-04-17
**상태**: L1 65% · L2 45% · L3 25%
**전략**: L1/L2 표준 추종 + L3 도메인 선도

---

## 전략 3층

| 층 | 전략 | 설명 |
|----|------|------|
| **L1** 인프라·표준 | 철저히 따라감 | AI SDK v6, MCP, UIMessage, RSC 등 |
| **L2** 핵심 UX 패턴 | 빠르게 복제 | Chat shell, Artifact, Tool disclosure 등 |
| **L3** 도메인 특화 | **선도한다** | 교육·컨설턴트·학부모·3자 대화 |

---

## Phase A (2주) — L2 즉시 임팩트

**목표**: 채팅 품질 "일상 ChatGPT 수준"

| # | 작업 | 난이도 | 시간 |
|---|------|--------|------|
| A-1 | 마크다운 + 수식 + 코드 렌더 (react-markdown + remark-gfm + KaTeX + Shiki) | Low | 반일 |
| A-2 | Reasoning 접기/펼치기 ("Thought for Ns" chip) | Low | 2h |
| A-3 | 사이드바 hover 액션 (rename / pin / archive / delete) | Low | 4h |
| A-4 | 접근성 (aria-live, role=log) + 다크모드 토글 | Low | 4h |
| A-5 | Adaptive pane (3→2→1) + 모바일 drawer | Med | 반일 |

**산출**: ChatGPT 2024 수준 일상 품질 도달.

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

**목표**: 외부 AI 생태계 플러그인 가능. Artifact 본격화.

| # | 작업 | 난이도 | 시간 |
|---|------|--------|------|
| C-1 | MCP 서버 래핑 (`@modelcontextprotocol/sdk`) + Streamable HTTP | High | 1w |
| C-2 | Artifact 버전 관리 (`artifacts` 테이블 + 버전 탭) | High | 1w |
| C-3 | Artifact Canvas 편집 (성적 수정 / 플랜 편집) | High | 1w |
| C-4 | Citation + sources 패널 | Med | 3d |

**산출**: Claude Desktop·Cursor 등 외부 AI가 에듀엣톡 tool 호출. ChatGPT Canvas 수준 아티팩트.

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
| 1 | react-markdown + remark-gfm | ⏳ | 이미 설치, 활성화만 남음 |
| 2 | KaTeX + remark-math + rehype-katex | ❌ | 수학 상담 필수 |
| 3 | Shiki | ❌ | 코드 설명 시 하이라이트 |
| 4 | @modelcontextprotocol/sdk | ❌ | 외부 AI 생태계 연결 |
| 5 | cmdk | ❌ | Cmd+K 표준 |
| 6 | @vercel/kv + resumable-stream | ❌ | 긴 응답 중단 복구 |
| 7 | UIMessage metadata 활용 | ❌ | duration/model/reasoning |
| 8 | Web Speech API | ❌ | 음성 입력 |
| 9 | View Transitions API | ❌ | 부드러운 패널 전환 |
| 10 | framer-motion | ✅ 설치됨 | 스트리밍 애니메이션 |

---

## 타임라인 요약

```
Week 1-2   │ Phase A        │ ChatGPT 수준 도달
Week 3-5   │ Phase B        │ 2026 표준 완성
Week 6-9   │ Phase C (+D)   │ MCP + Memory 진입
Week 10-17 │ Phase D + E    │ Gen 4 + 도메인 차별화
Week 18-26 │ Phase E 완성   │ L3 선도 포지션
```

**6개월 후 목표**: 에듀엣톡 = 교육 도메인 Gen 4 AI 파트너. 빅테크 L1/L2 표준 + 교육 L3 독점.
