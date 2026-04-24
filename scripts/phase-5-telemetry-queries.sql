-- ============================================================================
-- Phase 5 draft_refinement telemetry 쿼리 번들
--
-- 대시보드: /superadmin/pipeline-telemetry (동일 쿼리 사용)
-- 런북: docs/phase-5-production-rollout-checklist.md
-- 판정 기준: lib/domains/record-analysis/llm/prompts/draft-refinement-prompts.ts 상단
--
-- 실행: psql 또는 supabase studio SQL editor 에서 한 번에 또는 섹션별 복붙.
--
-- ⚠️ 주의 (DB 단독 관찰 한계):
--   · avgScoreDelta 는 runner 실행 시점 산출물(stdout / OTel span) 에서만 정확 — DB 상에는
--     before 스냅샷이 없어 refined / rolledBack 구분을 score 값만으로 할 수 없음.
--   · rollback 시 score 가 원본으로 복구되므로 "retry_count=1 && variant=v1/v2 && score<70"
--     은 **rollback 가능성 높음** 수준의 heuristic. 확정은 OTel `gen_ai.*` span 교차.
--   · variant NULL + retry_count=1 = early-skip (no-draft 등). attempted 아님.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- Q1. variantBreakdown (v1 vs v2) — attempted 분포 + 현 score 분포
--
-- 목적: variant 별 실행 횟수 + 현재 score 통계로 대략적 성능 비교.
-- 판정: v2.avg ≥ v1.avg + 2.0 && n(v2) ≥ 30 → §5 [A] 승격 후보.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  COALESCE(refinement_variant, 'NULL(not_attempted)') AS variant,
  COUNT(*)                                            AS attempts,
  COUNT(*) FILTER (WHERE retry_count = 1)             AS retried,
  ROUND(AVG(overall_score)::numeric, 2)               AS avg_score,
  MIN(overall_score)                                  AS min_score,
  MAX(overall_score)                                  AS max_score,
  COUNT(*) FILTER (WHERE overall_score < 70)          AS below_threshold,
  COUNT(*) FILTER (WHERE overall_score >= 70)         AS at_or_above_threshold
FROM public.student_record_content_quality
WHERE source = 'ai_projected'
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY refinement_variant
ORDER BY refinement_variant NULLS LAST;


-- ────────────────────────────────────────────────────────────────────────────
-- Q2. record_type 별 avg score by variant
--
-- 목적: setek / changche / haengteuk × v1 / v2 6분할 현황. haengteuk 최대 수혜 가설.
-- 기대: haengteuk 평균이 다른 type 대비 낮게 유지 (Sprint 2: 59.1 → refined 후 70+).
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  record_type,
  COALESCE(refinement_variant, 'NULL') AS variant,
  COUNT(*)                             AS n,
  ROUND(AVG(overall_score)::numeric, 2) AS avg_score,
  ROUND(AVG(specificity)::numeric, 2)   AS avg_specificity,
  ROUND(AVG(coherence)::numeric, 2)     AS avg_coherence,
  ROUND(AVG(depth)::numeric, 2)         AS avg_depth,
  ROUND(AVG(grammar)::numeric, 2)       AS avg_grammar
FROM public.student_record_content_quality
WHERE source = 'ai_projected'
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY record_type, refinement_variant
ORDER BY record_type, variant NULLS LAST;


-- ────────────────────────────────────────────────────────────────────────────
-- Q3. retry_count 분포
--
-- 목적: 전체 레코드 중 P9 가 touch 한 비율.
-- 기대: retry_count=0 대부분, retry_count=1 은 P8 에서 <70 나온 레코드 비율(원래 10~25%).
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  retry_count,
  COUNT(*) AS n,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM public.student_record_content_quality
WHERE source = 'ai_projected'
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY retry_count
ORDER BY retry_count;


-- ────────────────────────────────────────────────────────────────────────────
-- Q4. 최근 14일 processed 추이 (day bucket)
--
-- 목적: trafic 누적 속도 확인. n ≥ 30 (variant 별) 도달 시점 예측.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  DATE(updated_at)                                   AS day,
  COUNT(*)                                           AS touched,
  COUNT(*) FILTER (WHERE retry_count = 1)            AS p9_attempts,
  COUNT(*) FILTER (WHERE refinement_variant = 'v1_baseline')      AS v1_attempts,
  COUNT(*) FILTER (WHERE refinement_variant = 'v2_axis_targeted') AS v2_attempts
FROM public.student_record_content_quality
WHERE source = 'ai_projected'
  AND updated_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(updated_at)
ORDER BY day DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- Q5. rollback 후보 레코드 (heuristic)
--
-- 목적: retry_count=1 이면서 여전히 score<70 인 레코드 식별.
-- 한계: DB 단독으로는 "진짜 rollback" vs "refined 했지만 여전히 <70" 구분 불가.
--        정확한 rollback 카운트는 runner 실행 로그 / OTel span 참조.
--        이 쿼리는 "조사가 필요한 후보" 리스트 목적.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  student_id,
  record_type,
  record_id,
  school_year,
  refinement_variant,
  overall_score,
  specificity,
  coherence,
  depth,
  grammar,
  array_length(issues, 1) AS issue_count,
  updated_at
FROM public.student_record_content_quality
WHERE source = 'ai_projected'
  AND retry_count = 1
  AND overall_score < 70
  AND created_at >= NOW() - INTERVAL '14 days'
ORDER BY overall_score ASC, updated_at DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────
-- Q6. variant × record_type 교차 집계 (판정 보조)
--
-- 목적: §5 [A] / [B] / [C] 분기 판정 시 변동성 큰 조합 식별 (예: v2 가 haengteuk 에서만 승리).
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  record_type,
  COALESCE(refinement_variant, 'NULL') AS variant,
  COUNT(*)                             AS n,
  ROUND(AVG(overall_score)::numeric, 2) AS avg_score,
  ROUND(STDDEV(overall_score)::numeric, 2) AS stddev_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_score) AS median_score,
  COUNT(*) FILTER (WHERE overall_score >= 70) AS passed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE overall_score >= 70) / NULLIF(COUNT(*), 0), 2) AS pass_rate_pct
FROM public.student_record_content_quality
WHERE source = 'ai_projected'
  AND retry_count = 1
  AND refinement_variant IS NOT NULL
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY record_type, refinement_variant
ORDER BY record_type, variant;
