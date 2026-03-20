# 생기부 시스템 구현 로드맵

> 작성일: 2026-03-17
> 기반 문서: `student-record-implementation-plan.md` v5, `student-record-extension-design.md` v6
> 목적: Phase별 구현 순서, 의존관계, 산출물, 검증 기준을 한눈에 파악

---

## 1. 전체 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                        생기부 트랙 (메인)                            │
│                                                                       │
│  ┌─────┐  ┌─────┐  ┌─────┐                                         │
│  │ 1a  │→│ 1b  │  │ 1c  │  DB 마이그레이션 (3단계 분할)            │
│  │핵심6│  │보조5│  │확장9│                                          │
│  └──┬──┘  └─────┘  └──┬──┘                                         │
│     └────────┬────────┘                                              │
│           ┌──┴──┐                                                    │
│           │  2  │  도메인 레이어 + 자동 테스트                       │
│           └──┬──┘                                                    │
│           ┌──┴──┐                                                    │
│           │  3  │  관리자 UI 기록 탭 (탭별 lazy loading)             │
│           └──┬──┘                                                    │
│        ┌─────┼─────┐                                                 │
│     ┌──┴──┐┌─┴─┐┌──┴──┐                                            │
│     │ 3.5 ││ 4 ││ 4.5 │  보조 UI + 학생/학부모 뷰 + PDF Import     │
│     └─────┘└─┬─┘└─────┘                                            │
│           ┌──┴──┐                                                    │
│           │  5  │  진단 DB + 교과이수적합도                          │
│           └──┬──┘                                                    │
│           ┌──┴──┐                                                    │
│           │ 5.5 │  AI 역량 태그 자동 제안                            │
│           └──┬──┘                                                    │
│           ┌──┴──┐                                                    │
│           │  6  │  AI 종합 진단 + 스토리라인 분석                    │
│           └──┬──┘                                                    │
│        ┌─────┼─────┐                                                 │
│     ┌──┴──┐┌─┴─┐   │                                               │
│     │ 6.5 ││ 7 │   │  경보 확장 + 보완전략                          │
│     └─────┘└─┬─┘   │                                               │
│           ┌──┴──┐   │                                               │
│           │ 8.x │   │  대학 입시 DB + 배치 분석                      │
│           └──┬──┘   │                                               │
│           ┌──┴──┐   │                                               │
│           │  9  │←──┘  AI 활동 지원 + Report                        │
│           └──┬──┘                                                    │
│           ┌──┴──┐                                                    │
│           │ 10  │  버전 이력 + 향후 확장                             │
│           └─────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        CMS 트랙 (독립, 병행)                         │
│                                                                       │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐                           │
│  │ C1 │→│ C2 │→│ C3 │→│ C4 │→│ C5 │                              │
│  │DB  │  │CRUD│  │AI  │  │버전│  │학생│                             │
│  │이관│  │에디│  │생성│  │품질│  │APP │                             │
│  └────┘  │터  │  │검증│  └────┘  └────┘                            │
│          └────┘  └────┘                                             │
│  ※ 메인 트랙 Phase 3 이후 착수 가능                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│               에이전트 트랙 (독립, AI SDK v6 기반)                    │
│               docs/domain-agent-architecture.md 참조                  │
│                                                                       │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐                           │
│  │ A  │→│ B  │→│ C  │  │ D  │  │ E  │                              │
│  │SDK │  │오케│  │CMS │  │입시│  │면접│                              │
│  │마이│  │스트│  │RAG │  │배치│  │리포│                              │
│  │그레│  │레이│  │    │  │    │  │트  │                              │
│  │이션│  │터  │  └────┘  └────┘  └────┘                            │
│  └────┘  └────┘  ↑C1     ↑8.1    ↑B+D                              │
│  ※ Phase A: 즉시 착수 가능 / C: CMS C1 의존 / D: Phase 8.1 의존    │
│  ※ 6개 전문 에이전트 + 1 오케스트레이터 (라우터 패턴)                │
│  ※ 기술: Vercel AI SDK v6, pgvector, gemini-embedding-001           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 마일스톤 요약

| 마일스톤 | Phase | 핵심 가치 | 사용자 영향 |
|----------|-------|-----------|------------|
| **M1: 기록 시스템 MVP** | 1a~3 | 세특/창체/행특/독서 수동 CRUD | 컨설턴트가 생기부를 시스템에 입력 가능 |
| **M2: 컨설팅 도구** | 3.5~4 | 지원전략 + 학부모 뷰 + 최저 시뮬 | 학부모 상담, 수시 전략 수립 |
| **M3: AI 진단** | 5~6.3 | 역량 태그 + 인라인 하이라이트 + 종합 진단 + 경보 | AI가 세특을 분석하여 역량 근거를 시각적으로 제시, 컨설턴트 검토/확정 |
| **M4: 대입 전략** | 7~8.6 | 배치분석 + 환산엔진 + 졸업생 DB | 정시 배치표 자동 생성 |
| **M5: AI 고도화** | 9 | 활동 요약서 + Report 생성 | 수시 Report 자동 발행 (**9.1~9.4 완료**) |
| **M-CMS: 탐구 가이드** | C1~C5 | 7,836건 가이드 DB + AI 생성 | Access DB 완전 대체 (**C1~C5 완료**) |
| **M-Agent: 도메인 에이전트** | A~E | 6개 전문 에이전트 + 오케스트레이터 | 자연어 컨설팅 AI 어시스턴트 (**A~E + 운영 안정화 완료**) |

---

## 3. Phase별 상세

### Phase 1a — DB: 핵심 기록 테이블

> **목표**: 생기부 핵심 데이터 구조 확립

| 항목 | 내용 |
|------|------|
| **테이블** | seteks, personal_seteks, changche, haengteuk, reading, subject_pairs (6개) |
| **의존** | 없음 (시작점) |
| **산출물** | `supabase/migrations/20260331000000_student_record_core.sql` |
| **포함 사항** | RLS 정책 17개, updated_at 트리거 5개, deleted_at 컬럼, 다형 참조 정리 트리거 4개, 헬퍼 함수 2개 (`rls_check_student_own`, `cleanup_polymorphic_refs`) |

**검증**: ✅ 2026-03-17 완료
- [x] `supabase db push` → 6개 테이블 생성 확인
- [x] `npx supabase gen types typescript --linked` → 타입 재생성 (21건 참조)
- [x] `pnpm build` 성공
- [ ] RLS: 다른 tenant 데이터 접근 불가 확인 (Phase 2 통합 테스트에서 검증)

---

### Phase 1b — DB: 보조 기록 테이블

> **목표**: 출결/수상/봉사/징계/지원결과 데이터 구조

| 항목 | 내용 |
|------|------|
| **테이블** | attendance, awards, volunteer, disciplinary, applications (5개) |
| **의존** | Phase 1a 이후 (독립 rollback 가능) |
| **산출물** | `supabase/migrations/20260331100000_student_record_supplementary.sql` |
| **핵심 설계** | applications: round 11종 세분화, interview_date, score_type(가채점/실채점), current_competition_rate |

**검증**: ✅ 2026-03-17 완료
- [x] `supabase db push` → 5개 테이블 생성 확인
- [x] applications round CHECK 11개 값 검증
- [x] `database.types.ts` 재생성 (36건 참조)
- [x] `pnpm build` 성공

---

### Phase 1c — DB: 확장 기능 테이블

> **목표**: 스토리라인, 로드맵, 최저 시뮬, 고교 프로파일 등 확장 구조

| 항목 | 내용 |
|------|------|
| **테이블** | storylines, storyline_links, roadmap_items, reading_links, interview_questions, min_score_targets, min_score_simulations, school_profiles, school_offered_subjects (9개) |
| **의존** | Phase 1a (storyline_links가 seteks 참조) |
| **산출물** | `supabase/migrations/20260331200000_student_record_extended.sql` |
| **핵심 설계** | school_offered_subjects: JSONB 대신 junction 테이블 (subjects FK 보장) |

**검증**: ✅ 2026-03-17 완료
- [x] `supabase db push` → 9개 테이블 생성 확인
- [x] school_offered_subjects FK 무결성 (subjects, school_profiles 참조)
- [x] `database.types.ts` 재생성 (68건 참조)
- [x] `pnpm build` 성공

---

### Phase 2 — 도메인 레이어 + 자동 테스트

> **목표**: 비즈니스 로직 계층 + 결정론적 엔진 100% 테스트 커버리지

| 항목 | 내용 |
|------|------|
| **의존** | Phase 1a+1b+1c |
| **산출물 (도메인)** | types.ts, constants.ts, validation.ts, repository.ts, service.ts, competency-repository.ts, diagnosis-repository.ts, storyline-repository.ts, roadmap-repository.ts, school-profile-repository.ts |
| **산출물 (엔진)** | grade-normalizer.ts, min-score-simulator.ts, alumni-search.ts, interview-conflict-checker.ts |
| **산출물 (테스트)** | validation.test.ts (30+), grade-normalizer.test.ts (15+), min-score-simulator.test.ts (20+) |
| **파일 수** | ~15개 |

**테스트 커버리지 결과**: ✅ 2026-03-17 완료, 2026-03-18 바이트 검증 개선
```
validation.test.ts       — 41 tests ✅  (NEIS 바이트, 이모지 감지, 줄바꿈 2B, 바이트 기준 검증, 한영 혼합)
grade-normalizer.test.ts — 34 tests ✅  (9→5, 5→9, 범위, normalizeGrade, 교육과정 판별)
min-score-simulator.test.ts — 14 tests ✅  (grade_sum, 한국사, none, what-if, 영향도 분석)
```

**산출물 (12개 파일)**:
```
lib/domains/student-record/
├── types.ts, constants.ts, validation.ts
├── grade-normalizer.ts, min-score-simulator.ts, interview-conflict-checker.ts
├── repository.ts, service.ts, index.ts
└── __tests__/ (validation 41 + grade-normalizer 34 + min-score-simulator 14 = 89 tests)
```

**검증**: ✅
- [x] `pnpm test` → student-record 89개 테스트 전체 통과
- [x] `pnpm build` → 성공
- [x] constants.ts: 42개 루브릭 질문, 18개 계열별 추천교과, 환산표, 라벨맵 확인

---

### Phase 3 — 관리자 UI 기록 탭

> **목표**: 컨설턴트가 학생 생기부를 입력/편집할 수 있는 메인 UI

| 항목 | 내용 |
|------|------|
| **의존** | Phase 2 |
| **핵심 설계** | 탭별 lazy loading (RecordTabData, DiagnosisTabData, StrategyTabData, StorylineTabData) |
| **파일 수** | ~25개 |

**UI 컴포넌트**:
```
기록 탭 핵심 (11개):
  StudentRecordSection, StudentRecordClient, StudentRecordSkeleton,
  RecordYearSelector, SetekEditor, PersonalSetekEditor, ChangcheEditor,
  HaengteukEditor, ReadingEditor, CharacterCounter, RecordStatusBadge

스토리라인 (5개):
  StorylineManager, StorylineTimeline, StorylineStrengthBadge,
  StorylineSuggestionPanel, OrphanedActivityAlert

로드맵 (6개):
  RoadmapPlanEditor, RoadmapExecutionEditor, RoadmapComparisonView,
  RoadmapMatchRateChart, CourseSelectionPlanner, RoadmapDeviationAlert

성적/출결 뷰 (3개):
  ScoreSummaryView, MockScoreTrendView, NEISLayoutRenderer
```

**검증**:
- [x] 세특 입력 → 자동 저장 → 새로고침 유지
- [x] 바이트 카운터 실시간 표시, 초과 시 빨간색 + 저장 차단
- [x] 스토리라인 생성 → 활동 연결 → 타임라인 시각화
- [x] 로드맵 계획 입력 → 실행 기록 → match_rate 표시
- [x] `pnpm build` 성공

**구현 상태** (2026-03-17):
- **Phase 3a+3b 완료**: 기록 탭 핵심 UI + 모든 에디터
  - Server Actions 8개 (`lib/domains/student-record/actions/record.ts`)
  - Query Options (`lib/query-options/studentRecord.ts`)
  - UI 13개 파일 (`student-record/` 디렉토리)
  - 기능: 자동 저장(2s debounce), NEIS 바이트 기준 카운터(`B/B` 표시), 연도 전환, 서브탭(pill) 전환
  - 에디터: 세특, 개인세특, 창체(3섹션), 행특, 독서(추가/삭제), 출결(그리드+수동저장)
- **Phase 3c 완료**: 스토리라인 + 로드맵 UI
  - Repository: findStorylines, insertStoryline, updateStoryline, deleteStoryline, findStorylineLinks, insertStorylineLink, deleteStorylineLink, findRoadmapItems, insertRoadmapItem, updateRoadmapItem, deleteRoadmapItem
  - Service: getStorylineTabData, saveStoryline, updateStoryline, removeStoryline, addStorylineLink, removeStorylineLink, saveRoadmapItem, updateRoadmapItem, removeRoadmapItem
  - Server Actions: `actions/storyline.ts` (10개 액션)
  - UI: StorylineManager, StorylineTimeline, StorylineStrengthBadge, RoadmapEditor
  - StudentRecordClient에 "스토리라인", "로드맵" 서브탭 추가 (lazy loading)

---

### Phase 3.5 — 보조 기록 UI + 지원결과 탭

> **목표**: 수상/봉사/징계 + 수시 6장 카드 + 면접일 겹침 체크 + 경쟁률 트래킹

| 항목 | 내용 |
|------|------|
| **의존** | Phase 3 |
| **파일 수** | ~10개 |

**핵심 UI**:
```
수시 6장 카드 (최대 6장 제약 + 소신/적정/안정 배분 표시)
정시 가/나/다 군별 슬롯
면접일 겹침 경고 (동일일=critical, 전일=warning)
경쟁률 수동 입력 필드 (원서접수 기간 중)
등록금 납부/포기 의사결정 안내
```

**검증**:
- [x] 수시 7장 입력 시 → 제약 경고 (서비스단 MAX_EARLY_APPLICATIONS=6 검증)
- [x] 면접일 겹침 자동 감지 → 경고 표시 (InterviewConflictAlert + checkInterviewConflicts)
- [x] 등록 상태 변경 시 "정시 지원 불가" 안내 (hasRegistered 경고 배너)

**구현 상태** (2026-03-17):
- **Phase 3.5 완료**:
  - Repository: applications/awards/volunteer/disciplinary CRUD (13개 함수)
  - Service: getSupplementaryTabData + 수시 6장 검증 + CRUD 10개 함수
  - Server Actions: `actions/supplementary.ts` (10개 액션)
  - Query Options: supplementaryTabQueryOptions
  - UI: ApplicationBoard(수시6장+정시군별+경쟁률+면접겹침), SupplementaryEditor(수상/봉사/징계)
  - StudentRecordClient에 "지원현황", "수상/봉사" 서브탭 추가

---

### Phase 4 — 학생/학부모 뷰 + 수능최저 시뮬 + 재수생 뷰

> **목표**: 읽기전용 뷰 + 수능최저 시뮬레이션 엔진 UI + 재수생 대시보드

| 항목 | 내용 |
|------|------|
| **의존** | Phase 3 |
| **파일 수** | ~12개 |

**학부모 뷰 공개 범위**:
```
✅ 공개: 성적 추이, 모평 추이, 최저 충족 현황, 역량 요약, 스토리라인 요약, 로드맵 진행
❌ 비공개: 세특/창체 원문, AI 진단 원문, 컨설턴트 메모
```

**수능최저 시뮬레이션**:
```
목표 대학별 최저 조건 입력 (구조화 JSON)
모평별 자동 충족/미달 판정
what-if 시나리오 ("수학 2등급이면?")
bottleneck 과목 시각화
```

**검증**:
- [x] 학부모 로그인 → 자녀 데이터만 표시 (canAccessStudent RLS)
- [x] 세특 원문 접근 차단 확인 (count만 노출, 원문 미전달)
- [x] 최저 시뮬: 3합6 충족/미달 정확 계산 (simulateMinScore 엔진 + what-if)
- [ ] 재수생: 내신 확정(편집 불가) + 수능 중심 대시보드 *(별도 요청 시)*

**구현 상태** (2026-03-17):
- **Phase 4 완료** (재수생 뷰 제외):
  - Repository: min_score_targets 4개 + min_score_simulations 3개 함수
  - Service: getStrategyTabData, addMinScoreTarget, updateMinScoreTarget, removeMinScoreTarget, runMinScoreSimulation, removeMinScoreSimulation
  - Server Actions: `actions/strategy.ts` (6개), `actions/parentRecord.ts` (1개)
  - Query Options: strategyTabQueryOptions
  - Admin UI: MinScorePanel (목표CRUD + 시뮬실행 + 결과표시 + what-if)
  - Parent UI: `/parent/record` 페이지 (요약/최저충족/스토리라인/지원현황 읽기전용)
  - StudentRecordClient에 "최저시뮬" 서브탭 추가

---

### Phase 4.5 — 생기부 Import (PDF / HTML / 이미지)

> **목표**: 생기부 파일 업로드 → 파싱 → 미리보기 → DB 저장 (3가지 입력 형식 지원)

| 항목 | 내용 |
|------|------|
| **의존** | Phase 3 |
| **AI** | Gemini 3.1 멀티모달 (PDF/이미지 전용). HTML은 AI 불필요 |
| **파일 수** | 10개 (도메인 8 + UI 1 + 액션 1) |
| **참고 원본** | `~/Downloads/학교생활기록부-변환기.zip` (Google AI Studio 앱), `neis_to_docx.py` |

**지원 형식**:
| 형식 | 처리 방식 | 소요 시간 |
|------|-----------|-----------|
| **HTML (나이스 웹 저장)** | `html-parser.ts` 코드 직접 파싱 (AI 불필요) | **1~2초** |
| PDF (NEIS 출력물) | pdfjs-dist → PNG 이미지 → 클라이언트에서 Gemini 직접 호출 | 1~3분 |
| 이미지 (사진/스캔) | base64 → 클라이언트에서 Gemini 직접 호출 | 1~3분 |

**아키텍처 (최종, 2026-03-18)**:
```
[HTML] → html-parser.ts (코드 직접 파싱, AI 없음) ─┐
[PDF]  → pdfjs-dist PNG → 클라이언트 → Gemini API ─┼→ [서버] 과목 매칭 + 자동 생성
[이미지] → base64   → 클라이언트 → Gemini API     ─┘   → 미리보기 → DB upsert

핵심: 이미지 데이터는 서버를 거치지 않음 (클라이언트 → Gemini 직접)
      서버에는 파싱된 JSON(수 KB)만 전송
```

**산출물 (10개 파일)**:
```
lib/domains/student-record/import/
├── types.ts              — ImportFileFormat, RecordImportData, ImportPreviewData 등
├── extractor.ts          — PDF→PNG(pdfjs-dist v5, scale 2.0), Image→base64
├── html-parser.ts        — NEIS HTML 코드 직접 파싱 (neis_to_docx.py 포팅)
├── parser.ts             — Gemini 3.1 pro/flash-lite (클라이언트, @google/genai SDK)
├── subject-matcher.ts    — 과목 매칭 (정확→정규화→자동 생성) + group 추론
├── mapper.ts             — ParsedData → DB Insert (grade + school_year 계산)
├── importer.ts           — repository 재사용 upsert 오케스트레이션
└── index.ts              — Public API

lib/domains/student-record/actions/import.ts   — matchAndPreviewAction + executeImportAction
app/.../student-record/ImportDialog.tsx         — 드롭존 + 프로그레스 + 미리보기 + 저장
```

**E2E 테스트 결과 (2026-03-18)**:

| 테스트 | 학생 | 형식 | 세특 | 창체 | 행특 | 독서 | 출결 | 성적 | 상태 |
|--------|------|------|------|------|------|------|------|------|------|
| #1 김가영 | PDF (gemini-2.5-flash) | 5건 | 6건 | 1건 | 2건 | 1건 | - | ⚠ 누락 심각 |
| #2 김가영 | PDF (gemini-2.5-pro, 1p청크) | 14건 | 6건 | 1건 | 7건 | 1건 | - | ✅ 개선 |
| #3 김세린 | HTML (Gemini 텍스트) | 32건 | 6건 | 2건 | 0건 | 2건 | - | ⚠ 학기 중복 |
| #4 김세린 | HTML (코드 직접 파싱) | 30건 | 6건 | 2건 | 0건 | 2건 | 50건(참고) | ✅ 즉시 파싱 |

**발견된 이슈 & 해결 이력**:

| # | 이슈 | 원인 | 해결 |
|---|------|------|------|
| 1 | pdfjs worker 로드 실패 | CDN `.mjs` MIME 오류 | `public/pdf.worker.min.js` 로컬 복사 |
| 2 | Server Action 1MB 제한 | base64 이미지 페이로드 초과 | `experimental.serverActions.bodySizeLimit: "20mb"` |
| 3 | gemini-2.0-flash 404 | 모델 deprecated | gemini-2.5-flash → 3.1-pro-preview로 최종 전환 |
| 4 | JSON 잘림 (Unterminated string) | gemini-2.5-flash thinking 토큰이 출력 예산 소모 | 1페이지 청크 + 모델 전환으로 해결 |
| 5 | thinkingConfig 미지원 | v1beta API에서 미인식 | SDK 전환 (@google/genai) + 모델 전환 |
| 6 | fetch 5분 타임아웃 | 서버 경유 이중 전송 (20MB+) | **클라이언트→Gemini 직접 호출** (서버 안 거침) |
| 7 | 과목 미매칭 대량 발생 | 미술/음악/체육 등 DB 미등록 | **과목 자동 생성** + subject_group 추론 |
| 8 | 세특 학기 중복 저장 | 생기부 세특은 학년 단위인데 학기로 분리 | 학년 단위 저장 (semester=1 통일) |
| 9 | `(1학기)한국사` 과목명 | NEIS HTML 학기 prefix | html-parser에서 prefix 제거 |
| 10 | QueryClient 에러 | @google/genai SSR import | dynamic import로 전환 |
| 11 | HTML 파싱 0건 | DOMParser.textContent 줄바꿈 누락 | 블록 요소별 줄바꿈 삽입 (`extractTextFromDom`) |
| 12 | Gemini 503 과부하 | 모델 일시 과부하 | fallback 체인 (3.1-pro → 3.1-flash-lite) |

**SDK & 모델 선택 결정**:
```
기존 LLM 인프라 (@google/generative-ai)  →  plan, cold start 등 (변경 없음)
Import 전용  (@google/genai)              →  gemini-3.1-pro-preview (fallback: 3.1-flash-lite)
HTML                                       →  AI 불사용 (코드 직접 파싱)
```

**핵심 설계 결정**:
1. **HTML은 AI가 아닌 코드로 직접 파싱** — NEIS HTML 구조 고정, Python neis_to_docx.py 로직 포팅
2. **클라이언트에서 Gemini 직접 호출** — 이미지가 서버를 거치지 않아 페이로드/타임아웃 문제 해결
3. **미매칭 과목 자동 생성** — subject_group 추론 후 DB에 자동 등록 (수동 매핑 부담 제거)
4. **세특은 학년 단위 저장** — semester=1 통일 (생기부 원본이 학년 단위)
5. **`NEXT_PUBLIC_GOOGLE_API_KEY`** — 클라이언트 Gemini 호출용, 프로덕션에서 HTTP referrer 제한 필요

**검증**:
- [x] 빌드 성공
- [x] 기존 테스트 83개 통과
- [x] PDF 업로드 → 프로그레스 → 미리보기 (김가영 14건 세특)
- [x] HTML 업로드 → 즉시 파싱 → 미리보기 (김세린 30건 세특, 6건 창체, 2건 행특)
- [x] 과목 자동 생성 동작 확인
- [x] Gemini 503 fallback 동작 확인
- [x] **저장 동작 확인** — executeImport 220줄 구현 완료, QueryClient 에러 없음 (2026-03-20 코드 검증)
- [x] 이미지 업로드 — extractor.ts에서 PNG/JPG/WEBP 지원 (base64 → Gemini 직접)
- [x] 독서활동 HTML 파싱 — html-parser.ts `parseReading()` 구현 완료 ("제목(저자)" 형식)
- [x] 성적(grades) 데이터 scores 테이블 연동 → Phase 4.6에서 완료

**남은 작업**:
- ~~DB 저장 E2E 검증~~ → ✅ 구현 확인 (2026-03-20)
- ~~독서활동 HTML 파싱 개선~~ → ✅ 구현 확인 (2026-03-20)
- ~~성적 데이터 scores 연동~~ → ✅ Phase 4.6에서 완료
- 프로덕션 배포 시 API 키 referrer 제한 설정

---

### Phase 4.6 — 전체 학년 보기 + NEIS 원본 레이아웃 + 성적 연동

> **목표**: 생기부 UI를 NEIS 원본 PDF와 시각적으로 일치시키고, 전체 학년 통합 뷰 + 성적 Import/인라인 편집 구현
> **완료일**: 2026-03-18

| 항목 | 내용 |
|------|------|
| **의존** | Phase 3, Phase 4.5 |
| **수정 파일** | 15개 |

#### A. 전체 학년 보기 + 학년 필터

| 항목 | 구현 |
|------|------|
| **RecordYearSelector** | `value: "all" \| number` 타입, "전체" 버튼 추가 (기본값) |
| **StudentRecordClient** | `viewMode` 상태, `useQueries`로 record/supplementary 3년치 병렬 쿼리 |
| **visiblePairs 필터** | "전체" → 전 학년, 개별 선택 → 해당 학년만 (캐시에서 즉시 전환) |
| **쿼리 수** | 3(record) + 3(supplementary) + 1(storyline) + 1(strategy) = 8 병렬 |

#### B. NEIS 원본 레이아웃 재현

| 섹션 | 변경 사항 |
|------|----------|
| **학반정보** | 졸업대장번호 행, 사진 오른쪽 독립 배치 (flex), 120×160 placeholder |
| **인적사항** | 성명/성별/주민번호 3등분 가로 배치, 학적사항에 학교명 통합 |
| **출결** | 전학년 단일 테이블 (`AttendanceTableHeader` + `variant="row"`) |
| **수상** | 봉사 제외 (`show={["awards","disciplinary"]}`), 학년(학기) 헤더 |
| **창체** | 봉사행 제거, 영역 `whitespace-nowrap`, 세로 가운데 정렬 |
| **봉사** | 6번 창체 하위로 재배치 (`sec-6-volunteer`) |
| **성적** | 원점수/과목평균 별도 열, 성취도/수강자수 분리, 체육예술 6열 |
| **세특** | 카드 UI → 2열 테이블, 과목 합산 (1+2학기), ▸/▾ 토글 아이콘 |
| **학교폭력** | 학년별 빈 행 표시 (전학년) |
| **콘텐츠 폭** | `max-w-4xl` → `max-w-6xl` |
| **테이블 border** | `gray-400`/`dark:gray-500` 통일 |
| **테이블 헤더** | 전 컴포넌트 `text-center` 통일 |
| **삭제 버튼** | 빈 컬럼 제거 → 호버 overlay (`invisible` / `group-hover:visible`) |
| **빈 상태** | 테이블 구조 유지 (헤더 + "해당 사항 없음" 행) |

#### C. Import 성적 자동 저장

| 파일 | 변경 |
|------|------|
| `import/mapper.ts` | `mapGrades()` 함수 + `GradeMapperContext` 타입 |
| `import/importer.ts` | `executeImport`에 `student_internal_scores` upsert 단계 추가 |
| `import/types.ts` | `ImportResult.counts.grades` 필드 추가 |
| `actions/import.ts` | 과목 매칭 풀에 성적 과목명 포함, `buildGradeMapperContext` 추가 |
| `ImportDialog.tsx` | 성적 `warn` 배지 제거, "자동 반영됩니다" 안내 |

#### D. 인라인 성적 편집

| 기능 | 구현 |
|------|------|
| **행 삭제** | 호버 시 "삭제" → `adminDeleteInternalScore` 서버 액션 |
| **행 추가** | "+ 성적 추가" 폼 (과목/학기/학점/원점수/과목평균/성취도/석차등급/수강자수) |
| **FK 자동 조회** | `subject_group_id`, `subject_type_id`, `curriculum_revision_id` 자동 |
| **읽기 전용 모드** | `tenantId`/`subjects` 미전달 시 편집 불가 (학부모 뷰) |

#### E. 기타 개선

| 항목 | 변경 |
|------|------|
| **자동저장 에러 재시도** | `saveNow` 활용, 에러 시 "재시도" 버튼 (세특/창체/행특) |
| **담임성명 DB** | `student_record_attendance`에 `homeroom_teacher`, `class_name`, `student_number` 컬럼 추가 |
| **ParentRecordClient** | `RecordYearSelector` 타입 호환 (`handleYearChange` 래퍼) |

#### 수정 파일 목록 (15개)

```
app/(admin)/admin/students/[id]/_components/student-record/
├── StudentRecordClient.tsx    — 핵심: 전체 학년 보기, 레이아웃, 섹션 재배치
├── RecordYearSelector.tsx     — "전체" 버튼, value 타입 변경
├── RecordGradesDisplay.tsx    — 성적 컬럼 분리, 인라인 편집(추가/삭제)
├── SetekEditor.tsx            — 카드→2열 테이블, 과목 합산, 재시도 버튼
├── AttendanceEditor.tsx       — variant="row" 모드, AttendanceTableHeader export
├── ChangcheEditor.tsx         — 봉사행 제거, 영역 정렬, 재시도 버튼
├── HaengteukEditor.tsx        — 세로 가운데 정렬, 헤더 center, 재시도 버튼
├── SupplementaryEditor.tsx    — show prop, 삭제 overlay, 헤더 center
├── ReadingEditor.tsx          — 삭제 overlay, 헤더 center
├── PersonalSetekEditor.tsx    — 빈 상태 테이블 구조
├── ImportDialog.tsx           — 성적 안내 문구 업데이트

app/(parent)/parent/record/
├── ParentRecordClient.tsx     — RecordYearSelector 타입 호환

lib/domains/student-record/import/
├── mapper.ts                  — mapGrades(), GradeMapperContext
├── importer.ts                — 성적 upsert 단계 추가
├── types.ts                   — ImportResult.counts.grades
lib/domains/student-record/actions/
├── import.ts                  — 성적 과목 매칭, buildGradeMapperContext

supabase/migrations/
├── 20260331300000_attendance_class_info.sql  — 담임성명/반/번호 컬럼
```

**검증**:
- [x] `pnpm build` 성공
- [x] `pnpm lint` 수정 파일 에러 없음
- [x] 전체 보기 → 1~3학년 전부 표시
- [x] 학년 필터 → 즉시 전환 (re-fetch 없음)
- [x] 출결 3학년 단일 테이블
- [x] 성적 테이블 11열 (원점수/과목평균 분리)
- [x] 세특 2열 테이블 (과목 합산)
- [x] 봉사 → 창체 하위
- [x] 삭제 버튼 호버 overlay
- [x] Import → 성적 자동 저장 — mapGrades() + importer.ts 구현 확인 (2026-03-20 코드 검증)
- [x] 성적 인라인 추가/삭제 — RecordGradesDisplay AddScoreForm + deleteMutation 구현 확인

---

### Fix: NEIS 바이트 기준 글자수 검증 개선 (2026-03-18)

> **배경**: NEIS "500자" 제한은 실제로 **1,500바이트(Byte) 제한**이다. 기존 구현이 글자수(charCount) 기준으로 검증하여, 영문/공백이 많은 텍스트가 실제 NEIS 통과 가능함에도 차단되는 문제가 있었음.

#### NEIS 바이트 계산 규칙

| 문자 유형 | 바이트 |
|-----------|--------|
| 한글 | 3B |
| 영문/숫자/공백/문장부호 | 1B |
| 줄바꿈(엔터) 1회 | **2B** |
| 한자/전각 특수문자 | 3B |
| 이모지 | 4B (NEIS 입력 불가) |

#### 변경 사항 (수정 5개 파일)

| 파일 | 변경 |
|------|------|
| `validation.ts` | `countNeisBytes()`: 내부 CRLF 정규화 + LF=2B (기존 1B), `validateNeisContent()`: `isOver` 필드 추가 (= `isOverByte`) |
| `service.ts` | saveSetek/savePersonalSetek/saveChangche/saveHaengteuk: `isOverChar` → `isOver` (바이트 기준), 공통과목 쌍 합산도 바이트 기준으로 변경 |
| `CharacterCounter.tsx` | 1차 지표를 `B/B` (바이트)로 변경, 글자수는 보조 `(n자)` 표시, 색상 코딩도 바이트 비율 기준 |
| `types.ts` | `NeisValidationResult`에 `isOver: boolean` 추가 |
| `validation.test.ts` | 41개 테스트 (기존 35 + 신규 6: 줄바꿈 2B, 영문 NEIS 통과, 한영 혼합) |

#### 핵심 예시

```
예시: 한글 300자 + 영문/공백 250자 = 550자 입력
  → 기존: "500자 초과" 에러로 저장 차단 ❌
  → 수정: 300×3 + 250×1 = 1,150B / 1,500B → NEIS 통과 ✅
```

#### 검증
- [x] `pnpm test` → validation.test.ts 41개 전체 통과
- [x] `pnpm lint` → 수정 파일 에러 없음

---

### Phase 5 — 진단 DB + 교과이수적합도

> **목표**: 역량 평가 데이터 구조 + 교과 이수 적합도 규칙 엔진

| 항목 | 내용 |
|------|------|
| **테이블** | competency_scores, activity_tags, diagnosis, strategies (4개) |
| **의존** | Phase 1c (school_offered_subjects), Phase 2 |
| **산출물** | `004_diagnosis.sql`, course-adequacy.ts, RLS 통합 테스트 20+ |
| **파일 수** | ~10개 |

**교과이수적합도 특이사항**:
- school_offered_subjects junction 연동 → 학교 미개설 과목은 "이수불가" (학생 탓 아님)
- 진로선택 A/B/C 3단계 성취도 반영 고려

**검증**: ✅ 2026-03-18 완료
- [x] DB 마이그레이션 적용 (`20260331400000_student_record_diagnosis.sql`)
  - 4 테이블, RLS 12개 (admin+student+parent × 4), 트리거 3개, 인덱스 10개
- [x] `database.types.ts` 재생성 (4개 테이블 타입 확인)
- [x] `pnpm build` 성공
- [x] `pnpm test` → course-adequacy 19개 통과

**산출물 (10개 파일)**:
```
lib/domains/student-record/
├── types.ts (수정: CompetencyScore/ActivityTag/Diagnosis/Strategy 타입 추가, DiagnosisTabData, CourseAdequacyResult)
├── competency-repository.ts (신규: 8함수 — find/upsert/update/delete + activity_tags CRUD)
├── diagnosis-repository.ts (신규: 8함수 — diagnosis upsert + strategies CRUD)
├── course-adequacy.ts (신규: 18계열 매칭, 과목명 정규화, 학교 미개설 분모 제외, 일반/진로 분리)
├── actions/diagnosis.ts (신규: 13개 Server Actions — CRUD + fetchDiagnosisTabData)
├── index.ts (수정: 신규 타입/함수 re-export)
├── __tests__/course-adequacy.test.ts (신규: 19 tests)
├── __tests__/interview-conflict-checker.test.ts (신규: 12 tests — Phase 3.5 보강)
├── __tests__/mapper.test.ts (신규: 23 tests — Phase 4.5 보강)
└── lib/query-options/studentRecord.ts (수정: diagnosisTabQueryOptions 추가)

supabase/migrations/
└── 20260331400000_student_record_diagnosis.sql
```

---

### Phase 5.5a — AI 역량 태그 자동 제안 (초기)

> **목표**: 세특/창체 텍스트 → 역량 태그 + 추론 근거 AI 제안 (수락/거절)
> **완료일**: 2026-03-18

| 항목 | 내용 |
|------|------|
| **AI** | Gemini fast (temperature 0.3) |
| **의존** | Phase 5 |
| **파일 수** | 4개 |

**핵심 설계**:
- AI가 태그 제안 시 **근거 키워드 + 판단 이유 + 매칭 루브릭 질문** 포함 (구조화 추론)
- 프롬프트에 COMPETENCY_ITEMS 10개 + COMPETENCY_RUBRIC_QUESTIONS 42개 주입
- 수락 시 `activity_tags.evidence_summary`에 AI 근거 저장
- few-shot 학습은 5.5b로 미룸 (데이터 축적 필요)

**산출물 (4개 파일)**:
```
lib/domains/student-record/llm/
├── types.ts — TagSuggestion, SuggestTagsInput, SuggestTagsResult
├── prompts/competencyTagging.ts — 시스템 프롬프트 + 유저 프롬프트 빌더 + 응답 파서
└── actions/suggestTags.ts — Server Action (Gemini fast, rate limit 처리)

app/.../student-record/
└── ActivityTagSuggestionPanel.tsx — AI 제안 UI (수락/거절 + 근거 표시)
```

**검증**: ✅
- [x] `pnpm build` 성공
- [x] 기존 테스트 143개 통과
- [ ] 실제 Gemini 호출 E2E 테스트 (API 키 필요)

**Phase 5.5b (향후)**: 수락/거절 이력 테이블 → few-shot 예시 자동 구성 → 신뢰도 기반 자동 적용

---

### 레이아웃 리팩토링 — 캘린더 3존 구조 적용

> **목표**: 생기부 페이지를 캘린더와 동일한 3존 레이아웃으로 전환 + 4단계 컨설팅 파이프라인 사이드바
> **완료일**: 2026-03-18

#### 레이아웃 변경

| 영역 | 이전 | 이후 |
|------|------|------|
| 레이아웃 | 2존 (사이드바+메인) | 3존 (사이드바+메인+레일/패널) |
| 사이드바 TOC | 플랫 14+4항목 | 4단계 접이식 그룹 (기록/진단/설계/전략) |
| 학년 선택 | 사이드바 최상단 | 기록/진단 그룹 내부 세그먼트 컨트롤 |
| 레일+패널 | 없음 | 메모(📝)+채팅(💬) — 캘린더와 동일 |

#### 구현 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| A | SidePanel 인프라 공유화 (`components/side-panel/`) | ✅ |
| B | RecordSidePanelContainer + RecordMemoPanelApp + StudentRecordContext | ✅ |
| C | RecordLayoutShell `rightPanel` prop 추가 | ✅ |
| D | 사이드바 4단계 그룹 + compact 학년 세그먼트 | ✅ |
| E | SidePanelProvider + rightPanel 연결 | ✅ |
| F | 진단 4개 플레이스홀더 섹션 + StageDivider | ✅ |

#### 사이드바 구조

```
📋 기록 (접이식, 학년선택 내장)
  [전체|1|2|3]
  [1] 인적·학적사항 ~ [9] 행동특성 및 종합의견 (원본 TOC 유지)
🔍 진단 (접이식, 학년선택 내장)
  역량평가 / 활동태그 / 종합진단 / 교과이수적합
📐 설계 (접이식)
  스토리라인 / 로드맵 / 보완전략
🎯 전략 (접이식)
  지원현황 / 최저시뮬
```

#### 산출물

```
components/side-panel/ (공유, 신규 5파일)
├── types.ts, SidePanelContext.tsx, SidePanelContent.tsx, SidePanelIconRail.tsx, index.ts

app/.../student-record/side-panel/ (신규 2파일)
├── RecordSidePanelContainer.tsx, RecordMemoPanelApp.tsx

app/.../student-record/ (신규 1파일, 수정 3파일)
├── StudentRecordContext.tsx (신규)
├── RecordLayoutShell.tsx (수정: rightPanel prop)
├── StudentRecordClient.tsx (수정: 4단계 STAGES, SidePanelProvider, 진단 플레이스홀더)
├── RecordYearSelector.tsx (수정: compact 모드)
```

**검증**: ✅
- [x] `pnpm build` 성공
- [x] 캘린더 페이지 기존 동작 유지 (re-export 무파괴)
- [ ] 레일 메모/채팅 패널 E2E 동작
- [ ] 반응형 확인 (모바일/태블릿/데스크탑)

---

### Phase 6 — 진단 UI + source/status 추적 (컨설턴트 수동 입력 중심)

> **목표**: 진단 플레이스홀더 → 실제 UI. AI 자동 생성이 아닌 컨설턴트 수동 입력 중심.
> 모든 데이터에 source(ai/manual) + status(suggested/confirmed) 추적하여 점진적 AI 고도화 기반 축적.
> **완료일**: 2026-03-18

**핵심 원칙**:
- AI 제안 → `source=ai, status=suggested` (미확정)
- 컨설턴트 수락 → `source=ai, status=confirmed` (AI가 만들었지만 확정됨)
- 컨설턴트 직접 입력 → `source=manual, status=confirmed`
- 나중에 분석: AI 채택률 = `source=ai AND status=confirmed` / 전체 `source=ai`

**구현 산출물**:

| 구분 | 파일 | 상세 |
|------|------|------|
| DB 마이그레이션 | `20260331500000_diagnosis_source_status.sql` | activity_tags, diagnosis에 source/status 추가 |
| 역량평가 UI | `CompetencyScoreGrid.tsx` | 3영역×10항목 등급 그리드 + AI 종합 분석 버튼 |
| 활동태그 UI | `ActivityTagList.tsx` | 태그 목록 + source/status 배지 + 확정/삭제 + 레코드별 AI 분석 |
| 종합진단 UI | `DiagnosisEditor.tsx` | 등급/방향/강점/약점/추천전공/메모 + 저장(draft)/확정 |
| 이수적합도 UI | `CourseAdequacyDisplay.tsx` | 전공 셀렉터 → 클라이언트 즉시 재계산 (서버 왕복 없음) |
| AI 종합분석 | `llm/actions/analyzeCompetency.ts` | 전체 세특/창체/행특 → 10항목 등급+근거 |
| Server Actions | `actions/diagnosis.ts` 확장 | confirm 액션 + fetchData 내부 과목/개설 자동 조회 |

**검증**: ✅
- [x] `pnpm build` 성공
- [x] `pnpm test` 143개 통과
- [ ] 역량평가: AI 종합 분석 → 10항목 등급 + 근거 표시 → 클릭 반영 → 저장
- [ ] 활동태그: 레코드별 AI 태그 제안 → source/status 표시 → 확정/삭제
- [ ] 종합진단: 수동 입력 → 저장(draft) → 확정(confirmed)
- [ ] 이수적합도: 전공 변경 → 즉시 재계산

---

### Phase 6.1 — 세특 인라인 하이라이트 + 역량 배지 (1순위)

> **목표**: AI가 세특 텍스트에서 **어떤 구절이 어떤 역량인지** 시각적으로 표시
> **참고 원본**: 설계 로드맵 문서의 `[학업역량_탐구력]` 인라인 태그, `[확인 要]` 마크

**배경 (실제 컨설팅 자료 분석)**:

설계 로드맵(19표 문서)에서 컨설턴트는 세특 원문 끝에 역량 태그를 직접 표기:
```
... 단풍탐구에서 기온·일조시간 변화에 따른 엽록소 분해...
[학업역량_탐구력/학업성취도] [진로역량_진로탐색활동과 경험] [공동체역량_나눔과 배려]
```

그리고 세특을 3구간으로 분류하여 분석:
```
학업태도      — 수업 참여, 발표, 성실성
학업수행능력   — 과목 이해도, 문제 해결력
탐구활동      — 심화 탐구, 보고서, 독서 연계
```

학교활동 요약(8표 문서)에서는 학업역량/진로역량 2열로 요약하며, 학년간 후속탐구를 `ㄴ(2학년 수학1)` 형태로 연결.

**현재 문제**:
- AI 역량 분석이 종합 등급만 제안하고 **어떤 근거로 판단했는지 보이지 않음**
- 활동 태그가 별도 테이블에만 저장되어 **세특 원문에서 태깅된 위치를 알 수 없음**
- 컨설턴트가 AI 제안을 신뢰하려면 **원문의 어느 부분이 근거인지** 시각적 피드백 필수

**AI 응답 구조 개선**:

```json
{
  "sections": [
    {
      "sectionType": "학업태도",
      "tags": [
        {
          "competencyItem": "academic_attitude",
          "evaluation": "positive",
          "highlight": "스스로 모의고사를 풀면서 문제 해결과 개념 이해에 몰두",
          "reasoning": "자기주도적 학습 태도를 보여줌"
        }
      ]
    },
    {
      "sectionType": "탐구활동",
      "tags": [
        {
          "competencyItem": "academic_inquiry",
          "evaluation": "positive",
          "highlight": "연립방정식과 CT 촬영 원리에 대해 연구하여 탐구 보고서를 제출",
          "reasoning": "교과 심화 탐구의 구체적 성과"
        },
        {
          "competencyItem": "career_exploration",
          "evaluation": "positive",
          "highlight": "CT촬영의 산형방정식은 행렬과도 연관...탐구해보겠다고 포부를 밝힘",
          "reasoning": "의료공학 진로와 연결된 탐구 확장"
        }
      ],
      "needsReview": false
    }
  ],
  "competencyGrades": [
    { "item": "academic_achievement", "grade": "A+", "reasoning": "..." }
  ],
  "summary": "학업 탐구력이 두드러지며..."
}
```

**UI 시각화**:

```
┌─────────────────────────────────────────────────────────┐
│ 1학년 수학 세특                                          │
│                                                          │
│ 방학 동안 ██스스로 모의고사를 풀면서 문제 해결과 개념     │
│ 이해에 몰두██함.                            🔵학업태도   │
│                                                          │
│ 수학 학습 능력이 매우 뛰어나며, ██뛰어난 문제 해결       │
│ 역량██을 보여주는 학생임.                   🔵학업성취도  │
│                                                          │
│ ██연립방정식과 CT 촬영 원리에 대해 연구██하여 탐구       │
│ 보고서를 제출함... ██행렬연산에 대해 탐구해보겠다고      │
│ 포부를 밝힘██.                 🔵탐구력 🟣진로탐색경험   │
│                                                          │
│ 태그: [학업성취도🔵A+] [학업태도🔵B+] [탐구력🔵A-]      │
│       [진로탐색경험🟣A-]                                 │
└─────────────────────────────────────────────────────────┘
```

**색상 코딩**:
- 🔵 학업역량 (학업성취도/학업태도/탐구력): 파랑 계열
- 🟣 진로역량 (이수노력/성취도/탐색경험): 보라 계열
- 🟢 공동체역량 (소통/배려/성실/리더십): 초록 계열
- 🟡 `[확인 要]` (needs_review): 노랑 계열

**산출물**:
```
lib/domains/student-record/llm/
├── prompts/competencyHighlight.ts  — 세특 구간 분리 + 하이라이트 위치 반환 프롬프트
├── actions/analyzeWithHighlight.ts — 하이라이트 포함 분석 Server Action
└── types.ts 확장                   — HighlightedSection, HighlightTag 타입

app/.../student-record/
├── HighlightedSetekView.tsx        — 세특 원문 하이라이트 렌더링 + 역량 배지 + 구간 분석
└── CompetencyAnalysisSection.tsx   — 역량평가 + 활동태그 통합 섹션
    ├── AI 분석 버튼 (개별/일괄)
    ├── 활동별 하이라이트 뷰 (근거 먼저)
    └── 종합 등급 컴팩트 그리드 (등급 결정 나중)
```

**검증**: ✅ 2026-03-18 완료
- [x] `pnpm build` 성공
- [x] 세특 원문에 역량별 색상 하이라이트 표시 (파랑/보라/초록/노랑)
- [x] 구간 분석에 근거 구절 인용 + 평가(긍정/확인필요) 표시
- [x] AI 분석 후 태그+등급 자동 저장 (source=ai, status=suggested)
- [x] 배치 분석 시 기존 결과와 병합 (덮어쓰기 아님)

**의존**: Phase 6 (진단 UI 완성)

---

### AI vs 컨설턴트 진단 비교 시스템

> **목표**: 역량 등급 + 종합 진단을 AI/컨설턴트 2벌로 저장하여 나란히 비교
> **완료일**: 2026-03-18

**DB 변경**:
- `competency_scores`: source/status 추가, UNIQUE에 source 포함 → AI+컨설턴트 별도 행
- `diagnosis`: UNIQUE에 source 포함 → AI진단+컨설턴트진단 2건 공존
- 마이그레이션: `20260331600000_diagnosis_dual_tracking.sql`

**AI 종합진단 생성** (`llm/actions/generateDiagnosis.ts`):
- 입력: 역량 태그(확정) + 역량 등급(AI) + 학생 정보
- 출력: 종합등급, 방향성, 강점[], 약점[], 추천전공[], 전략 메모
- 저장: source=ai, status=suggested

**비교 UI** (`DiagnosisComparisonView.tsx`):
```
┌──────── AI 분석 ────────┬──── 컨설턴트 진단 ────┐
│ (읽기전용)              │ (편집 가능)           │
│ 종합등급/방향/강도       │ 종합등급/방향/강도     │
│ 강점/약점 (일치 ✓)     │ 강점/약점 (차이 ⚡)   │
│ 추천전공               │ 추천전공              │
├─────────────────────────┴──────────────────────┤
│ [AI → 컨설턴트 복사] [저장] [확정]               │
└─────────────────────────────────────────────────┘
```

**DiagnosisTabData 구조 변경**:
```typescript
competencyScores: { ai: CompetencyScore[]; consultant: CompetencyScore[] }
aiDiagnosis: Diagnosis | null
consultantDiagnosis: Diagnosis | null
```

**코드 리뷰 수정** (CRITICAL+HIGH 6건):
1. AI 등급 source:"ai" 누락 수정
2. findDiagnosis source 필수화 (maybeSingle 안전)
3. saveAnalysisResults 병렬화 (Promise.allSettled)
4. LLM JSON.parse 에러 구체 메시지
5. 배치 결과 병합 (덮어쓰기→merge)
6. DiagnosisComparisonView 폼 prop 동기화

**검증**: ✅
- [x] `pnpm build` 성공
- [x] `pnpm test` 143개 통과
- [ ] AI 종합진단 생성 → source=ai로 저장 확인 (SQL)
- [ ] 2열 비교 UI: 일치(✓)/차이(⚡) 표시
- [ ] "AI → 컨설턴트 복사" 동작
- [ ] 컨설턴트 저장 → draft → 확정 워크플로우
**파일 수**: ~8개

---

### 엑셀 진단Report 갭 분석 — 미구현 항목 (2026-03-18 점검)

> 원본: `Eeyore_2025년_진단_Report_김세린.xlsx` Sheet 4, 9, 10 vs 현재 구현

#### Sheet 4: "역량분석" (42×32) — 루브릭 질문별 분석 그리드

| 엑셀 구조 | 현재 구현 | 갭 |
|----------|----------|-----|
| 42행 = 42개 루브릭 질문 각각 분석 | 10개 항목 등급만 | **질문별 분석 없음** |
| 질문별 등급 분포 (긍정/확인필요 건수) | 항목당 단일 등급 | **분포 집계 없음** |
| 질문별 근거 활동 매핑 | 태그는 있으나 질문에 매핑 안 됨 | **질문↔태그 연결 없음** |

#### Sheet 9: "P정성평가" (120×8) — 항목별 상세 보고서

| 엑셀 구조 | 현재 구현 | 갭 |
|----------|----------|-----|
| 항목당 ~12행: 등급 + 루브릭 Q&A + 근거 + **해석 서술** | 등급 + 루브릭(tooltip) | **해석 서술(narrative) 없음** |
| "학업성취도: A등급. 수학과 과학 성적이 우수하고..." | 없음 | **항목별 narrative 필드 없음** |
| 어떤 활동이 이 등급에 기여했는지 | 태그 있으나 집계 안 됨 | **근거 활동 집계 뷰 없음** |
| 인쇄용 보고서 포맷 (120행) | UI만 | **PDF 레이아웃 없음** |

#### Sheet 10: "P정성평가(총평)" (49×15) — 종합 진단 요약

| 엑셀 구조 | 현재 구현 | 갭 |
|----------|----------|-----|
| 종합등급 + 방향 + 강도 | ✅ 있음 | - |
| 강점/약점 서술 (문단 형태) | 태그 칩만 | **서술형 미지원** |
| 추천전공 + **추천 교과목** | 전공만 선택 | **추천 교과 미표시** |
| 10항목 등급 요약 테이블 | 없음 | **종합 요약표 없음** |
| 인쇄용 보고서 | 없음 | **PDF 없음** |

#### 구현 우선순위

**P0 (즉시 반영 — 기존 코드/상수 활용)** ✅ 완료:
1. ~~**추천 교과목 표시**~~ — DiagnosisComparisonView에 RecommendedCourses 컴포넌트 (일반=파랑/진로=보라)
2. ~~**10항목 등급 요약 테이블**~~ — GradeSummaryTable (AI vs 컨설턴트 + 확장행)

**P1 (DB 스키마 추가 필요)** ✅ 완료:
3. ~~**항목별 해석 서술(narrative)**~~ — `narrative` TEXT 컬럼 + AI 생성 + GradeSummaryTable 확장행에 표시
4. ~~**근거 활동 집계**~~ — 역량별 activityTags 그룹핑 + 근거 카운트 + evidence 상세 표시

**P2 (Report 통합)** ✅ 완료 (Phase 9.1c):
5. ~~**인쇄용 보고서 (Sheet 9+10)**~~ — Report에 루브릭 Q&A + evidence_summary + 추천교과목 통합
6. ~~**10항목 등급 요약 + narrative + 근거 활동**~~ — CompetencySection 상세 확장 (등급표 + 항목별 상세)
7. ~~**추천 교과목 (일반/진로)**~~ — DiagnosisSection에 MAJOR_RECOMMENDED_COURSES 기반 표시

**P3 (Sheet 4 루브릭 그리드)** ✅ 완료 (Phase 9.1d — 문자열 역매핑):
8. ~~**루브릭 질문별 분석 그리드**~~ — `rubric-matcher.ts` (evidence_summary → 질문 인덱스 역매핑) + CompetencySection 42행 그리드
   - DB 변경 없이 기존 evidence_summary "루브릭: ..." 텍스트에서 질문 추출
   - 정확 매칭 → 접두사 매칭 → 포함 매칭 3단계 fallback
   - 질문별 긍정/부정 카운트 + 근거 텍스트 표시

**P4 (후속 개선)** — 미착수:
9. `rubric_question_index` DB 컬럼 추가 + 백필 (역매핑의 DB 정규화 버전)

---

### Phase 6.2 — 세특 3구간 분리 (학업태도/수행능력/탐구활동) ✅ 완료

> **목표**: 로드맵 템플릿 패턴에 맞춰 세특 텍스트를 3구간으로 자동 분류

**구현 완료**:
- `AnalyzedSection.sectionText` optional 필드 추가 (하위 호환)
- AI 프롬프트: 세특 100자↑ → 구간별 원문을 sectionText에 포함 지시
- 파서: sectionText 추출 + 서버액션 커버리지 40% 미만 폴백
- `SectionSplitView`: 구간별 색상 블록 (학업태도=파랑/학업수행능력=인디고/탐구활동=에메랄드)
- 레거시 호환: sectionText 없는 기존 분석 결과는 단일 블록 렌더링
- **파일 수**: 4개 (types, prompt, action, UI)

---

### Phase 6.3 — 학년간 후속탐구 연결 ✅ 완료

> **목표**: 학교활동 요약 문서의 `ㄴ(2학년 수학1)` 패턴 자동 감지 + 스토리라인 연결

**구현 완료**:
- `inquiryLinking.ts`: 프롬프트+파서 — 3가지 연결 유형 (sequential/parallel/retrospective)
- `detectInquiryLinks.ts`: Server Action — Gemini fast 호출, 연결 쌍 + 스토리라인 제안 반환
- `InquiryLinkSuggestions.tsx`: "AI 탐구 연결 감지" 버튼 → 연결 목록 + 스토리라인 자동 생성
- 기존 `addStorylineLinkAction` 재사용, connection_note에 AI 테마+유형 자동 기록
- DB 변경 없음, **파일 수**: 3개 (prompt, action, UI) + StudentRecordClient 수정

---

### Phase 6.5 — 조기 경보 + AI 면접 질문 ✅ 완료

> **목표**: 생기부 관련 자동 경고 + 면접 예상 질문 AI 생성

**경고 엔진 (구현 9/11개 룰)**:
- 기록(4): missing_career_activity, changche_empty, haengteuk_draft, reading_insufficient
- 이수(1): course_inadequacy (score < 50 → high, < 30 → critical)
- 스토리라인(2): storyline_weak, storyline_gap
- 최저(2): min_score_critical, min_score_bottleneck
- ✅ 전룰 구현 완료 (11/11): major_subject_decline (전공교과 2학기 연속 하락), min_score_trend_down (최저 충족 대학 수 감소) 추가 (2026-03-21)
- 순수 함수 엔진 (`warnings/engine.ts`), 클라이언트 useMemo로 계산
- `RecordWarningPanel`: 카테고리별 그룹핑, 4단계 severity 색상, 제안 표시

**면접 질문 AI (Gemini fast)**:
- 5유형 배분: factual(20%), reasoning(30%), application(20%), value(15%), controversial(15%)
- `InterviewQuestionPanel`: 레코드 선택 → AI 10개 질문 생성 → 질문/답변 확장 카드
- **파일 수**: 6개 신규 + StudentRecordClient 수정

---

### Phase 7 — 보완전략 + AI 제안 ✅ 완료

> **목표**: 진단 weaknesses 기반 보완전략 AI 제안 (Gemini Grounding)
> **완료일**: 2026-03-19

| 항목 | 내용 |
|------|------|
| **AI** | Gemini Grounding (웹 검색) |
| **의존** | Phase 6 |
| **파일 수** | 5개 (신규 4 + 수정 1) |

**산출물**:
- LLM: `llm/prompts/strategyRecommend.ts` + `llm/actions/suggestStrategies.ts` (Gemini fast + Grounding)
- 타입: `llm/types.ts` 확장 (StrategySuggestion, SuggestStrategiesInput/Result)
- UI: `StrategyEditor.tsx` — 수동 CRUD + AI 제안(채택/거절) + 우선순위 + 상태추적(planned→in_progress→done)
- StudentRecordClient `sec-compensation` 섹션 연결

**검증**: ✅ `pnpm build` 성공, 테스트 143개 통과

---

### Phase 8.1~8.6 — 대학 입시 DB + 배치 분석

> **목표**: 26,309건 입시 DB + 정시 환산 엔진 + 배치 판정 + 졸업생 검색

| Sub-Phase | 내용 | 의존 | 상태 |
|-----------|------|------|------|
| **8.1** | Excel 26,309건 이관 + 미적분기하 지정 | Phase 4 | ✅ 완료 |
| **8.2** | 정시 환산 엔진 + 결격사유 + 자동 테스트 | 8.1 | ✅ 완료 (엔진+Import+DB) |
| **8.2b** | PERCENTAGE 경로 (가중택 40개 대학) | 8.2 | ✅ 완료 |
| **8.3** | 대학 이름 별칭 매핑 (29건) + 검색 확장 | 8.1 | ✅ 완료 |
| **8.4** | data.go.kr API 연동 + 연간 갱신 + 알림 | 8.1 | ⏸ 보류 (기업 계정 가입 중) |
| **8.5a** | 배치 판정 엔진 + Admin UI (PlacementDashboard) | 8.2 | ✅ 완료 |
| **8.5b** | 가채점/실채점 분리 + 6장 최적 배분 시뮬레이션 | 8.5a | ✅ 완료 |
| **8.5c** | 충원 합격 시뮬레이션 | 8.5a | ✅ 완료 |
| **8.6** | 졸업생 입시 DB 검색 (AlumniSearch) | 8.1 | ✅ 완료 |

**8.5 배치 판정 레벨**: danger(위험) < unstable(불안정) < bold(소신) < possible(적정) < safe(안정) + possible_with_replacement(충원, 8.5c)

---

### Phase 8.1 — 대학 입시 참조 DB ✅ 완료

> **완료일**: 2026-03-19

**데이터 소스** (Google Drive `ㅎ.생기부레벨업/`):
- `NEW 학생 양식/4. 에듀엣톡_2026학년 수시 Report_sample_*.xlsx` → 추천선택 26,309행
- `2026학년도 정시 미적분기하 지정.xlsx` → 정시_미기 173행

**DB 마이그레이션**: `20260332000000_university_admissions.sql`
- `university_admissions`: 26,295건 삽입 (10건 자연키 충돌 스킵)
  - JSONB 3개: competition_rates, admission_results, replacements (연도 슬라이딩 대응)
  - 자연키: (data_year, university_name, department_name, admission_type, admission_name)
- `university_math_requirements`: 139건 삽입

**데이터 정제**:
- 오타 673건 정규화 (최종등록자퍙균 → 최종등록자평균 등)
- 정확 중복 3건 제거 (청주대)
- "-" → null 22,518건

**도메인**: `lib/domains/admission/` — types, repository, import 파이프라인 6개 모듈
**CLI**: `scripts/import-university-admissions.ts`, `scripts/import-math-requirements.ts`
**선행작업**: `constants.ts`에 전공 계열 5개 추가 (사회/전기전자/보건/생활과학/농림)
**테스트**: 32개 (header-detector 10, cleaner 15, transformer 7)

---

### Phase 8.2 — 정시 환산 엔진 ✅ 완료

> **완료일**: 2026-03-19

**DB 마이그레이션**:
- `20260332100000_admission_score_engine.sql` — 3 테이블 (configs 485 + conversions 549K + restrictions 80)
- `20260332200000_percentage_conversions.sql` — PERCENTAGE 경로 (883K행)

**Calculator 엔진** (`lib/domains/admission/calculator/`): 12개 모듈
- types, constants (36과목 + 63패턴 레지스트리), config-parser (필수/선택/가중택)
- subject-selector (Math MAX, Inquiry top-N, 대체), mandatory/optional/weighted/percentage-scorer
- restriction-checker (no_show, grade_sum, subject_req), calculator (파이프라인, 2경로 분기)

**2경로 구조**:
- 경로 A (필수/선택): 445개 대학, SUBJECT3 per-subject lookup + 한국사 가감점
- 경로 B (가중택): 40개 대학, PERCENTAGE 누적백분위 lookup

**Import**: COMPUTE/SUBJECT3/RESTRICT/PERCENTAGE 파서 + CLI 스크립트
**테스트**: 38개 (config-parser 17, calculator 통합 21)
**Spot-check**: 10/10 일치/근사 (한국사 가감점 반영 후)

---

### Phase 8.5a — 배치 판정 엔진 + Admin UI ✅ 완료

> **완료일**: 2026-03-19

**배치 판정 엔진** (`lib/domains/admission/placement/`):
- `types.ts`: PlacementLevel(5단계), PlacementVerdict, PlacementAnalysisResult, PlacementFilter
- `engine.ts`: 순수 함수 — parseAdmissionScores, determineVerdicts, summarizeVerdicts, filterVerdicts
- `score-converter.ts`: MockScoreInput → SuneungScores 변환 (수학 선택과목/탐구 매핑)
- `service.ts`: analyzePlacement — 전 대학 일괄 환산 + 입결 비교 + 판정 (Promise.all 5병렬 조회)
- `actions.ts`: fetchPlacementAnalysis Server Action (requireAdminOrConsultant)

**판정 기준** (입결 3개년 평균 대비):
| Level | 비율 | 설명 |
|-------|------|------|
| safe | ≥ 1.0 | 안정 |
| possible | ≥ 0.985 | 적정 (70%컷 근방) |
| bold | ≥ 0.97 | 소신 (85%컷 근방) |
| unstable | ≥ 0.95 | 불안정 |
| danger | < 0.95 또는 결격 | 위험 |

**신뢰도**: 3개년=80 / 2개년=60 / 1개년=40 기본점 + 표준편차 보너스(최대 +20)

**Repository 확장** (`repository.ts`):
- `findAdmissionsWithScores(dataYear)`: score_configs 대학의 입결 일괄 조회
- `getAllConversionTables(dataYear)`: 전 대학 ConversionTable Map (549K행 페이지네이션)
- `getAllRestrictions(dataYear)`: 전 대학 RestrictionRule Map
- `getAllPercentageTables(dataYear)`: 전 대학 PercentageTable Map (883K행 페이지네이션)

**Admin UI**:
- `PlacementDashboard.tsx`: ScoreInputForm + PlacementSummaryBar + 필터(레벨/지역/계열/검색) + PlacementCard
- StudentRecordClient 전략 섹션 `sec-placement` 추가
- Query: `lib/query-options/placement.ts` (enabled:false, 수동 refetch 트리거)

**테스트**: 25개 (parseAdmissionScores 4, calculateAdmissionAverage 2, calculateConfidence 4, determineLevel 6, determineVerdicts 4, summarizeVerdicts 1, filterVerdicts 4)

---

### Phase 8.3 — 대학 이름 별칭 매핑 ✅ 완료

> **완료일**: 2026-03-19

**문제**: `university_admissions`(164개 고유 대학) ↔ `universities`(2,056행) 연결 시 29개 미매칭

**DB 마이그레이션**: `20260332300000_university_name_aliases.sql`
- `university_name_aliases`: 29행 시드 (alias_name → canonical_name + university_id FK)
- RLS: `rls_check_is_admin_or_consultant()` 패턴
- 인덱스: `idx_una_canonical` on canonical_name

**별칭 29건 내역**:
| 카테고리 | 수 | 예시 |
|----------|---|------|
| 영문 약칭 | 6 | KAIST → 한국과학기술원 |
| 캠퍼스 접미사 | 8 | 강원대학교(춘천) → 강원대학교 |
| 국립 접두사 | 11 | 공주대학교 → 국립공주대학교 |
| 개명 | 2 | 경상대학교 → 경상국립대학교 |
| 특수 | 2 | 가야대학교 → 가야대학교(김해) |

**도메인**:
- `search/alias-resolver.ts`: `expandAliasNames` 순수 함수 (양방향 해석)
- `repository.ts`: `resolveUniversityAliases`, `getUniversityInfoMap`, `searchAdmissions` 별칭 `.or()` 통합
- `types.ts`: `UniversityInfo` + `AdmissionSearchResult.universityInfoMap`
- `search/actions.ts`: 결과에 `universityInfoMap` 반환

**UI** (`AlumniSearch.tsx`):
- 공식 이름이 다르면 괄호 표시: "KAIST (한국과학기술원)"
- 설립유형 배지 (국립/사립)
- 홈페이지 ExternalLink 아이콘

**테스트**: 9개 (양방향 해석, 캠퍼스 그룹, 국립접두사, 대소문자, 빈배열)

---

### Phase 8.6 — 졸업생 입시 DB 검색 ✅ 완료

> **완료일**: 2026-03-19

**검색 기능** (`lib/domains/admission/search/`):
- `constants.ts`: 필터 상수 — 지역 74개, 계열 5개, 전형 5개
- `actions.ts`: `searchAdmissionsAction` Server Action (requireAdminOrConsultant)
- `repository.ts`: `searchAdmissions` — ilike + eq 필터 + 페이지네이션 (count + data 병렬)

**타입** (`types.ts`):
- `AdmissionSearchFilter`: universityName, departmentName, region, departmentType, admissionType, dataYear
- `AdmissionSearchRow`: DB 행 camelCase 매핑 (25개 필드)
- `AdmissionSearchResult`: rows + total + page + pageSize + totalPages + universityInfoMap

**Query Options** (`lib/query-options/admissionSearch.ts`):
- `admissionSearchQueryOptions`: enabled:false (수동 refetch), staleTime 5분, gcTime 10분

**UI** (`AlumniSearch.tsx`):
- `SearchForm`: 대학명/학과명 텍스트 + 지역/계열/전형 드롭다운 + Enter 검색
- `SearchResults`: 총 N건 + 카드 목록 + 페이지네이션
- `AdmissionCard`: 펼침식 — 전형 배지(5색) + 메타 그리드(14항목) + 경쟁률/입결/충원 테이블
- `Pagination`: 최대 5페이지 번호 표시

---

### Phase 9 — AI 활동 지원 3모드 + Report

> **목표**: AI 활동 요약서 + 세특 방향 가이드 + 수시 Report 자동 생성

| 모드 | 대상 | 출력 | AI |
|------|------|------|-----|
| A. 활동 요약서 ✅ | 학생 → 교사 제출 | 학생 관점 정리본 | Gemini standard |
| B. 세특 방향 가이드 ✅ | 컨설턴트 내부용 | 핵심 역량·키워드 | Gemini standard |
| C. 활동 가이드 | 학생 직접 사용 | 탐구 수행 안내서 | 불필요 (DB 원본) — C1 완료로 착수 가능 |

**수시 Report**: StudentRecordFull → HTML → Word/PDF 자동 생성

---

### Phase 9.1~9.1d — 수시 Report 자동 생성 ✅ 완료

> **완료일**: 2026-03-19 (9.1~9.1d 동일 세션)

**기술 선택**: HTML 인쇄 최적화 + `window.print()` (PDF 저장)
- npm 의존성 0개 (Vercel Hobby 1GB 제한 호환)
- 기존 서비스 함수 100% 재사용, 새 DB 테이블 없음
- 엑셀 진단Report Sheet 4+9+10 **전부 커버**

**서브 Phase 이력**:
| Phase | 내용 |
|-------|------|
| 9.1 | 기본 7개 섹션 (Cover/Score/Competency/Diagnosis/Mock/Application/Strategy) |
| 9.1b | +StorylineSection, +WarningSection, CompetencySection narrative+evidence 보강, DiagnosisSection 추천전공+이수적합 확장, ApplicationSection 경쟁률+면접+수능최저 |
| 9.1c | CompetencySection 루브릭 Q&A + evidence_summary 텍스트 표시, DiagnosisSection 추천교과목(일반/진로) |
| 9.1d | 42행 루브릭 질문별 분석 그리드 (`rubric-matcher.ts` 문자열 역매핑, DB 변경 없음) |

**Server Action** (`lib/domains/student-record/actions/report.ts`):
- `fetchReportData(studentId)` → `ActionResponse<ReportData>`
- `requireAdminOrConsultant()` 가드
- `Promise.all` 병렬 호출: internalAnalysis + internalScores + mockAnalysis + recordTabData×학년 수
- 2차 병렬: diagnosisData + storylineData + strategyData

**ReportData 타입** (action 파일 인라인 정의):
- `student`: name, schoolName, grade, className, targetMajor
- `internalAnalysis`: totalGpa, adjustedGpa, zIndex, subjectStrength
- `internalScores`: 과목별 상세 (등급, 환산, 조정등급, 추정백분위)
- `mockAnalysis`: 평균백분위, 표준점수합, 등급합
- `recordDataByGrade`: 학년별 세특/창체/행특/독서/출결
- `diagnosisData`: 역량평가(AI/컨설턴트), 진단, 이수적합도, activityTags
- `storylineData` / `strategyData`: 스토리라인, 지원현황+최저시뮬

**9개 Report 섹션** (`app/.../report/sections/`):
| # | 컴포넌트 | 주요 내용 | 엑셀 대응 |
|---|----------|----------|----------|
| 1 | `CoverSection.tsx` | 학생명, 학교, 학년, 컨설턴트, 날짜 | - |
| 2 | `ScoreSection.tsx` | GPA 요약(3카드) + 교과군별 + 과목별 상세 | - |
| 3 | `CompetencySection.tsx` | 10항목 등급요약 + 항목별 narrative + **42행 루브릭 질문별 그리드**(+/-/근거) | **Sheet 4+9** |
| 4 | `DiagnosisSection.tsx` | 종합등급/방향/강도 + 강점·약점 + 추천전공 + **추천교과목(일반/진로)** + 이수적합도 확장 | **Sheet 10** |
| 5 | `StorylineSection.tsx` | 스토리라인 카드(강도+키워드+학년별 테마) + 로드맵 테이블 | - |
| 6 | `MockSection.tsx` | 평균백분위, 표준점수합, 상위3등급합 | - |
| 7 | `ApplicationSection.tsx` | 지원리스트(경쟁률+면접일) + 면접충돌 + **수능최저 시뮬레이션** | - |
| 8 | `StrategySection.tsx` | 우선순위/영역/내용/상태 테이블 | - |
| 9 | `WarningSection.tsx` | 경보 엔진 결과(카테고리별 그룹+severity+제안) | - |

**루브릭 역매핑** (`lib/domains/student-record/rubric-matcher.ts`):
- `extractRubricQuestion()`: evidence_summary에서 `루브릭: ...` 추출
- `findRubricQuestionIndex()`: 정확→접두사→포함 3단계 매칭
- `aggregateTagsByQuestion()`: 항목별 태그를 42개 질문별 집계

**GPA null 처리** (2022 성취평가제):
- `totalGpa=null` → `adjustedGpa` 표시 + "조정등급 기준" 표기
- 둘 다 null → "산출 불가", 성취도: `B(≈3등급)` 형식

**인쇄 최적화** (`app/globals.css` + `RoleBasedLayout.tsx`):
- `@media print`: A4 세로 15mm/12mm, 라이트 강제, nav 숨김
- `print-break-before` / `print-avoid-break` 클래스

**라우트**: `/admin/students/[id]/report` (새 탭)
- `StudentRecordClient.tsx`에 "Report 생성" 버튼 (사이드바 하단)

---

### Phase 9.2 — AI 활동 요약서 ✅ 완료

> **완료일**: 2026-03-19

**목적**: 학생이 담임교사에게 제출할 활동 정리본 자동 생성 (학생 관점 1인칭)

**구현**:
- LLM: Gemini standard (temperature 0.3)
- 7개 섹션: intro / subject_setek / personal_setek / changche / reading / haengteuk / growth
- DB: `student_record_activity_summaries` 테이블 (prompt_version: `v1`)
- 상태: draft → confirmed → published (학생 공개)

**주요 파일**:
| 파일 | 역할 |
|------|------|
| `llm/prompts/activitySummary.ts` | 시스템/사용자 프롬프트 + JSON 파서 |
| `llm/actions/generateActivitySummary.ts` | Server Action (fetchReportData → Gemini → DB) |
| `actions/activitySummary.ts` | CRUD (fetch/status/edit/delete) |
| `ActivitySummaryPanel.tsx` | Admin UI (생성/편집/상태전환/삭제) |

---

### Phase 9.3 — 세특 방향 가이드 ✅ 완료

> **완료일**: 2026-03-19

**목적**: 컨설턴트 내부용 과목별 세특 작성 방향 제안 (학생/학부모 비공개)

**설계 결정**:
- DB: `student_record_activity_summaries` 재사용 (prompt_version: `guide_v1`, 신규 테이블 X)
- LLM: Gemini standard (설계 문서의 Claude standard → 프로젝트 Gemini 통일)
- 입력: RecordTabData(세특+창체) + DiagnosisTabData(역량점수+강점/약점) + StorylineTabData
- 상태: draft → confirmed만 (published 불필요 — 내부용)

**출력 구조** (과목별 JSON):
```json
{
  "title": "세특 방향 가이드",
  "guides": [{
    "subjectName": "수학",
    "keywords": ["미적분 응용", "실생활 모델링"],
    "competencyFocus": ["academic_inquiry"],
    "direction": "서술 방향 3-5문장",
    "cautions": "주의사항",
    "teacherPoints": ["교사 전달 포인트"]
  }],
  "overallDirection": "전체 방향 요약"
}
```

**주요 파일**:
| 파일 | 역할 |
|------|------|
| `types.ts` | `SetekGuideItem` 타입 |
| `llm/types.ts` | `SetekGuideInput` / `SetekGuideResult` |
| `llm/prompts/setekGuide.ts` | 시스템/사용자 프롬프트 + JSON 파서 |
| `llm/actions/generateSetekGuide.ts` | Server Action |
| `actions/activitySummary.ts` | `fetchSetekGuides()` (prompt_version 필터) |
| `SetekGuidePanel.tsx` | Admin UI (과목별 카드: 키워드 pill + 방향 + 교사 포인트) |

**StudentRecordClient 위치**: 설계 스테이지 > 활동 요약서 다음 (`sec-setek-guide`)

---

### Phase 9.2~9.3 배포 핫픽스 (2026-03-20)

배포 후 발견된 3건 수정:

| 이슈 | 원인 | 수정 |
|------|------|------|
| `PGRST205` activity_summaries 테이블 없음 | 마이그레이션 미적용 + parent RLS 함수명 오류 (`rls_check_parent_linked` → `rls_check_parent_student`) | 원격 DB에 `apply_migration` 직접 적용 + 로컬 마이그레이션 파일 수정 |
| `diagnosis_status_check` 위반 | `DiagnosisComparisonView.tsx`에서 AI 진단 저장 시 `status: "suggested"` 사용 — diagnosis CHECK는 `'draft'\|'confirmed'`만 허용 | `"suggested"` → `"draft"` 변경 |
| `analyzeWithHighlight` JSON 파싱 실패 | Gemini가 닫는 백틱 없이 응답하는 경우 코드블록 제거 실패 | `parseHighlightResponse`에 닫는 백틱 없는 코드블록 fallback 추가 |

---

### CMS 트랙 (C1~C5)

> 메인 트랙 Phase 3 이후 독립 착수. 인터페이스(guide_assignments)만 공유.

| Phase | 내용 | 핵심 산출물 |
|-------|------|------------|
| **C1** ✅ | DB 이관 + 7,836건 Import | `20260332500000_cms_guide_tables.sql`, 정션 23,990건, 테스트 25개 |
| **C1.1** ✅ | 배정/검색/추천 Admin UI (9.4 통합) | ExplorationGuidePanel + 5컴포넌트, Server Actions 8개, Query Options 5개 |
| **C2** ✅ | 가이드 CRUD UI + TipTap 에디터 + Supabase Storage | `/admin/guides` 목록·편집·생성, actions/crud.ts, guide-images bucket |
| **C3** | AI 생성 (5가지 소스) + 적대적 검증 + 유사도 탐지 | 원클릭 가이드 생성 |
| **C4** | 버전 관리 + 품질 시스템 + 학생 피드백 | guide_feedback 테이블 |
| **C5** | 학생 APP 가이드 뷰 + 모드 A/B/C 연동 | 학생 탐구 활동 지원 |

#### 외부 데이터 소스 (Google Drive)

> CMS C1 이관 및 우회학과 기능 착수 시 아래 파일 참조.

**기본 경로**: `~/Library/CloudStorage/GoogleDrive-eduatalk23@gmail.com/내 드라이브/에듀엣톡(주)★/4. 웹앱개발업무/`

##### A. 탐구 가이드 DB (CMS C1 원본)

경로: `4. 라이선스 개발(DB)_생기부레벨업(가이드)/`

| 파일/디렉토리 | 내용 | 비고 |
|-------------|------|------|
| `엑세스 시스템/ver2/탐구DB_ver2_4.accdb` | **최신 Access DB** (46MB, 2025-11-21) | C1 이관 대상 — 7,836건 가이드 |
| `엑세스 시스템/ver2/Images/` | Access UI 스크린샷 54장 | 기존 시스템 구조 파악용 |
| `엑세스 시스템/ver1/탐구DB_7_4차_6.accdb` | ver1 최종본 (26MB) | ver2로 대체됨, 참고용 |
| `1차 탐구DB 프레임 완성본/` | **과목별 원본 가이드 docx** | 19개 폴더 (국어/수학/사회/과학/영어/…) |
| `1차 탐구DB 프레임 완성본/[영업비밀 1급] 탐구DB 개요.xlsx` | DB 구조/스키마 개요 | 테이블 설계 참고 |
| `1차 탐구DB 프레임 완성본/[영업비밀 1급] 탐구DB 수량.xlsx` | 과목/영역별 가이드 건수 통계 | 이관 검증용 |
| `# 1. 나침반 36.5/` | 나침반 36.5 월간지 PDF (2024~2025) | 탐구주제 원본 소스 |
| `# 2. 과학동아/` | 과학동아 월간지 PDF (2025~2026) | 탐구주제 원본 소스 |

**과목별 가이드 원본 구조** (`1차 탐구DB 프레임 완성본/`):
```
0. 실험및 연구활동/       — 실험·연구 활동 가이드 docx
0. 자율및 자치활동/       — 자율활동 가이드 docx
0. 주제탐구활동/          — 주제탐구 활동 가이드 docx
1. 국어과/               — 과목별 docx (공통/일반선택/진로선택)
2. 수학과/
3. 사회과/
4. 과학과/
5. 영어과/
6. 도덕과/
7. 미술과/ / 음악과/ / 체육과/
8. 제2외국어/
9. 신문기사/             — 시사 기반 탐구 가이드
9. 추천도서/             — 독서 기반 탐구 가이드
10. 나침반36.5/          — 학과별 탐구주제 확장 docx (19개 학과)
```

##### B. 우회학과 DB (CMS C1.5 — ✅ 구현 완료, DB Import 완료)

> 설계 문서: `docs/student-record-extension-design.md` E25
> 적대적 리뷰: `docs/bypass-major-adversarial-review.md` (2026-03-20)

**구현 완료 (2026-03-20)**:
- P0 게이트 통과: mdb-tools CSV 추출 정상, 11개 테이블, OLE 없음
- DB 5테이블 마이그레이션 적용 + 데이터 Import 완료

| 테이블 | 건수 | 소스 |
|--------|------|------|
| `university_departments` | 3,658 | 학과조회4.accdb `대학교 학과` |
| `department_curriculum` | 43,316 | 학과조회4.accdb `대학교 학과 커리큘럼` |
| `department_classification` | 191 | 학과조회4.accdb `표준분류체계` |
| `bypass_major_pairs` | 5 | 학과조회4.accdb `우회학과 관리` (사전매핑 매우 적음) |
| `bypass_major_candidates` | 0 (런타임) | 학생별 탐색 후보 |

**도메인**: `lib/domains/bypass-major/` (types, repository, similarity-engine, constants, competency-matcher, explanation-generator, pipeline, candidate-generator, actions 12개, import)
**Admin UI**: BypassMajorPanel("종합 분석" 버튼) + BypassTargetSelector + BypassCandidateList(역량 색상 코딩) + CurriculumComparisonView
**CLI**: `scripts/import-departments.ts`

**고도화 완료 (2026-03-20)**:
- 가중치 Jaccard: course_type 기반 (전공필수 3.0 ~ 교양 0.5), notes→course_type 정규화 마이그레이션
- 3필터 파이프라인 (`pipeline.ts`): 커리큘럼 40% + 배치 30%(예약) + 역량 30%
- 역량 매칭 (`competency-matcher.ts`): 22개 계열별 10항목 가중치
- 근거 텍스트 (`explanation-generator.ts`): 3줄 구조화
- 전과/복수전공 참조: 10개 대학 시드 (`university_transfer_policies`)
- 테스트 29개 (신규 22 + 기존 7)

---

## 4. 현재 상태 요약 (2026-03-20)

### 메인 트랙 완료 현황

```
Phase 1a~4.6   ✅ (DB 20테이블 + 도메인 + Admin UI + Import + NEIS 레이아웃)
Phase 5~7      ✅ (진단 + AI역량 + 하이라이트 + AI비교 + 후속탐구 + 경보 + 면접 + 보완전략)
Phase 8.1~8.6  ✅ (입시 DB + 환산 엔진 + 배치 판정 + 별칭 + 졸업생 검색)
  └ Phase 8.4  ⏸ (data.go.kr 기업 계정 가입 대기)
Phase 9.1~9.4  ✅ (수시 Report + AI 활동 요약서 + 세특 방향 가이드 + 활동 가이드 배정 UI)
CMS C1+C1.1+C2 ✅ (탐구 가이드 DB + Import + 배정 UI + TipTap CRUD 에디터)
CMS C1.5       ✅ (우회학과 DB 5테이블 + Import 47,170건 + 가중치 Jaccard + 3필터 파이프라인 + 역량 매칭 + 전과/복수전공)
Agent Phase A  ✅ (AI SDK v6 마이그레이션 — 17개 LLM action 전환)
Agent Phase B  ✅ (오케스트레이터 13도구 + API + Chat UI + 사이드패널 + 독립페이지)
Agent Phase C  ✅ (pgvector 마이그레이션 + 임베딩 서비스 + 벡터 검색 + 배치 스크립트 + on-save 훅)
Agent Phase D  ✅ (입시 배치 6도구 — 배치분석 + 필터 + 6장배분 + What-If + closure 캐시)
Agent Phase E  ✅ (면접 코칭 3도구 + 리포트 3도구 + PDF/Word 내보내기)
CMS C2.5       ✅ (Imagen 3 AI 이미지 생성 + 에디터 통합)
CMS C3~C4      ✅ (AI 가이드 생성 + PDF/URL 추출 + 버전 관리)
CMS C5         ✅ (학생 앱 탐구 가이드 뷰)
운영 안정화     ✅ (스트림 에러 로깅 + allSettled + null 가드 + JSON 파싱 + 에러 분류 UI)
```

### 남은 작업 및 차단 관계

| 작업 | 상태 | 차단 요인 | 비고 |
|------|------|-----------|------|
| **Phase 8.4** (입시 DB 갱신) | ⏸ 보류 | data.go.kr 기업 계정 | 외부 의존 |
| ~~Agent Phase E~~ | ✅ 완료 | — | 면접 3도구 + 리포트 3도구 + PDF/Word |
| ~~CMS C2.5~C5~~ | ✅ 완료 | — | AI 이미지 + AI 생성 + 버전 관리 + 학생 앱 |
| ~~운영 안정화~~ | ✅ 완료 | — | P0 3건 + P1 4건 |
| ~~우회학과 고도화~~ | ✅ 완료 | — | 가중치 Jaccard + 3필터 파이프라인 + 역량 매칭 + 전과/복수전공 |
| Report P4 (rubric DB 정규화) | ~~미착수~~ 불필요 | — | 문자열 역매핑으로 충분 (9.1d에서 결정) |

### 추천 다음 작업

**전 트랙 완료** (2026-03-20). 남은 작업:

**Phase 8.4 (입시 DB 갱신 + 알림)**
- data.go.kr 기업 계정 확보 후 자동 갱신 파이프라인 (외부 차단)

---

## 5. 의존관계 그래프

```
[Critical Path — 가장 긴 경로]

1a ──→ 1c ──→ 2 ──→ 3 ──→ 4 ──→ 5 ──→ 5.5 ──→ 6 ──→ 7 ──→ 9
 │                    │                              │
 └→ 1b               ├→ 3.5                         ├→ 6.5
                      └→ 4.5                         └→ 8.1 ──→ 8.2 ──→ 8.5
                                                      │
                                                      ├→ 8.3
                                                      ├→ 8.4
                                                      └→ 8.6

[CMS Track — 독립 경로]

(메인 3 완료 후) ──→ C1 ✅ ──→ C1.1 ✅ ──→ C2 ✅ ──→ C3 ✅ ──→ C4 ✅ ──→ C5 ✅

[Agent Track — 독립 경로, docs/domain-agent-architecture.md 참조]

Phase A (AI SDK 마이그레이션) ✅ 2026-03-20
    ↓
Phase B (오케스트레이터 13도구 + Chat UI) ✅ 2026-03-20
    │
    ├── Phase C (pgvector + CMS RAG) ✅ 2026-03-20
    ├── Phase D (Agent 3: 입시 배치) ✅ 2026-03-20
    └── Phase E (Agent 5·6: 면접·리포트) ✅ 2026-03-20
         └── 운영 안정화 ✅ 2026-03-20
```

**전 트랙 완료** — CMS C1~C5, Agent A~E + 운영 안정화 + 우회학과 고도화 모두 완료.

---

## 6. DB 마이그레이션 파일 목록

| 파일 | Phase | 테이블 수 | 트랙 |
|------|-------|----------|------|
| `001_core_records.sql` | 1a | 6 | 메인 |
| `002_supplementary_records.sql` | 1b | 5 | 메인 |
| `003_extended_features.sql` | 1c | 9 | 메인 |
| `004_diagnosis.sql` | 5 | 4 | 메인 |
| `005_admission_db.sql` | 8.1 | 2 | 메인 |
| `admission_score_engine.sql` | 8.2 | 3 | 메인 |
| `percentage_conversions.sql` | 8.2b | 1 | 메인 |
| `university_name_aliases.sql` | 8.3 | 1 | 메인 |
| `activity_summaries.sql` | 9.2 | 1 | 메인 |
| `20260332500000_cms_guide_tables.sql` | C1 ✅ | 7+2 | CMS |
| `20260332800000_pgvector_guide_embedding.sql` | Agent C ✅ | — (컬럼+RPC) | Agent |
| `20260333000000_bypass_populate_course_type.sql` | C1.5 고도화 ✅ | — (UPDATE) | CMS |
| `20260333100000_university_transfer_policies.sql` | C1.5 고도화 ✅ | 1 + 시드 20행 | CMS |
| `C02_guide_feedback.sql` | C4 | 1 | CMS |
| **총** | | **41+** | |

각 마이그레이션에 대응하는 `down_*.sql` 사전 작성. Supabase 브랜치에서 테스트 후 프로덕션 적용.

---

## 7. AI 비용 및 인프라

### 월간 비용 추정 (84명 기준)

| 작업 | 빈도 | 프로바이더 | 월간 비용 |
|------|------|-----------|-----------|
| PDF Import | 14회 | Gemini 멀티모달 | $7~14 |
| 역량 태그 | 250회 | Gemini fast | $0.75 |
| 종합 진단 | 14회 | Claude standard | $4.2 |
| 보완전략 | 14회 | Gemini Grounding | $1.4 |
| 세특 초안 | 250회 | Claude advanced | $25 |
| 면접 질문 | 14회 | Claude standard | $2.8 |
| CMS 생성+검증 | 30회 | Claude+Gemini | $15~30 |
| **총** | | | **$56~78** |
| **LLM 캐시 적용 후** | | | **$30~50** |

### 인프라 활용

| 인프라 | 재사용 대상 | 신규 작업 |
|--------|-------------|-----------|
| Gemini provider | rate limiter, quota, retry | 프롬프트만 작성 |
| Claude provider | factory, cache | 프롬프트만 작성 |
| LLM 캐시 | TTL 기반 캐시 | operation type 등록만 |
| LLM 메트릭 | 토큰/비용/성공률 | 자동 적용 |
| earlyWarningService | 경보 프레임워크 | 경고 룰 추가만 |

---

## 8. 테스트 전략

| 계층 | 대상 | 케이스 | Phase |
|------|------|--------|-------|
| **단위** | validation.ts (NEIS 바이트 기준, 줄바꿈 2B, 공통과목 쌍) | 41 | 2 |
| **단위** | grade-normalizer.ts (9↔5등급) | 15+ | 2 |
| **단위** | min-score-simulator.ts | 20+ | 2 |
| **단위** | calculator.ts (정시 환산) | 25+ | 8.2 |
| **단위** | eligibility.ts (결격사유) | 15+ | 8.2 |
| **통합** | Repository CRUD | 40+ | 2 |
| **통합** | RLS 정책 (교차 tenant/역할) | 20+ | 1c |
| **통합** | AI 응답 파싱 | 10+ | 5.5 |

**원칙**: 결정론적 엔진(환산/시뮬레이션/검증)은 100% 자동 테스트. AI 제안은 mock 테스트.

---

## 9. 위험 관리

| 위험 | 확률 | 영향 | 대응 |
|------|------|------|------|
| Phase 1 마이그레이션 실패 | 중 | 높음 | 1a/1b/1c 분할 + down SQL + 브랜치 테스트 |
| Gemini rate limit 초과 | 높음 | 중 | LLM 캐시 + graceful degradation + DB fallback |
| AI 비용 초과 | 중 | 중 | 월간 모니터링 + $100 경고 + 캐시 TTL 조정 |
| CMS 공수 초과 | 높음 | 중 | 독립 트랙 분리 → 메인 트랙 영향 없음 |
| Vercel 5분 타임아웃 (PDF Import) | 중 | 중 | 2단계 처리 (클라이언트 이미지 추출 → 서버 파싱) |
| 다형 참조 고아 데이터 | 낮음 | 중 | cleanup_polymorphic_refs 트리거 |
| 입시 데이터 갱신 누락 | 중 | 높음 | 4단계 갱신 사이클 + 전형 변경 알림 push |

---

## 10. 착수 체크리스트

### Phase 1 착수 전 확인 — ✅ 2026-03-17 완료

- [x] `student-record-implementation-plan.md` v5 최종 검토 완료
- [x] `student-record-extension-design.md` v6 최종 검토 완료
- [x] 기존 `subjects`, `student_terms`, `students` 테이블 현행 스키마 확인
- [x] `rls_check_admin_tenant()` 존재 확인
- [x] `rls_check_student_own()` Phase 1a에서 신규 생성
- [x] `pnpm build` 빌드 성공 확인

### Phase 1 완료 결과 — ✅ 2026-03-17

| Phase | 마이그레이션 | 테이블 | RLS | 트리거 | 인덱스 |
|-------|-------------|--------|-----|--------|--------|
| 1a | `20260331000000_student_record_core.sql` | 6 | 17 | 9 | 16 |
| 1b | `20260331100000_student_record_supplementary.sql` | 5 | 13 | 2 | 12 |
| 1c | `20260331200000_student_record_extended.sql` | 9 | 22 | 5 | 18 |
| **합계** | **3개 파일** | **20** | **52** | **16** | **46** |

### Phase 2 착수 전 확인

- [ ] Phase 1 마이그레이션 원격 적용 확인 (완료)
- [ ] `database.types.ts` 20개 테이블 타입 존재 확인 (완료)
- [ ] `lib/domains/student-record/` 디렉토리 생성
- [ ] 기존 `lib/domains/` 패턴 확인 (plan, score, school 등)
