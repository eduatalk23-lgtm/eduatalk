# Student Record Domain Rules

## Scope
생기부 관리, 역량 진단, 성적 정규화, NEIS 검증, 데이터 import/export, 수강 계획, 경고 엔진, 면접 준비, 전략 관리.

## Architecture
```
student-record/
├── index.ts              # Public API (client-safe exports만)
├── service.ts            # 비즈니스 로직 (NEIS 바이트 검증, 줄바꿈 정규화)
├── repository.ts         # 데이터 접근 (탭별 lazy loading)
├── types.ts              # 60+ 타입 (RecordSetek, Diagnosis, Strategy 등)
├── constants.ts          # CHAR_LIMITS, COMPETENCY_ITEMS, GRADE_CONVERSION_TABLE
├── validation.ts         # countNeisBytes(), detectNeisInvalidChars()
├── grade-normalizer.ts   # grade9To5(), grade5To9(), normalizeGrade()
├── rubric-matcher.ts     # 역량 루브릭 매칭 엔진
├── min-score-simulator.ts # 수능최저 시뮬레이션
├── course-adequacy.ts    # 전공 적합 교과 분석
├── stale-detection.ts    # 데이터 신선도 감지
├── warnings/             # 경고 엔진 (engine.ts, types.ts)
├── course-plan/          # 수강 계획 (recommendation.ts, sync.ts)
├── import/               # parser → extractor → mapper → importer 체인
├── export/               # report-export.ts
├── leveling/             # L0~L6 설계 모드 레벨링 (engine.ts, types.ts, resolve-tier.ts)
├── pipeline/             # → record-analysis/pipeline (re-export stub)
├── llm/                  # → record-analysis/llm (re-export stub)
└── eval/                 # → record-analysis/eval (re-export stub)
```

**AI 분석/파이프라인 코드**는 별도 도메인 `lib/domains/record-analysis/`로 분리됨.
- `pipeline/`, `llm/`, `eval/`은 student-record에 re-export stub만 남고 실제 구현은 record-analysis/에 있음.
- 기존 import 경로(`@/lib/domains/student-record/{pipeline,llm,eval}/...`)는 stub을 통해 100% 호환 유지.
- 새로운 코드는 가급적 `@/lib/domains/record-analysis/...`를 직접 import할 것.
- 자세한 파이프라인 아키텍처는 `lib/domains/record-analysis/CLAUDE.md` 참조.

## Enforced Rules

1. **NEIS 바이트 카운팅 (2계층)**: "500자" = 1500바이트. 한글=3B, ASCII=1B, 줄바꿈=2B.
   - **NEIS 제한 검증** (저장/표시): 반드시 `countNeisBytes()` + `validateNeisContent()` 사용. `detectNeisInvalidChars()`로 이모지 검출. → `service.ts`, `CharacterCounter.tsx`
   - **콘텐츠 실질성 휴리스틱** (경고/AI필터/배치추정): `string.length` 사용 OK. "내용이 있는가?" "AI에 보낼 만한가?" 판별에는 string.length가 한/영 공정하고 토큰 수 근사로도 적절.
2. **성적 정규화**: 9등급/5등급 양방향 변환. `GRADE_9_TO_5_MAP`, `GRADE_5_TO_9_MAP` 사용. 2022 개정은 진로선택 A/B/C (숫자 등급 없음). 비교/표시 전 `normalizeGrade()` 필수.
3. **역량 루브릭**: `COMPETENCY_RUBRIC_QUESTIONS`, `COMPETENCY_GRADE_RUBRICS` 상수 사용. 루브릭 기준 하드코딩 금지.
4. **Import 파이프라인**: parser → extractor → mapper → importer 체인. 각 단계 독립 테스트 가능해야 함.
5. **Client/Server 경계**: `index.ts`는 client-safe만 export. `repository.ts`, `service.ts`는 server-only. 클라이언트 컴포넌트에서 import 금지.
6. **타입 완전성**: RecordType union의 모든 variant를 switch에서 처리할 것.

## 생기부 평가 프레임워크 (입시 전문가 기준)

### 정량평가 핵심 (중요도 순)
1. 주요교과 내신성적 → `academic_achievement` + 루브릭 4개 질문
2. 진로(계열)교과 성취도 → `career_course_achievement` + `course-adequacy.ts`
3. 학기별 성적 추이 → 합격자는 3학년 1학기 상승 뚜렷

### 정성평가 핵심 (중요도 순)
1. 진로교과 세특 (~40%) — 가장 변별력 높은 영역
2. 진로교과 이수 (~30%) — 관문 역할
3. 동아리/진로 창체 세특 (~30%) — 세특 보완 역할

### 좋은 세특 8단계 순환 흐름
```
①지적호기심 → ②주제선정(진로연결) → ③탐구내용/이론 → ④참고문헌
→ ⑤결론(해결/제언/고안) → ⑥교사관찰(구체적 근거) → ⑦성장서사
→ ⑧오류분석→재탐구 (→①순환)
```

### 진로교과 vs 비진로교과 차등 (대학 수준별)
- **진로교과**: 최소 ①②③⑤ 충족 필수. SKY카+는 ①②③④⑤(참고문헌 포함)
- **비진로교과**: 교과 역량 중심이 정상. 진로 연결 없어도 감점 없음
- **진로 연결 비율**: 상위권=가능한 모든 진로교과, 중하위=3~4과목
- **주의**: 모든 교과에 진로 도배하면 역효과 (입학사정관 감점, F16=major)

### 창체 가중치: 동아리 = 진로 (동등) > 자율

### 합격률 낮은 패턴 14개 (경고 엔진 반영)
- P1 나열식 / P3 키워드만 / P4 내신↔탐구불일치(critical)
- F1~F6: 별개활동포장, 인과단절(critical), 출처불일치, 전제불일치, 비교군오류, 자명한결론
- F10 성장부재(minor) / F12 자기주도성부재 / F16 진로과잉도배(major) / M1 교사관찰불가(minor)

### 품질 5축 평가 (ContentQualityScore)
specificity(25) + coherence(15) + depth(25) + grammar(10) + scientificValidity/연구정합성(25) = overallScore
- 이공계: 과학·수리적 정합성 / 인문·사회계: 사회연구방법론 정합성

## Pipeline Architecture (청사진)

### 콘텐츠 해소 우선순위 (4-layer)
```
imported_content(NEIS 최종) > confirmed_content(확정본) > content(가안) > ai_draft_content(AI 초안)
```
pipeline-data-resolver.ts, pipeline-unified-input.ts, phase-s6-interview.ts 모두 동일 우선순위 적용.
grade-stage.ts의 stage 판정 로직과 일치: final > confirmed > consultant > ai_draft > prospective.

### 3-Tier 파이프라인 구조

```
Grade Pipeline (학년별, 9태스크×8Phase)
  P1: competency_setek        → ctx.analysisContext에 축적
  P2: competency_changche     → ctx.analysisContext에 축적
  P3: competency_haengteuk    → ctx.analysisContext에 축적 + 집계
  P4: setek_guide + slot_generation  ← analysisContext 주입 (issues/feedback/약점)
  P5: changche_guide                 ← analysisContext 주입 (community 우선)
  P6: haengteuk_guide                ← analysisContext 주입 (community만)
  P7: draft_generation               ← 설계 모드 전용, 레벨링 주입(L2) + 방향 가이드 기반 AI 가안
  P8: draft_analysis                 ← 가안 역량 분석 (tag=draft_analysis, scores=ai_projected, edges=projected)

Synthesis Pipeline (종합, 10태스크×6Phase)
  S1: storyline_generation
  S2: edge_computation + guide_matching
  S3: ai_diagnosis + course_recommendation  ← aggregateQualityPatterns 주입
  S4: bypass_analysis
  S5: activity_summary + ai_strategy       ← qualityPatterns 주입
  S6: interview_generation + roadmap_generation
```

### Phase 간 데이터 흐름 (핵심)

```
Phase 1-3 (역량 분석)
  ├─ DB: analysis_cache(전체 JSON), activity_tags, competency_scores, content_quality
  ├─ ctx.analysisContext: 가공된 요약만 (issues있는 레코드 + B-이하 역량)
  │
  ├──→ Phase 4-6: toGuideAnalysisContext() → 프롬프트에 감지 패턴+피드백+약점 주입
  │     (세특: 전체, 창체: changche+community, 행특: haengteuk+community만)
  │
  └──→ Synthesis: aggregateQualityPatterns() → 전 학년 반복 패턴 집계
       (진단: qualityPatternSection, 전략: qualityPatterns[])
```

**원본 LLM 응답 전체는 DB에만 저장. Phase 간 전달과 프롬프트 주입은 가공된 요약만.**

### 태스크 의존성 가드 (pipeline-grade-phases.ts)

`GRADE_TASK_PREREQUISITES`(pipeline-types.ts): 선행 태스크가 failed이면 후속 태스크를 자동 스킵.

```
setek_guide       ← [competency_setek]
slot_generation   ← [competency_setek, competency_changche, competency_haengteuk]
changche_guide    ← [competency_setek, competency_changche, setek_guide]
haengteuk_guide   ← [전 competency + setek_guide + changche_guide]
draft_generation  ← [setek_guide, changche_guide, haengteuk_guide]
draft_analysis    ← [haengteuk_guide, draft_generation]
```

스킵된 태스크: `status="failed"`, `error="선행 태스크 실패로 건너뜀: ..."`. 재실행 cascade로 복구.

### 재실행 클린업 (pipeline-orchestrator.ts)

`rerunGradePipelineTasks()` 시 competency 태스크 재실행이면:
1. `analysis_cache` 삭제 (학생 전체, LLM 강제 재호출)
2. `deleteAnalysisResultsByGrade()`: 해당 학년의 scores(ai/ai_projected) + tags(analysis/draft_analysis) + quality(ai/ai_projected) 삭제
3. Synthesis pipeline → 전체 pending으로 리셋

### 동시성 보호 (DB 레벨)

`idx_unique_running_grade_pipeline`: 학생+학년 단위 running/pending 파이프라인 1개 제한.
`idx_unique_running_synth_pipeline`: 학생 단위 synthesis 파이프라인 1개 제한.
위반 시 23505 에러 → 사용자 친화적 메시지 반환.

### LLM 호출 재시도 (llm/retry.ts)

모든 파이프라인 LLM 호출에 `withRetry()` 적용: 1s → 3s → 10s 지수 백오프, 최대 3회.

### 핵심 헬퍼 함수 (pipeline-task-runners.ts)

| 함수 | 역할 | 호출 위치 |
|------|------|----------|
| `collectAnalysisContext()` | P1-3 결과에서 issues/약점 추출 → ctx 축적 | 세특/창체/행특 역량 분석 완료 시 (5곳) |
| `toGuideAnalysisContext()` | ctx → GuideAnalysisContext 변환 | 파이프라인 경로 가이드 호출 시 |
| `buildGuideAnalysisContextFromReport()` | reportData → GuideAnalysisContext 변환 | 비파이프라인 경로 (수동 재생성) |
| `aggregateQualityPatterns()` | 전 학년 DB 조회 → 반복 패턴 집계 | Synthesis 진단/전략 |
| `buildCrossGradeDirections()` | 이전 분석 학년 보완방향 텍스트 빌드 | Prospective 가이드 생성 시 |

### DB 테이블 (핵심)

| 테이블 | 역할 | 파이프라인 연관 |
|--------|------|---------------|
| `student_record_seteks` | 세특 원본/NEIS | 입력 |
| `student_record_changche` | 창체 원본/NEIS | 입력 |
| `student_record_haengteuk` | 행특 원본/NEIS | 입력 |
| `student_record_analysis_cache` | LLM 응답 전체 JSON + content_hash | 증분 캐시 |
| `student_record_activity_tags` | 역량 태그 (reasoning+highlight) | P1-3 출력, UI 표시 |
| `student_record_competency_scores` | 등급 + rubric_scores JSONB | P1-3 출력, 가이드/진단 참조 |
| `student_record_content_quality` | 5축 점수 + issues + feedback | P1-3 출력, 가이드 주입, UI 표시 |
| `student_record_diagnosis` | 종합진단 (강점/약점) | S3 출력 |
| `student_record_setek_guides` | 세특 방향 가이드 | P4 출력 |
| `student_record_changche_guides` | 창체 방향 가이드 | P5 출력 |
| `student_record_haengteuk_guides` | 행특 방향 가이드 | P6 출력 |
| `student_record_edges` | 레코드 간 연결 그래프 (`edge_context`: analysis/projected) | S2+P8 출력 |
| `student_record_strategies` | 보완전략 | S5 출력 |
| `student_record_analysis_pipelines` | 파이프라인 실행 상태 | 오케스트레이션 |

### 분석 데이터 3중 저장 전략 (D2)

P1-P3 역량 분석 결과는 3계층으로 저장. **의도적 설계이며 통합/제거 불필요.**

```
① analysis_cache (LLM 원본)
   - content_hash 기반 증분 캐시: 세특 내용 변경 없으면 LLM 재호출 스킵
   - 전체 JSON 저장 (디버깅/재파싱용)
   - 재실행 시: 해당 학년 전체 삭제 → LLM 강제 재호출

② activity_tags + competency_scores (구조화 데이터)
   - ①에서 파싱한 역량 태그, 등급, 루브릭 점수
   - UI 직접 표시 + Phase 4-6 가이드 입력
   - 재실행 시: deleteAnalysisResultsByGrade()로 삭제

③ content_quality (5축 품질 점수)
   - ①에서 파싱한 specificity/coherence/depth/grammar/scientific_validity
   - UI 표시 + Phase 4-6 프롬프트 주입 (issues/feedback)
   - 재실행 시: ②와 함께 삭제
```

**무결성 보장**: ①→②③ 파싱은 단일 트랜잭션(`runCompetencyForRecords`)에서 실행.
재실행 시 ①②③ 동시 삭제 후 재생성하므로 불일치 불가.

### 삭제 정책 (D4)

| 테이블 그룹 | 전략 | 이유 |
|------------|------|------|
| **코어 레코드** (seteks, personal_seteks, changche, haengteuk) | **소프트 삭제** (`deleted_at`) | RLS에서 `deleted_at IS NULL` 필터, undo 가능 |
| **독서** (reading) | **하드 삭제** (import 시 덮어쓰기) | PDF import 마다 전량 교체 |
| **파생/분석** (activity_tags, competency_scores, content_quality, edges) | **하드 삭제** | 파이프라인 재실행 시 전량 재생성 |
| **가이드** (setek/changche/haengteuk_guides) | **하드 삭제** (upsert) | 생성 시 기존 삭제 후 재삽입 |
| **링크** (storyline_links, reading_links) | **CASCADE 하드 삭제** | 부모(storylines/reading) 삭제 시 자동 삭제 |
| **캐시** (analysis_cache) | **하드 삭제** | content_hash 기반 증분 갱신 |
| **징계** (disciplinary) | **하드 삭제** | 관리자 직접 관리, 학생/학부모 열람 불가 |

### Polymorphic FK 패턴 (D3)

`activity_tags`, `storyline_links`, `reading_links`는 `record_type + record_id`로 세특/창체/행특을 다형 참조.
실제 FK 제약조건 없음 (PostgreSQL은 다형 FK 미지원). 대신:
- **트리거 `cleanup_polymorphic_refs()`** (core.sql): 부모 레코드 DELETE 시 자동 정리
- **CHECK 제약**: `record_type IN ('setek', 'personal_setek', 'changche', 'haengteuk', ...)`
- **코어 레코드 소프트 삭제**: 실제 행 삭제는 거의 발생하지 않아 고아 레코드 위험 최소

### 설계/분석 레이어 패턴 (L0~L6)

| 테이블 | 구분자 | 분석(NEIS 기반) | 설계(AI 가안) |
|--------|--------|---------|---------|
| activity_tags | `tag_context` | `analysis` | `draft_analysis` |
| competency_scores | `source` | `ai` | `ai_projected` |
| content_quality | `source` | `ai` | `ai_projected` |
| edges | `edge_context` | `analysis` | `projected` |
| guides | `guide_mode` | `retrospective` | `prospective` |

### LLM Actions (llm/actions/)

| 파일 | 주요 함수 | 모델 | 용도 |
|------|----------|------|------|
| `analyzeWithHighlight.ts` | `analyzeSetekWithHighlight()` | advanced (Gemini 2.5 Pro) | 역량 태깅 + 품질 점수 |
| `generateSetekGuide.ts` | `generateSetekGuide()`, `generateProspectiveSetekGuide()` | standard | 세특 방향 가이드 |
| `generateChangcheGuide.ts` | `generateChangcheGuide()`, `generateProspectiveChangcheGuide()` | standard | 창체 방향 가이드 |
| `generateHaengteukGuide.ts` | `generateHaengteukGuide()`, `generateProspectiveHaengteukGuide()` | standard | 행특 방향 가이드 |
| `generateDiagnosis.ts` | `generateAiDiagnosis()` | standard | 종합진단 |
| `suggestStrategies.ts` | `suggestStrategies()` | standard | 보완전략 |
| `generateInterviewQuestions.ts` | `generateInterviewQuestions()` | standard | 면접 예상질문 |
| `generateRoadmap.ts` | `generateAiRoadmap()` | standard | 학기별 로드맵 |
| `generateSetekDraft.ts` | `generateSetekDraftAction()` | standard | 세특 AI 초안 (fire-and-forget) |
| `generateChangcheDraft.ts` | `generateChangcheDraftAction()` | standard | 창체 AI 초안 (fire-and-forget) |
| `generateHaengteukDraft.ts` | `generateHaengteukDraftAction()` | standard | 행특 AI 초안 (fire-and-forget) |
| `guide-modules.ts` | analyze/generate 래퍼 | - | 파이프라인 오케스트레이터 진입점 |

### UI 4단계 탭 구조

```
1. RECORD (기록)     — SetekEditor, ChangcheEditor, HaengteukEditor, ReadingEditor
2. DIAGNOSIS (진단)  — CompetencyAnalysisSection, ContextGrid, QualityScoreBadge
3. DESIGN (설계)     — SetekGuidePanel, CoursePlanEditor, RoadmapEditor
4. STRATEGY (전략)   — StrategyEditor, InterviewQuestionPanel, MinScorePanel
```

### 새 AI 태스크 추가 체크리스트

1. `pipeline-types.ts` — task key + 의존 관계 + 타임아웃
2. `pipeline-task-runners.ts` — export async function 구현
3. `llm/actions/` — LLM 호출 함수 + 프롬프트
4. `pipeline-grade-phases.ts` 또는 `pipeline-synthesis-phases.ts` — Phase 배치
5. DB 테이블 + repository 메서드
6. UI 컴포넌트 + query options

## 파이프라인 변경 시 문서 동기화 (필수)

파이프라인 구조를 변경할 때 **반드시** 아래 문서도 함께 업데이트:

| 변경 대상 | 업데이트할 문서 | 업데이트 내용 |
|-----------|---------------|-------------|
| 태스크 추가/삭제/이름변경 | 이 파일 (CLAUDE.md) "Pipeline Architecture" 섹션 | 3-Tier 구조, 태스크 목록, LLM Actions 테이블 |
| Phase 순서 변경 | 이 파일 + `docs/student-record-blueprint.md` 다이어그램 1, 3 | Phase 흐름도, Gantt 차트 |
| Phase 간 데이터 전달 변경 | 이 파일 "Phase 간 데이터 흐름" + blueprint 다이어그램 2 | 핵심 헬퍼 함수 테이블, 데이터 전달 상세 |
| DB 테이블 추가/변경 | 이 파일 "DB 테이블" + blueprint 다이어그램 4 | 테이블 역할, ER 다이어그램 |
| LLM 액션 추가/모델 변경 | 이 파일 "LLM Actions" + blueprint 다이어그램 6 | 파일-함수-모델-용도 테이블 |
| UI 탭/컴포넌트 구조 변경 | blueprint 다이어그램 5 | 4단계 탭 구조 |

**문서 위치:**
- 규칙/코드 참조: `lib/domains/student-record/CLAUDE.md` (서브에이전트 자동 참조)
- 시각화 청사진: `docs/student-record-blueprint.md` (Mermaid 다이어그램 8개)

## Tests
```bash
pnpm test lib/domains/student-record
```

## Related Domains
- `admission`: 수능최저 시뮬레이터, 교과 적합성 데이터
- `guide`: guide-context.ts → 오케스트레이터 가이드 도구
- `plan`: Cold Start가 학생 프로필 참조
- `lib/agents/tools/record-tools.ts`: 런타임 에이전트가 이 도메인에 강하게 의존
