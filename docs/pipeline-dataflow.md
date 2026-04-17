# Pipeline Dataflow (자동 생성)

> 이 문서는 `scripts/generate-pipeline-dataflow.ts` 가 `PIPELINE_TASK_MANIFEST` 로부터 자동 생성합니다.
> 직접 수정하지 마세요 — 내용을 바꾸려면 매니페스트를 수정한 뒤 재생성하세요.
> Generated: 2026-04-17

## 개요

- 총 태스크: **28** 개
  - Grade: 10, Synthesis: 14, Past: 3, Blueprint: 1
- Terminal 선언: **8** 건 (그 중 임시 `pendingCrossRunFeedback`: 7 건)

## 1. 태스크 → 태스크 의존 그래프

- `readsResults`: ctx 산출물(동일 실행 내) 의존
- `table-mediated`: DB 테이블을 통한 간접 의존 (이 태스크 writes → 다른 태스크 reads)

| 태스크 | 파이프라인 | readsResults (upstream) | 테이블 소비자 (downstream) |
|---|---|---|---|
| `competency_setek` | Grade | — | `ai_diagnosis`, `ai_strategy`, `changche_guide`, `competency_changche`, `competency_haengteuk`, `cross_subject_theme_extraction`, `draft_analysis`, `edge_computation`, `guide_matching`, `haengteuk_guide`, `interview_generation`, `past_diagnosis`, `setek_guide` |
| `competency_changche` | Grade | `competency_setek` | `ai_diagnosis`, `ai_strategy`, `changche_guide`, `competency_haengteuk`, `competency_setek`, `cross_subject_theme_extraction`, `draft_analysis`, `haengteuk_guide`, `interview_generation`, `past_diagnosis`, `setek_guide` |
| `competency_haengteuk` | Grade | `competency_setek`, `competency_changche` | `ai_diagnosis`, `ai_strategy`, `changche_guide`, `competency_setek`, `cross_subject_theme_extraction`, `draft_analysis`, `edge_computation`, `gap_tracking`, `haengteuk_guide`, `interview_generation`, `past_diagnosis`, `setek_guide` |
| `cross_subject_theme_extraction` | Grade | `competency_setek`, `competency_changche`, `competency_haengteuk` | `ai_diagnosis`, `changche_guide`, `haengteuk_guide`, `setek_guide` |
| `setek_guide` | Grade | `competency_setek`, `competency_haengteuk`, `cross_subject_theme_extraction` | `activity_summary`, `changche_guide`, `draft_generation`, `guide_matching`, `roadmap_generation` |
| `slot_generation` | Grade | — | `ai_strategy`, `competency_changche`, `competency_haengteuk`, `competency_setek`, `cross_subject_theme_extraction`, `draft_analysis`, `draft_generation`, `edge_computation`, `interview_generation`, `narrative_arc_extraction`, `past_storyline_generation`, `roadmap_generation`, `setek_guide`, `storyline_generation` |
| `changche_guide` | Grade | `competency_changche`, `setek_guide`, `cross_subject_theme_extraction` | `activity_summary`, `draft_generation`, `guide_matching`, `haengteuk_guide` |
| `haengteuk_guide` | Grade | `competency_haengteuk`, `changche_guide`, `cross_subject_theme_extraction` | `draft_generation`, `guide_matching`, `haengteuk_linking` |
| `draft_generation` | Grade | `setek_guide`, `changche_guide`, `haengteuk_guide`, `blueprint_generation` | `ai_strategy`, `competency_changche`, `competency_haengteuk`, `competency_setek`, `cross_subject_theme_extraction`, `draft_analysis`, `edge_computation`, `interview_generation`, `narrative_arc_extraction`, `past_storyline_generation`, `roadmap_generation`, `setek_guide`, `storyline_generation` |
| `draft_analysis` | Grade | `draft_generation` | `ai_diagnosis`, `ai_strategy`, `changche_guide`, `competency_haengteuk`, `competency_setek`, `edge_computation`, `gap_tracking`, `haengteuk_guide`, `hyperedge_computation`, `interview_generation`, `past_diagnosis`, `setek_guide` |
| `blueprint_generation` | Blueprint | — | `ai_strategy`, `draft_generation`, `edge_computation`, `gap_tracking`, `guide_matching` |
| `past_storyline_generation` | Past | — | `ai_diagnosis`, `blueprint_generation`, `changche_guide`, `edge_computation`, `guide_matching`, `haengteuk_guide`, `past_diagnosis`, `roadmap_generation`, `setek_guide`, `storyline_generation` |
| `past_diagnosis` | Past | `past_storyline_generation` | `activity_summary`, `ai_diagnosis`, `ai_strategy`, `bypass_analysis`, `changche_guide`, `haengteuk_guide`, `past_strategy`, `roadmap_generation`, `setek_guide` |
| `past_strategy` | Past | `past_diagnosis` | `ai_strategy` |
| `storyline_generation` | Synthesis | — | `ai_diagnosis`, `blueprint_generation`, `changche_guide`, `edge_computation`, `guide_matching`, `haengteuk_guide`, `narrative_arc_extraction`, `past_diagnosis`, `past_storyline_generation`, `roadmap_generation`, `setek_guide` |
| `edge_computation` | Synthesis | `storyline_generation` | `activity_summary`, `ai_diagnosis`, `ai_strategy`, `gap_tracking`, `guide_matching`, `hyperedge_computation`, `narrative_arc_extraction` |
| `hyperedge_computation` | Synthesis | `edge_computation` | `ai_strategy`, `edge_computation`, `gap_tracking`, `guide_matching` |
| `narrative_arc_extraction` | Synthesis | `storyline_generation` | `edge_computation`, `guide_matching` |
| `guide_matching` | Synthesis | `storyline_generation`, `edge_computation`, `hyperedge_computation`, `narrative_arc_extraction`, `blueprint_generation` | `activity_summary`, `edge_computation`, `haengteuk_linking`, `setek_guide` |
| `haengteuk_linking` | Synthesis | `guide_matching`, `haengteuk_guide` | _(terminal: ui_only)_ |
| `ai_diagnosis` | Synthesis | `edge_computation`, `storyline_generation`, `cross_subject_theme_extraction` | `activity_summary`, `ai_strategy`, `bypass_analysis`, `changche_guide`, `course_recommendation`, `gap_tracking`, `haengteuk_guide`, `hyperedge_computation`, `interview_generation`, `past_strategy`, `roadmap_generation`, `setek_guide` |
| `course_recommendation` | Synthesis | `ai_diagnosis` | _(terminal: ui_only)_ |
| `gap_tracking` | Synthesis | `ai_diagnosis`, `blueprint_generation` | `ai_strategy`, `edge_computation`, `guide_matching` |
| `bypass_analysis` | Synthesis | `ai_diagnosis` | _(terminal: external_tool)_ |
| `activity_summary` | Synthesis | `edge_computation`, `guide_matching` | _(terminal: ui_only)_ |
| `ai_strategy` | Synthesis | `ai_diagnosis`, `hyperedge_computation`, `gap_tracking` | `interview_generation` |
| `interview_generation` | Synthesis | `ai_diagnosis`, `ai_strategy` | _(terminal: ui_only)_ |
| `roadmap_generation` | Synthesis | `ai_diagnosis` | _(terminal: ui_only)_ |

## 2. 테이블 → 작성자/소비자 매트릭스

| 테이블 | 작성 태스크 (writes) | 읽기 태스크 (reads) |
|---|---|---|
| `admission_exemplars` | _(external)_ | `blueprint_generation`, `roadmap_generation` |
| `course_plans` | _(external)_ | `activity_summary` |
| `exploration_guide_assignments` | `guide_matching` | `activity_summary`, `edge_computation`, `guide_matching`, `haengteuk_linking`, `setek_guide` |
| `exploration_guide_career_mappings` | _(external)_ | `edge_computation`, `guide_matching` |
| `exploration_guide_sequels` | _(external)_ | `edge_computation`, `guide_matching` |
| `exploration_guide_subject_mappings` | `guide_matching` | `edge_computation` |
| `exploration_guides` | `guide_matching` | `edge_computation`, `guide_matching`, `setek_guide` |
| `school_offered_subjects` | _(external)_ | `edge_computation` |
| `school_profiles` | _(external)_ | `edge_computation` |
| `student_course_plans` | _(external)_ | `blueprint_generation`, `edge_computation`, `guide_matching`, `roadmap_generation`, `slot_generation`, `storyline_generation` |
| `student_internal_scores` | _(external)_ | `ai_diagnosis`, `course_recommendation`, `edge_computation` |
| `student_main_explorations` | _(external)_ | `blueprint_generation`, `edge_computation`, `guide_matching` |
| `student_record_activity_summaries` | `activity_summary` | `activity_summary` |
| `student_record_activity_tags` | `competency_changche`, `competency_haengteuk`, `competency_setek`, `draft_analysis` | `competency_haengteuk`, `competency_setek` |
| `student_record_applications` | _(external)_ | `interview_generation` |
| `student_record_changche` | `draft_generation`, `slot_generation` | `competency_changche`, `cross_subject_theme_extraction`, `draft_analysis`, `draft_generation`, `edge_computation`, `interview_generation`, `narrative_arc_extraction`, `past_storyline_generation`, `setek_guide`, `storyline_generation` |
| `student_record_changche_guides` | `changche_guide` | `activity_summary`, `draft_generation`, `guide_matching`, `haengteuk_guide` |
| `student_record_competency_scores` | `competency_haengteuk`, `draft_analysis` | `ai_diagnosis`, `ai_strategy`, `changche_guide`, `competency_haengteuk`, `competency_setek`, `edge_computation`, `gap_tracking`, `haengteuk_guide`, `past_diagnosis`, `setek_guide` |
| `student_record_content_quality` | `competency_changche`, `competency_haengteuk`, `competency_setek`, `draft_analysis` | `ai_diagnosis`, `ai_strategy`, `changche_guide`, `competency_setek`, `draft_analysis`, `haengteuk_guide`, `interview_generation`, `past_diagnosis`, `setek_guide` |
| `student_record_diagnosis` | `ai_diagnosis`, `past_diagnosis` | `activity_summary`, `ai_diagnosis`, `ai_strategy`, `bypass_analysis`, `changche_guide`, `haengteuk_guide`, `past_strategy`, `roadmap_generation`, `setek_guide` |
| `student_record_edges` | `ai_diagnosis`, `draft_analysis`, `edge_computation` | `ai_diagnosis`, `hyperedge_computation` |
| `student_record_haengteuk` | `draft_generation`, `slot_generation` | `competency_haengteuk`, `draft_analysis`, `draft_generation`, `edge_computation`, `narrative_arc_extraction`, `past_storyline_generation`, `setek_guide` |
| `student_record_haengteuk_guide_links` | `haengteuk_linking` | `haengteuk_linking` |
| `student_record_haengteuk_guides` | `haengteuk_guide` | `draft_generation`, `guide_matching`, `haengteuk_linking` |
| `student_record_hyperedges` | `blueprint_generation`, `edge_computation`, `gap_tracking`, `hyperedge_computation` | `ai_strategy`, `edge_computation`, `gap_tracking`, `guide_matching` |
| `student_record_interview_questions` | `interview_generation` | `interview_generation` |
| `student_record_narrative_arc` | `edge_computation`, `narrative_arc_extraction` | `edge_computation`, `guide_matching`, `narrative_arc_extraction` |
| `student_record_personal_seteks` | _(external)_ | `narrative_arc_extraction` |
| `student_record_profile_cards` | `competency_setek` | `competency_changche`, `competency_haengteuk`, `competency_setek`, `edge_computation`, `guide_matching` |
| `student_record_roadmap_items` | `roadmap_generation` | `roadmap_generation` |
| `student_record_setek_guides` | `setek_guide` | `activity_summary`, `changche_guide`, `draft_generation`, `guide_matching`, `roadmap_generation` |
| `student_record_seteks` | `draft_generation`, `slot_generation` | `ai_strategy`, `competency_setek`, `cross_subject_theme_extraction`, `draft_analysis`, `draft_generation`, `edge_computation`, `interview_generation`, `narrative_arc_extraction`, `past_storyline_generation`, `roadmap_generation`, `setek_guide`, `storyline_generation` |
| `student_record_storyline_links` | `past_storyline_generation`, `storyline_generation` | `storyline_generation` |
| `student_record_storylines` | `past_storyline_generation`, `storyline_generation` | `ai_diagnosis`, `blueprint_generation`, `changche_guide`, `edge_computation`, `guide_matching`, `haengteuk_guide`, `past_diagnosis`, `past_storyline_generation`, `roadmap_generation`, `setek_guide`, `storyline_generation` |
| `student_record_strategies` | `ai_strategy`, `past_strategy` | `ai_strategy` |
| `student_record_topic_trajectories` | `edge_computation` | `edge_computation`, `guide_matching` |
| `student_snapshots` | _(external)_ | `blueprint_generation`, `past_diagnosis`, `roadmap_generation` |
| `students` | _(external)_ | `ai_diagnosis`, `blueprint_generation`, `course_recommendation`, `roadmap_generation` |
| `subjects` | _(external)_ | `activity_summary`, `ai_strategy`, `draft_analysis`, `draft_generation`, `edge_computation`, `guide_matching`, `setek_guide` |
| `university_evaluation_criteria` | _(external)_ | `interview_generation` |

## 3. Terminal 선언

| 태스크 | 이유 | 임시? | 소비자 |
|---|---|---|---|
| `activity_summary` | `ui_only` | ⏳ (PR 5 대기) | · 활동 요약서 탭 (admin)<br>· PDF export 파이프라인 |
| `bypass_analysis` | `external_tool` | — | · lib/domains/bypass-major/pipeline.ts (runBypassPipeline)<br>· lib/domains/admission/placement/auto-placement.ts (autoRunPlacement) |
| `course_recommendation` | `ui_only` | ⏳ (PR 5 대기) | · diagnosis 탭 과목 추천 카드<br>· 학생 추천 과목 슬롯 표시 |
| `gap_tracking` | `ui_only` | ⏳ (PR 5 대기) | · 진단 탭 정합성 지표 카드(coverage/coherence)<br>· bridge 하이퍼엣지 전용 뷰 |
| `haengteuk_linking` | `ui_only` | ⏳ (PR 5 대기) | · admin 생기부 탭 → 행특 평가항목 카드 링크 배지<br>· 학생/학부모 탭 → 행특 연계 활동 뷰 |
| `interview_generation` | `ui_only` | ⏳ (PR 5 대기) | · 면접 예상질문 탭<br>· 학생 면접 준비 모드 |
| `past_strategy` | `ui_only` | ⏳ (PR 5 대기) | · Past Analytics 대시보드 → 즉시 행동 권고 카드<br>· 학부모 리포트 현재 행동 섹션 |
| `roadmap_generation` | `ui_only` | ⏳ (PR 5 대기) | · 로드맵 탭 (학기별 미션)<br>· 학부모 리포트 요약 |

> **⏳ 임시 terminal**: PR 5 (`PipelineContext.previousRunOutputs` 인프라) 완성 후 해제 대상.
> 2026-04-17 분기점 ① 결정: `ui_only` 는 영구 선언하지 않고 임시로만 표기.

## 4. Cross-run Feedback (PR 5)

직전 실행의 terminal 산출물이 다음 실행의 상류 태스크에 공급되는 경로.
소비 측은 `ctx.previousRunOutputs.taskResults[<taskKey>]` 또는 manifest 의 `readsFromPreviousRun` 에 선언된 DB 테이블을 통해 읽는다.

| 상류 (이번 실행) | ↦ | 하류 (다음 실행) | 사유 |
|---|---|---|---|
| `activity_summary` | → | `storyline_generation` | ui_only |
| `course_recommendation` | → | `ai_diagnosis` | ui_only |
| `gap_tracking` | → | `ai_strategy` | ui_only |
| `haengteuk_linking` | → | `guide_matching` | ui_only |
| `interview_generation` | → | `activity_summary` | ui_only |
| `past_strategy` | → | `past_diagnosis` | ui_only |
| `roadmap_generation` | → | `storyline_generation` | ui_only |

### 직전 실행 테이블 읽기 선언 (`readsFromPreviousRun`)

- `storyline_generation`: `student_record_activity_summaries`
