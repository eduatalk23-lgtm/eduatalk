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
```

---

## 2. 마일스톤 요약

| 마일스톤 | Phase | 핵심 가치 | 사용자 영향 |
|----------|-------|-----------|------------|
| **M1: 기록 시스템 MVP** | 1a~3 | 세특/창체/행특/독서 수동 CRUD | 컨설턴트가 생기부를 시스템에 입력 가능 |
| **M2: 컨설팅 도구** | 3.5~4 | 지원전략 + 학부모 뷰 + 최저 시뮬 | 학부모 상담, 수시 전략 수립 |
| **M3: AI 진단** | 5~6.3 | 역량 태그 + 인라인 하이라이트 + 종합 진단 + 경보 | AI가 세특을 분석하여 역량 근거를 시각적으로 제시, 컨설턴트 검토/확정 |
| **M4: 대입 전략** | 7~8.6 | 배치분석 + 환산엔진 + 졸업생 DB | 정시 배치표 자동 생성 |
| **M5: AI 고도화** | 9 | 활동 요약서 + Report 생성 | 수시 Report 자동 발행 |
| **M-CMS: 탐구 가이드** | C1~C5 | 7,836건 가이드 DB + AI 생성 | Access DB 완전 대체 |

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
- [ ] **저장 동작 확인** (QueryClient 에러 + 과목명 prefix 수정 후 재테스트 필요)
- [ ] 이미지 업로드 테스트
- [ ] 독서활동 파싱 개선 (HTML에서 0건 — 비공개 아닌 학생으로 재확인)
- [ ] 성적(grades) 데이터 scores 테이블 연동

**남은 작업**:
- DB 저장 E2E 검증 (QueryClient 에러 해결 후)
- 독서활동 HTML 파싱 개선
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
- [ ] Import → 성적 자동 저장 E2E 테스트
- [ ] 성적 인라인 추가/삭제 E2E 테스트

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

**P0 (즉시 반영 — 기존 코드/상수 활용)**:
1. **추천 교과목 표시** — `MAJOR_RECOMMENDED_COURSES` 상수 이미 존재, DiagnosisComparisonView에서 전공 선택 시 일반/진로 추천 과목 자동 표시
2. **10항목 등급 요약 테이블** — 종합진단 섹션 상단에 AI/컨설턴트 등급 비교표 (컴팩트 10행 테이블)

**P1 (DB 스키마 추가 필요)**:
3. **항목별 해석 서술(narrative)** — `competency_scores`에 `narrative` text 필드 추가, AI가 항목별 2-3문장 해석 생성
4. **근거 활동 집계** — 항목별 어떤 activity_tags가 기여했는지 그룹핑 뷰 (태그 count + 대표 근거)

**P2 (큰 작업)**:
5. **루브릭 질문별 분석 그리드** (Sheet 4) — 42행 테이블, 질문별 태그 매핑
6. **인쇄용 보고서 PDF** (Sheet 9+10) — Phase 9 Report 생성과 통합

---

### Phase 6.2 — 세특 3구간 분리 (학업태도/수행능력/탐구활동)

> **목표**: 로드맵 템플릿 패턴에 맞춰 세특 텍스트를 3구간으로 자동 분류

**참고 원본**: 설계 로드맵 템플릿의 과목별 세특 구조:
```
과목 세부능력 및 특기사항
├── 학업태도      — "수업 참여도", "적극적 발표", "성실한 과제 수행"
├── 학업수행능력   — "개념 이해 우수", "문제 해결력", "높은 성취도"
└── 탐구활동      — "심화 탐구", "보고서 작성", "독서 연계 확장"
```

학교활동 요약 문서에서는 이를 **학업역량/진로역량 2열**로 더 축약.

**구현 방향**:
- AI가 세특 텍스트를 3구간으로 자동 분류
- 각 구간에 해당하는 역량 항목 자동 매핑
- 시각적으로 구간 경계 표시 (접이식 섹션)

**의존**: Phase 6.1 (하이라이트 기반)
**파일 수**: ~4개 (프롬프트 확장 + UI 구간 렌더러)

---

### Phase 6.3 — 학년간 후속탐구 연결 (3순위)

> **목표**: 학교활동 요약 문서의 `ㄴ(2학년 수학1)` 패턴 자동 감지 + 스토리라인 연결

**참고 원본**: 학교활동 요약 문서의 탐구 연결 패턴:
```
1학년 수학: 연립방정식과 CT 촬영 원리
  ㄴ(2학년 수학1) 독서 <세계를 바꾼 17가지 방정식> → 푸리에변환
    ㄴ(2학년 화학Ⅰ) 이온화 방사선과 인체에 미치는 영향
```

**구현 방향**:
- AI가 전체 세특 분석 시 학년간 주제 연결 자동 감지
- 기존 스토리라인 기능과 통합 (storyline_links 활용)
- "이 탐구는 X학년 Y과목의 탐구와 연결됩니다" 자동 제안

**의존**: Phase 6.1 + 기존 스토리라인 시스템 (Phase 3c)
**파일 수**: ~5개 (프롬프트 + 연결 감지 액션 + UI)

---

### Phase 6.5 — 조기 경보 + AI 면접 질문

> **목표**: 생기부 관련 자동 경고 + 면접 예상 질문 AI 생성

| 항목 | 내용 |
|------|------|
| **AI** | 규칙 기반 + Claude standard |
| **의존** | Phase 6.1 |
| **파일 수** | ~8개 |

**경고 룰** (11개):
```
기록:     missing_career_activity, major_subject_decline, changche_empty,
          haengteuk_draft, reading_insufficient
이수:     course_inadequacy
스토리라인: storyline_weak, storyline_gap, storyline_inconsistent
최저:     min_score_critical, min_score_bottleneck, min_score_trend_down
```

**면접 질문 유형**: factual(20%), reasoning(30%), application(20%), value(15%), controversial(15%)

---

### Phase 7 — 보완전략 + AI 제안

> **목표**: 진단 weaknesses 기반 보완전략 AI 제안 (Gemini Grounding)

| 항목 | 내용 |
|------|------|
| **AI** | Gemini Grounding (웹 검색) |
| **의존** | Phase 6 |
| **파일 수** | ~7개 |

---

### Phase 8.1~8.6 — 대학 입시 DB + 배치 분석

> **목표**: 26,777건 입시 DB + 정시 환산 엔진 + 배치 판정 + 졸업생 검색

| Sub-Phase | 내용 | 의존 |
|-----------|------|------|
| **8.1** | Excel 26,777건 이관 + 교과전형 grade_weight JSONB + 진로선택 3단계 | Phase 4 |
| **8.2** | 정시 환산 엔진 + 결격사유 + 자동 테스트 25+ | 8.1 |
| **8.3** | data.go.kr API 연동 | 8.1 |
| **8.4** | 연간 4단계 갱신 + 전형 변경 알림 (push) | 8.1 |
| **8.5** | 모평 배치 자동 분석 + 가채점/실채점 + 6장 최적 배분 + 충원 시뮬 | 8.2 |
| **8.6** | 졸업생 SQL 검색 | 8.1 |

**8.5 배치 판정 레벨**: danger < unstable < bold < possible < safe + possible_with_replacement(충원)

---

### Phase 9 — AI 활동 지원 3모드 + Report

> **목표**: AI 활동 요약서 + 세특 방향 가이드 + 수시 Report 자동 생성

| 모드 | 대상 | 출력 | AI |
|------|------|------|-----|
| A. 활동 요약서 | 학생 → 교사 제출 | 학생 관점 정리본 | Claude standard |
| B. 세특 방향 가이드 | 컨설턴트 내부용 | 핵심 역량·키워드 | Claude standard |
| C. 활동 가이드 | 학생 직접 사용 | 탐구 수행 안내서 | 불필요 (DB 원본) |

**수시 Report**: StudentRecordFull → HTML → Word/PDF 자동 생성

---

### CMS 트랙 (C1~C5)

> 메인 트랙 Phase 3 이후 독립 착수. 인터페이스(guide_assignments)만 공유.

| Phase | 내용 | 핵심 산출물 |
|-------|------|------------|
| **C1** | DB 이관: exploration_guides 3분할 + Access 7,836건 | C01_guide_tables.sql, 이관 스크립트 |
| **C2** | 가이드 CRUD UI + 리치 텍스트 에디터 (수식/이미지) | Access 완전 대체 |
| **C3** | AI 생성 (5가지 소스) + 적대적 검증 + 유사도 탐지 | 원클릭 가이드 생성 |
| **C4** | 버전 관리 + 품질 시스템 + 학생 피드백 | guide_feedback 테이블 |
| **C5** | 학생 APP 가이드 뷰 + 모드 A/B/C 연동 | 학생 탐구 활동 지원 |

---

## 4. 의존관계 그래프

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

(메인 3 완료 후) ──→ C1 ──→ C2 ──→ C3 ──→ C4 ──→ C5
```

**병렬 가능 조합**:
- Phase 3.5 + Phase 4 + Phase 4.5 (모두 Phase 3 이후, 상호 독립)
- Phase 6.5 + Phase 7 (모두 Phase 6 이후)
- Phase 8.3 + Phase 8.4 + Phase 8.6 (모두 Phase 8.1 이후)
- CMS C1~C5 전체 (메인 트랙과 독립)

---

## 5. DB 마이그레이션 파일 목록

| 파일 | Phase | 테이블 수 | 트랙 |
|------|-------|----------|------|
| `001_core_records.sql` | 1a | 6 | 메인 |
| `002_supplementary_records.sql` | 1b | 5 | 메인 |
| `003_extended_features.sql` | 1c | 9 | 메인 |
| `004_diagnosis.sql` | 5 | 4 | 메인 |
| `005_admission_db.sql` | 8.1 | 2 | 메인 |
| `C01_guide_tables.sql` | C1 | 5 | CMS |
| `C02_guide_feedback.sql` | C4 | 1 | CMS |
| **총** | | **32** | |

각 마이그레이션에 대응하는 `down_*.sql` 사전 작성. Supabase 브랜치에서 테스트 후 프로덕션 적용.

---

## 6. AI 비용 및 인프라

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

## 7. 테스트 전략

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

## 8. 위험 관리

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

## 9. 착수 체크리스트

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
