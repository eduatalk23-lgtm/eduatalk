# Record Analysis Domain Rules

## Scope
생기부 AI 분석 파이프라인, LLM 프롬프트/액션, 평가 모듈. student-record 도메인의 CRUD/서비스 코드와 분리된 AI 분석 전용 도메인.

## Architecture
```
record-analysis/
├── pipeline/              # 3-Tier 파이프라인 (Grade 12태스크×9Phase + Synthesis 14태스크×7Phase)
│   ├── pipeline-config.ts        # client-safe 설정
│   ├── pipeline-types.ts         # client-safe 타입
│   ├── pipeline-executor.ts      # Phase별 실행 엔진
│   ├── pipeline-grade-phases.ts  # P1-P9 Phase 정의
│   ├── pipeline-data-resolver.ts # 콘텐츠 해소 4-layer
│   ├── pipeline-unified-input.ts # 통합 입력 빌더
│   ├── pipeline-task-runners*.ts # 태스크별 실행 로직 (7파일)
│   ├── pipeline-slot-generator.ts # 슬롯 생성
│   ├── pipeline-helpers.ts       # 공통 헬퍼
│   └── synthesis/                # S1-S6 Synthesis Phase (7파일)
├── llm/                   # LLM 액션, 프롬프트, 유틸리티
│   ├── actions/           # 18개 서버 액션 (generate*, analyze*, suggest*, detect*)
│   ├── prompts/           # 13개 프롬프트 빌더 (narrativeContext 포함)
│   ├── validators/        # L4-D Hypothesis-Verify Loop (L1 deterministic + L2 coherence + L3 targeted repair: diagnosis & strategy 전부 완료)
│   ├── ai-client.ts       # AI SDK 래퍼
│   ├── retry.ts           # 지수 백오프 재시도 (1s→3s→10s, 최대 3회)
│   ├── extractJson.ts     # LLM 응답 JSON 파서
│   ├── types.ts           # LLM 입출력 타입
│   ├── error-handler.ts   # 에러 래퍼
│   └── edge-summary.ts    # Edge 요약 빌더
├── eval/                  # 평가 모듈 (5파일, 규칙 기반, LLM 호출 없음)
│   ├── executive-summary.ts       # B3: A1~B1 결과 통합 → 한 페이지 요약
│   ├── golden-dataset.ts          # 50샘플 골든셋 + 회귀 검증 기준
│   ├── highlight-verifier.ts      # A1: 하이라이트 정합성 검증
│   ├── timeseries-analyzer.ts     # A2: 학년별 역량 변화 분석
│   └── university-profile-matcher.ts  # A3: 대학 프로필 매칭
└── __tests__/             # 20개 테스트 파일
```

## Dependencies
```
record-analysis/pipeline ──→ student-record/{types,constants,repository,course-plan,leveling,evaluation-criteria}
record-analysis/llm      ──→ student-record/{types,constants,repository,evaluation-criteria,actions/report,actions/pipeline}
record-analysis/eval     ──→ subject/normalize, student-record/constants, lib/constants/career-classification (university-profile-matcher v2)

순환 의존 없음.
```

**`evaluation-criteria/` 의존 주의**: record-analysis/llm 의 프롬프트(`setekGuide`, `changcheGuide`, `haengteukGuide`, `diagnosisPrompt`, `draft-system-prompts`, `competencyHighlight`)와
draft 액션(`generateSetekDraft`, `generateHaengteukDraft`, `generateHaengteukGuide`)이 `student-record/evaluation-criteria/defaults`의 루브릭·포맷터를 직접 사용한다.
evaluation-criteria는 아직 student-record 쪽에 남아 있으므로 경계 침범처럼 보이지만, 방향성은 단방향이라 순환 없음.

## Enforced Rules

1. **콘텐츠 해소 우선순위 (4-layer)**: `imported_content > confirmed_content > content > ai_draft_content`. pipeline-data-resolver, pipeline-unified-input, phase-s6-interview 모두 동일.
2. **Phase 간 데이터 흐름**: 원본 LLM 응답은 DB에만 저장. Phase 간 전달은 가공된 요약만 (analysisContext).
3. **태스크 의존성 가드**: `GRADE_TASK_PREREQUISITES`로 선행 실패 시 자동 스킵.
4. **LLM 재시도**: 모든 LLM 호출에 `withRetry()` 적용.
5. **Client/Server 경계**: `pipeline-config.ts`, `pipeline-types.ts`만 client-safe. 나머지는 server-only.

## Pipeline Architecture (청사진)

### 콘텐츠 해소 우선순위 (4-layer)
```
imported_content(NEIS 최종) > confirmed_content(확정본) > content(가안) > ai_draft_content(AI 초안)
```
`pipeline/pipeline-data-resolver.ts`, `pipeline/pipeline-unified-input.ts`, `pipeline/synthesis/phase-s6-interview.ts` 모두 동일 우선순위 적용.
`student-record/grade-stage.ts`의 stage 판정 로직과 일치: final > confirmed > consultant > ai_draft > prospective.

### 3-Tier 파이프라인 구조

```
Grade Pipeline (학년별, 12태스크×9Phase)
  P0 (암시적): ctx.profileCard 1회 빌드 (Layer 0, 2/3학년만)
  P1: competency_setek        ← ctx.profileCard 주입 → ctx.analysisContext에 축적
  P2: competency_changche     ← ctx.profileCard 주입 → ctx.analysisContext에 축적
  P3: competency_haengteuk    ← ctx.profileCard 주입 → ctx.analysisContext에 축적 + 집계
  P3.5 (Phase 4 pre-task 그룹, 직렬 순차):
        · cross_subject_theme_extraction — 학년 전체 레코드 → 과목 교차 테마 (S3 소비)
        · competency_volunteer (α1-2, 2026-04-19)
          ↑ student_record_volunteer 학년 row → community_caring 역량 태깅 + recurringThemes.
            학년 묶음 1회 standard tier LLM 호출 (청크 미지원, description 짧음).
            저장: activity_tags(record_type='volunteer', tag_context='analysis') 전용.
            competency_scores/content_quality 는 건드리지 않음 (P3 집계와 UNIQUE 충돌 회피).
            ctx.results["competency_volunteer"] 에 recurringThemes/caringEvidence/leadershipEvidence 영속화.
            α1-3 buildStudentState 가 activity_tags + ctx.results 에서 VolunteerState 집계.
            빈 봉사 → LLM 호출 0, 이전 volunteer 태그 정리 후 completed.
            선행 없음(P1-P3 와 독립), 실패해도 가이드 계속 (graceful).
            α1-3 (2026-04-19): `buildStudentState` 가 activity_tags(volunteer) + volunteer 테이블
              + ctx.results["competency_volunteer"] 에서 `aux.volunteer` VolunteerState 집계.
              ctx.results 부재 시 caringEvidence 는 activity_tags.evidence_summary 폴백.
  P4: setek_guide + slot_generation  ← analysisContext 주입 (issues/feedback/약점)
  P5: changche_guide                 ← analysisContext 주입 (community 우선)
  P6: haengteuk_guide                ← analysisContext 주입 (community만)
  P7: draft_generation               ← 설계 모드 전용, 레벨링 주입(L2) + 방향 가이드 기반 AI 가안
  P8: draft_analysis                 ← 가안 역량 분석 (tag=draft_analysis, scores=ai_projected, edges=projected)
  P9: draft_refinement               ← **Phase 5 Sprint 1 (2026-04-19)**. IMPROVE 논문 component-at-a-time iteration.
        ↑ P8 에서 overall_score<70 판정된 레코드를 이전 draft + 5축 score + issues + feedback 을 프롬프트에 주입해 1회 재생성.
          재분석 score 가 원본보다 높으면 content_quality 승격, 낮으면 rollback (ai_draft_content + content_quality + activity_tags + competency_scores 4종 원복).
          max_retry=1 (content_quality.retry_count 영속). Feature flag `ENABLE_DRAFT_REFINEMENT` default off.
          분석 모드 학년은 skip (가안 없음). 청크 실행 (chunkSize=4).

Synthesis Pipeline (종합, 14태스크×7Phase — 트랙 D 2026-04-14 3종 승격 + Phase 4b Sprint 3 S7 신설)
  S1: storyline_generation
  S2: narrative_arc_extraction (chunked sub-route) → edge_computation + hyperedge_computation + guide_matching + haengteuk_linking
        ↑ 트랙 D: 기존 best-effort 3종(hyperedge/narrative/haengteuk_link)을 정식 task_key로 승격.
          narrative_arc는 레코드별 LLM 호출이 많아 단일 Phase 2 HTTP에 묶이면 Vercel 300s 초과 → 별도 chunked sub-route로 분리.
  S3: ai_diagnosis + course_recommendation   ← aggregateQualityPatterns 주입
  S4: bypass_analysis
  S5: activity_summary + ai_strategy         ← qualityPatterns + hyperedgeSummarySection 주입
  S6: interview_generation + roadmap_generation
  S7: tier_plan_refinement                   ← Synthesis → main_exploration 피드백 루프 (Phase 4b Sprint 3+4, 2026-04-19)
        ↑ S3 진단 + S5 전략 + S6 로드맵 + qualityPatterns 을 근거로 active main_exploration.tier_plan 을 재평가.
          Sprint 3: extractTierPlanSuggestion 으로 제안 plan 생성 → jaccard 비교로 수렴 판정.
          Sprint 4(2026-04-19): jaccard 의 surface rephrasing 오판(gpt-5.4 같은 프로덕션 모델에서 0.17 → 무한 cascade)
            → judgeTierPlanConvergence(L4-D Flash judge) 로 교체. verdict 3-class:
              · semantically_equivalent / minor_refinement → converged (no-op)
              · substantial_change → refined → max chain depth 가드 통과 시 신규 row INSERT
            jaccard 는 task_results 에 telemetry 로만 보존(judge 정확도 검증 도구).
          max_chain_depth=2 로 자동 cascade 차단 (v3 생성 직전 skipped_max_version_chain).
          컨설턴트 수정본(edited_by_consultant_at != null) / 비-부트스트랩 origin 은 자동 skip.
          재부트스트랩 트리거는 Phase 4a staleness 배너가 사용자 클릭으로 주도 (서버-서버 체이닝 금지).
```

### Tier Plan 흐름 (4축×3층 메인 탐구 seed → 프롬프트 주입)

**원천**: `student_main_explorations.tier_plan` (JSONB) — 활성 메인 탐구의 3단 계획.
```json
{
  "foundational": { "theme": "...", "key_questions": [...], "suggested_activities": [...] },
  "development":  { "theme": "...", "key_questions": [...], "suggested_activities": [...] },
  "advanced":     { "theme": "...", "key_questions": [...], "suggested_activities": [...] }
}
```

**렌더러**: `llm/main-exploration-section.ts:renderMainExplorationSection()` — JSONB → 마크다운 섹션. tier별 주제·질문·활동을 LLM 프롬프트에 그대로 노출.

**주입 경로**:

| 단계 | 위치 | 주입 방식 | 목적 |
|------|------|-----------|------|
| **P4 setek_guide** | `prompts/setekGuide.ts` (gridContext) | `renderCellGuideGridContextSection(input.gridContext)` — Phase β G7 | 세특 방향 가이드가 학생 격자 cap + 메인 탐구 tier 정합 |
| **B1 blueprint_generation** | `llm/actions/generateBlueprint.ts` + `prompts/blueprintPhase.ts` | tier_plan 직접 참조 → convergences/milestones 생성 시 tier 정렬 | 설계 청사진이 메인 탐구 3단 계획과 일치 |
| **S3 ai_diagnosis** | `prompts/diagnosisPrompt.ts` | `mainExplorationSection` (renderer 결과) | tier 정합성 평가 (현 활동이 어느 tier에 위치하는지) |
| **S5 ai_strategy** | `prompts/strategyRecommend.ts` | `mainExplorationSection` | tier_plan 빈 셀(추천 활동 부족 학기) 우선 채움 |
| **S6 interview / roadmap** | `prompts/generateInterviewQuestions.ts`, `prompts/roadmapGeneration.ts` | `mainExplorationSection` | record의 tier 컨텍스트 / 학기별 missions와 tier 정합 |
| **S7 tier_plan_refinement** | `llm/prompts/tierPlanRefinement.ts` + `llm/actions/extractTierPlanSuggestion.ts` + `llm/prompts/tierPlanConvergenceJudge.ts` + `llm/actions/judgeTierPlanConvergence.ts` | 현 tier_plan + Synthesis 산출물(진단 약점·전략·로드맵·qualityPatterns) | Synthesis 결과를 근거로 tier_plan 을 **역방향 개정**. Sprint 4: `judgeTierPlanConvergence`(Flash, L4-D 패턴) 로 컨설팅 가치 동등성 판정. verdict=substantial_change + chainDepth < 2 → origin='auto_bootstrap_v2' 신규 row INSERT. jaccard 는 telemetry 전용 |

**P5/P6/P7/P8은 직접 참조 없음**:
- P5(changche_guide)/P6(haengteuk_guide)는 P4 산출물(세특 가이드)을 참조 → tier가 간접 반영.
- **P7(draft_generation)/P8(draft_analysis)는 P4~P6 가이드 결과를 입력으로 사용** → tier_plan이 가이드 안에 이미 녹아있는 형태로 흐름. P7/P8 프롬프트가 tier_plan을 직접 읽지 않음에 주의.

**갱신 시 주의**:
- main_exploration이 갱신되면 tier_plan 변경 → `mainExplorationSection`이 자동 반영되지만, **이미 생성된 P4 가이드/B1 blueprint는 stale**. 재실행 cascade 필요.
- staleness 감지: `main_exploration.updated_at > blueprint.created_at` 체크 — 별도 staleness checker 참조.

### Layer 2 Hypergraph (Phase 1, 2026-04-14)

**목적**: Layer 1 binary edge로 표현 불가능한 N-ary 수렴 서사축을 별도 엔티티로 영속화.
`{세특 A + 독서 B + 동아리 C}가 하나의 탐구 주제로 수렴`을 **1개 hyperedge**로 저장.

**컴퓨테이션 위치**: `pipeline/synthesis/phase-s2-hyperedges.ts` — `runEdgeComputation` 성공 직후 best-effort 후속 실행 (`executeSynthesisPhase2` 내).

**알고리즘 B' (pair-seed 클러스터링)**:
1. eligible 엣지 필터 — `edge_type ∈ {COMPETENCY_SHARED, THEME_CONVERGENCE, READING_ENRICHES}` + `confidence ≥ 0.7` + `target_record_id` 존재 + `shared_competencies.length ≥ 2`
2. 각 엣지의 `shared_competencies`에서 모든 2-조합(pair) 추출 — pair = 테마 시드
3. pair별 서브그래프: 해당 pair를 포함하는 엣지만 뽑아 union-find
4. size ∈ [3, 5] 컴포넌트만 hyperedge 후보
5. member set 기준 dedup, `shared_competencies`는 합집합으로 병합
6. `confidence = min(member edge confidence)`, `theme_slug = djb2(shared + members)`

**왜 단순 union-find가 아닌가**: 범용 역량(`academic_inquiry` 등)이 대부분 엣지에 등장하여 단일 거대 컴포넌트 형성 → size cap에서 전량 탈락. pair-seed 방식은 "범용 pair는 자연스럽게 size>5로 탈락, 선명한 pair만 통과"라는 자기 조절을 가짐.

**S5 주입**: `findHyperedges(studentId, tenantId, { contexts: ['analysis'] })` → `buildHyperedgeSummarySection()` → `SuggestStrategiesInput.hyperedgeSummarySection`로 전달.

### Phase 간 데이터 흐름 (핵심)

```
Layer 0 (P1-P3 진입 시 1회)
  └─ ctx.profileCard: 이전 학년 competency_scores + content_quality 누적 프로필
     (세특/창체/행특 모든 셀 프롬프트 주입, 1학년 또는 데이터 없음 시 omit)
     3-state: undefined=미빌드, ""=시도했으나 빈 카드, "..."=빌드 완료

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

### 태스크 의존성 가드 (`pipeline/pipeline-grade-phases.ts`)

`GRADE_TASK_PREREQUISITES`(`pipeline/pipeline-types.ts`): 선행 태스크가 failed이면 후속 태스크를 자동 스킵.

```
setek_guide       ← [competency_setek]
slot_generation   ← [competency_setek, competency_changche, competency_haengteuk]
changche_guide    ← [competency_setek, competency_changche, setek_guide]
haengteuk_guide   ← [전 competency + setek_guide + changche_guide]
draft_generation  ← [setek_guide, changche_guide, haengteuk_guide]
draft_analysis    ← [haengteuk_guide, draft_generation]
draft_refinement  ← [haengteuk_guide, draft_generation, draft_analysis]
```

스킵된 태스크: `status="failed"`, `error="선행 태스크 실패로 건너뜀: ..."`. 재실행 cascade로 복구.

### 재실행 클린업 (`student-record/actions/pipeline-orchestrator-rerun.ts`)

`rerunGradePipelineTasks()` 시 competency 태스크 재실행이면:
1. `analysis_cache` 삭제 (학생 전체, LLM 강제 재호출)
2. `deleteAnalysisResultsByGrade()`: 해당 학년의 scores(ai/ai_projected) + tags(analysis/draft_analysis) + quality(ai/ai_projected) 삭제
3. Synthesis pipeline → 전체 pending으로 리셋

> **Note**: 오케스트레이터 액션 자체는 student-record 도메인에 있지만(트랜잭션 진입점이라서), 호출하는 phase 실행 엔진은 record-analysis/pipeline에 있다.

### 동시성 보호 (DB 레벨)

`idx_unique_running_grade_pipeline`: 학생+학년 단위 running/pending 파이프라인 1개 제한.
`idx_unique_running_synth_pipeline`: 학생 단위 synthesis 파이프라인 1개 제한.
위반 시 23505 에러 → 사용자 친화적 메시지 반환.

### 좀비 파이프라인 판정 (heartbeat 기반, 트랙 D 2026-04-14)

장시간 실행되는 synthesis 파이프라인(총 7~13분)의 좀비 판정은 **`updated_at` 기반 heartbeat** 모델을 사용한다.

```sql
-- 마이그레이션: 20260414140000_analysis_pipelines_updated_at_heartbeat.sql
ALTER TABLE student_record_analysis_pipelines ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER trg_analysis_pipelines_updated_at BEFORE UPDATE ...
  SET NEW.updated_at = NOW();
```

**정책**:
- `pipeline-orchestrator-status.ts` (폴링) + `pipeline.ts:checkPipelineRateLimit` 양쪽에서 `status='running' AND updated_at < now() - 5분` 조건으로 cancelled 마킹.
- `started_at` 은 **기준으로 쓰면 안 됨** — 정상 실행 중인 장기 파이프라인도 시간만 지나면 오판해 cancel됨 (김세린 사례: Phase 3 중 `started_at + 5:01` 경과 시 자동 cancel).
- 각 `runTaskWithState`/`updatePipelineState` UPDATE는 trigger에 의해 자동 `updated_at=NOW()` 갱신 → heartbeat 역할.

**설계 원칙**: 서버리스 환경에서 장기 파이프라인의 "살아있음" 판정은 시작 시각(started_at)이 아니라 **마지막 활동 시각(updated_at)**으로 해야 한다. 각 phase/task가 DB write를 통해 자연스럽게 heartbeat을 찍으므로 별도 컬럼 불필요.

### LLM 호출 재시도 (`llm/retry.ts`)

모든 파이프라인 LLM 호출에 `withRetry()` 적용: 1s → 3s → 10s 지수 백오프, 최대 3회.

### 핵심 헬퍼 함수 (`pipeline/pipeline-task-runners.ts` 외)

| 함수 | 역할 | 호출 위치 |
|------|------|----------|
| `collectAnalysisContext()` | P1-3 결과에서 issues/약점 추출 → ctx 축적 | 세특/창체/행특 역량 분석 완료 시 (5곳) |
| `toGuideAnalysisContext()` | ctx → GuideAnalysisContext 변환 | 파이프라인 경로 가이드 호출 시 |
| `buildGuideAnalysisContextFromReport()` | reportData → GuideAnalysisContext 변환 | 비파이프라인 경로 (수동 재생성) |
| `aggregateQualityPatterns()` | 전 학년 DB 조회 → 반복 패턴 집계 | Synthesis 진단/전략 |
| `buildCrossGradeDirections()` | 이전 분석 학년 보완방향 텍스트 빌드 | Prospective 가이드 생성 시 |
| `buildStudentProfileCard()` / `renderStudentProfileCard()` | 이전 학년 역량/품질 집계 → Layer 0 프로필 카드 텍스트 | P1-P3 역량 분석 진입 시 (1회, `ctx.profileCard` 캐시) |
| `computeProfileCardStructuralHash()` | StudentProfileCard 구조 필드(LLM 독립) → djb2 hash | H2 영속화 staleness 판정 |
| `enrichCardWithInterestConsistency()` | H2 서사 LLM 호출(standard tier) → `interestConsistency` 부착 | profileCard 빌드 직후, 학생당 1회 (DB cache miss 시에만) |
| `findProfileCard() / upsertProfileCard()` (`student-record/repository/profile-card-repository.ts`) | H2 프로필 카드 DB CRUD | 파이프라인 P1-P3 진입 시 DB cache lookup → hit 시 LLM 스킵, miss/stale 시 upsert |
| `buildNarrativeContext()` (`pipeline/narrative-context.ts`) | reportData → `prioritizedWeaknesses` + `recordPriorityOrder` 합성 (L4-E) | `fetchReportData` projectedData 빌드 시 |
| `validateDiagnosisOutput()` (`llm/validators/diagnosis-validator.ts`) | ai_diagnosis L1 deterministic 검증 (11종 규칙) | `generateAiDiagnosis` finalData 빌드 후 |
| `validateStrategyOutput()` (`llm/validators/strategy-validator.ts`) | ai_strategy L1 deterministic 검증 (12종 규칙) | `suggestStrategies` parseResponse 후 |
| `checkDiagnosisCoherence()` (`llm/validators/diagnosis-coherence-checker.ts`) | ai_diagnosis L2 coherence 검증 (Flash LLM-judge, 6종 규칙) | `generateAiDiagnosis` L1 validator 직후 (non-fatal) |
| `checkStrategyCoherence()` (`llm/validators/strategy-coherence-checker.ts`) | ai_strategy L2 coherence 검증 (Flash LLM-judge, 5종 규칙) | `suggestStrategies` L1 validator 직후 (non-fatal) |
| `repairDiagnosis()` (`llm/validators/diagnosis-repair.ts`) | ai_diagnosis L3 targeted repair (Flash, MAX=1, 필드 단위) | `generateAiDiagnosis` L2 직후 error 있을 때만 (non-fatal) |
| `repairStrategies()` (`llm/validators/strategy-repair.ts`) | ai_strategy L3 targeted repair (Flash, MAX=1, suggestions[i] 단위) | `suggestStrategies` L2 직후 error 있을 때만 (non-fatal) |

### DB 테이블 (핵심)

| 테이블 | 역할 | 파이프라인 연관 |
|--------|------|---------------|
| `student_record_seteks` | 세특 원본/NEIS | 입력 |
| `student_record_changche` | 창체 원본/NEIS | 입력 |
| `student_record_haengteuk` | 행특 원본/NEIS | 입력 |
| `student_record_analysis_cache` | LLM 응답 전체 JSON + content_hash | 증분 캐시 |
| `student_record_activity_tags` | 역량 태그 (reasoning+highlight). record_type ∈ {setek, personal_setek, changche, haengteuk, **volunteer**(α1-2)} | P1-3 + α1-2 출력, UI 표시 |
| `student_record_volunteer` | 봉사활동 원본/NEIS | α1-2 입력 |
| `student_record_competency_scores` | 등급 + rubric_scores JSONB | P1-3 출력, 가이드/진단 참조 |
| `student_record_content_quality` | 5축 점수 + issues + feedback + **retry_count** (P9 재생성 가드) | P1-3 + P8 출력, 가이드 주입, UI 표시 |
| `student_record_diagnosis` | 종합진단 (강점/약점) | S3 출력 |
| `student_record_setek_guides` | 세특 방향 가이드 | P4 출력 |
| `student_record_changche_guides` | 창체 방향 가이드 | P5 출력 |
| `student_record_haengteuk_guides` | 행특 방향 가이드 | P6 출력 |
| `student_record_edges` | 레코드 간 연결 그래프 (`edge_context`: analysis/projected/synthesis_inferred) | S2+P8 출력 + S3 동적 추론 |
| `student_record_hyperedges` | N-ary 수렴 테마(Layer 2, `hyperedge_type='theme_convergence'`) | S2 hyperedge_computation 출력, S5 주입 |
| `student_record_narrative_arc` | 레코드별 8단계 서사 태깅(Layer 3, `source='ai'\|'manual'`) | S2 narrative_arc_extraction 출력. Phase 2 |
| `student_record_profile_cards` | Layer 0 학생 프로필 카드 영속화(H2, `source='ai'\|'manual'`, UNIQUE by `(tenant, student, target_grade, source)`) | P1-P3 진입 시 cache lookup → 재실행 LLM 스킵 |
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

**α1-2 봉사 예외 (2026-04-19)**: `competency_volunteer` 는 3중 저장이 아닌 **①activity_tags 전용**.
  - competency_scores 미기록 — P3 집계의 community_caring 행과 UNIQUE (tenant,student,year,scope,item,source) 충돌 회피.
  - content_quality 미기록 — 봉사 description 수십자 수준이라 5축 평가 부적합.
  - analysis_cache 미사용 — record_type='volunteer' 의 cache 키 설계 시 집계 단위 모호 → 재실행마다 LLM 호출 허용 (standard tier 저비용).
  - recurringThemes/caringEvidence 는 `ctx.results["competency_volunteer"]` 에 보관 (파이프라인 수명 내). α1-3 buildStudentState 가 DB activity_tags + ctx.results 에서 VolunteerState 집계.
  - deleteAnalysisResultsByGrade 는 volunteer row id 를 수집해 activity_tags 동시 삭제.

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
| edges | `edge_context` | `analysis` / `synthesis_inferred`(S3 동적 추론, L3-C) | `projected` |
| guides | `guide_mode` | `retrospective` | `prospective` |

### LLM Actions (`llm/actions/`)

| 파일 | 주요 함수 | 모델 | 용도 |
|------|----------|------|------|
| `analyzeWithHighlight.ts` | `analyzeSetekWithHighlight()` | advanced (Gemini 2.5 Pro) | 역량 태깅 + 품질 점수 |
| `generateSetekGuide.ts` | `generateSetekGuide()`, `generateProspectiveSetekGuide()` | standard | 세특 방향 가이드 |
| `generateChangcheGuide.ts` | `generateChangcheGuide()`, `generateProspectiveChangcheGuide()` | standard | 창체 방향 가이드 |
| `generateHaengteukGuide.ts` | `generateHaengteukGuide()`, `generateProspectiveHaengteukGuide()` | standard | 행특 방향 가이드 |
| `generateDiagnosis.ts` | `generateAiDiagnosis()` | standard | 종합진단 + **inferredEdges(L3-C 동적 링크 예측)** |
| `suggestStrategies.ts` | `suggestStrategies()` | standard | 보완전략 |
| `generateInterviewQuestions.ts` | `generateInterviewQuestions()` | standard | 면접 예상질문 |
| `generateRoadmap.ts` | `generateAiRoadmap()` | standard | 학기별 로드맵 |
| `generateSetekDraft.ts` | `generateSetekDraftAction()` | standard | 세특 AI 초안 (fire-and-forget) |
| `extractNarrativeArc.ts` | `extractNarrativeArc()` | fast (Pro fallback) | Layer 3 8단계 서사 태깅 (Phase 2) |
| `generateChangcheDraft.ts` | `generateChangcheDraftAction()` | standard | 창체 AI 초안 (fire-and-forget) |
| `generateHaengteukDraft.ts` | `generateHaengteukDraftAction()` | standard | 행특 AI 초안 (fire-and-forget) |
| `extractTierPlanSuggestion.ts` | `extractTierPlanSuggestion()` | fast (Pro fallback) | Phase 4b Sprint 2 — S7 tier_plan 역방향 개정 제안 |
| `judgeTierPlanConvergence.ts` | `judgeTierPlanConvergence()` | fast | Phase 4b Sprint 4 — S7 LLM-judge: 두 plan 컨설팅 가치 동등성 verdict 3-class |
| `prompts/draft-refinement-prompts.ts` | `buildSetekRefinementUserPrompt()` 외 2종 | — | Phase 5 Sprint 1 — P9 재생성 user prompt 빌더 (P7 SETEK/CHANGCHE/HAENGTEUK system prompt 재사용 + 이전 draft/5축 score/issues/feedback 주입). standard tier generateTextWithRateLimit 호출 |
| `analyzeVolunteerBatch.ts` | `analyzeVolunteerBatch()` | standard | **α1-2 (2026-04-19)** — 봉사 학년 묶음 1회 분석. community_caring/leadership 태깅 + recurringThemes/caringEvidence 추출. totalHours 는 LLM 값 무시하고 입력에서 재계산. |
| `guide-modules.ts` | analyze/generate 래퍼 | - | 파이프라인 오케스트레이터 진입점 |

### UI 4단계 탭 구조 (소비자 측 — app/(admin)/admin/students/[id])

```
1. RECORD (기록)     — SetekEditor, ChangcheEditor, HaengteukEditor, ReadingEditor
2. DIAGNOSIS (진단)  — CompetencyAnalysisSection, ContextGrid, QualityScoreBadge
3. DESIGN (설계)     — SetekGuidePanel, CoursePlanEditor, RoadmapEditor
4. STRATEGY (전략)   — StrategyEditor, InterviewQuestionPanel, MinScorePanel
```

### 새 AI 태스크 추가 체크리스트

1. `pipeline/pipeline-types.ts` — task key + 의존 관계 + 타임아웃
2. `pipeline/pipeline-task-runners*.ts` — export async function 구현
3. `llm/actions/` — LLM 호출 함수 + 프롬프트
4. `pipeline/pipeline-grade-phases.ts` 또는 `pipeline/pipeline-synthesis-phases.ts` — Phase 배치
5. DB 테이블 + `student-record/repository/` 메서드
6. UI 컴포넌트 + query options

## 파이프라인 변경 시 문서 동기화 (필수)

파이프라인 구조를 변경할 때 **반드시** 아래 문서도 함께 업데이트:

| 변경 대상 | 업데이트할 문서 | 업데이트 내용 |
|-----------|---------------|-------------|
| 태스크 추가/삭제/이름변경 | 이 파일 (record-analysis/CLAUDE.md) "Pipeline Architecture" 섹션 | 3-Tier 구조, 태스크 목록, LLM Actions 테이블 |
| Phase 순서 변경 | 이 파일 + `docs/student-record-blueprint.md` 다이어그램 1, 3 | Phase 흐름도, Gantt 차트 |
| Phase 간 데이터 전달 변경 | 이 파일 "Phase 간 데이터 흐름" + blueprint 다이어그램 2 | 핵심 헬퍼 함수 테이블, 데이터 전달 상세 |
| DB 테이블 추가/변경 | 이 파일 "DB 테이블" + blueprint 다이어그램 4 | 테이블 역할, ER 다이어그램 |
| LLM 액션 추가/모델 변경 | 이 파일 "LLM Actions" + blueprint 다이어그램 6 | 파일-함수-모델-용도 테이블 |
| UI 탭/컴포넌트 구조 변경 | blueprint 다이어그램 5 | 4단계 탭 구조 |

**문서 위치:**
- 규칙/코드 참조: `lib/domains/record-analysis/CLAUDE.md` (이 파일, 서브에이전트 자동 참조)
- CRUD/도메인 모델: `lib/domains/student-record/CLAUDE.md`
- 시각화 청사진: `docs/student-record-blueprint.md` (Mermaid 다이어그램 8개)

## Tests
```bash
pnpm test lib/domains/record-analysis
```
