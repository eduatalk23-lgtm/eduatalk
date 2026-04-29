-- ============================================
-- Step B Shadow 측정 — 박제 데이터 추출 SQL
--
-- 사용법:
--   1. 풀런 (synthesis pipeline) 완료 후 실행
--   2. studentId 를 실 측정 대상 ID 로 치환
--   3. 6개 쿼리(Q1~Q6) 결과를 보고 Step D 통합 정책 결정
--
-- 측정 대상:
--   김세린:    0e3e149d-4b9c-402d-ad5c-b3df04190889
--   이가은:    35ee94b6-9484-4bee-8100-c761c1c56831
-- ============================================

-- ─────────────────────────────────────────
-- Q0. 사전 점검 — 박제가 실제로 떨어졌는지
-- ─────────────────────────────────────────
SELECT
  id AS pipeline_id,
  pipeline_type,
  status,
  completed_at,
  (task_results ? '_slots') AS has_slots,
  (task_results ? '_slotAwareScores') AS has_shadow_scores,
  jsonb_array_length(COALESCE(task_results->'_slots', '[]'::jsonb)) AS slot_count,
  task_results->'_slotAwareScores'->'stats' AS shadow_stats
FROM student_record_analysis_pipelines
WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'  -- 김세린 (or 인제고 ID)
  AND pipeline_type = 'synthesis'
  AND status = 'completed'
ORDER BY completed_at DESC
LIMIT 1;

-- ─────────────────────────────────────────
-- Q1. 슬롯 인벤토리 — 학년 × 영역 × tier 분포
-- 검증 A3, A5 — 슬롯이 학생별 cap 반영해 다양하게 깔렸는지
-- ─────────────────────────────────────────
WITH latest AS (
  SELECT task_results FROM student_record_analysis_pipelines
  WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
    AND pipeline_type = 'synthesis' AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
)
SELECT
  s->>'grade' AS grade,
  s->>'area' AS area,
  s->>'tier' AS tier,
  s->'constraints'->>'maxDifficulty' AS cap,
  jsonb_array_length(s->'intent'->'weakCompetencies') AS weak_cnt,
  jsonb_array_length(s->'intent'->'unfulfilledMilestoneIds') AS milestone_cnt,
  s->'state'->>'priority' AS priority
FROM latest, jsonb_array_elements(task_results->'_slots') s
ORDER BY (s->>'grade')::int, s->>'area', s->>'tier';

-- ─────────────────────────────────────────
-- Q2. Shadow 통계 요약 — 검증 B1, B2, C3
-- ─────────────────────────────────────────
WITH latest AS (
  SELECT task_results FROM student_record_analysis_pipelines
  WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
    AND pipeline_type = 'synthesis' AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
)
SELECT
  task_results->'_slotAwareScores'->'stats'->>'slotCount' AS slot_count,
  task_results->'_slotAwareScores'->'stats'->>'rankedCount' AS ranked_count,
  task_results->'_slotAwareScores'->'stats'->>'pairsScored' AS pairs_scored,
  task_results->'_slotAwareScores'->'stats'->>'pairsRejected' AS pairs_rejected,
  ROUND(
    100.0 * (task_results->'_slotAwareScores'->'stats'->>'pairsRejected')::numeric
    / NULLIF((task_results->'_slotAwareScores'->'stats'->>'pairsScored')::numeric, 0),
    2
  ) AS reject_pct
FROM latest;

-- ─────────────────────────────────────────
-- Q3. 슬롯 별 Top-1 (slot-aware) — 정합성 + tierFit 분포
-- 검증 B3, C2
-- ─────────────────────────────────────────
WITH latest AS (
  SELECT task_results FROM student_record_analysis_pipelines
  WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
    AND pipeline_type = 'synthesis' AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
)
SELECT
  topk->>'slotId' AS slot_id,
  topk->>'grade' AS grade,
  topk->>'area' AS area,
  topk->>'tier' AS tier,
  jsonb_array_length(topk->'candidates') AS candidate_cnt,
  topk->'candidates'->0->>'guideId' AS top_guide_id,
  topk->'candidates'->0->>'title' AS top_title,
  (topk->'candidates'->0->'breakdown'->>'totalScore')::numeric AS top_total,
  (topk->'candidates'->0->'breakdown'->'bonuses'->0->>'weighted')::numeric AS tier_fit,
  (topk->'candidates'->0->'breakdown'->'bonuses'->1->>'weighted')::numeric AS subject_fit
FROM latest, jsonb_array_elements(task_results->'_slotAwareScores'->'topKPerSlot') topk
ORDER BY (topk->>'grade')::int, topk->>'area';

-- ─────────────────────────────────────────
-- Q4. 빈 슬롯 — 어떤 슬롯도 후보가 0건인지 (검증 C5)
-- ─────────────────────────────────────────
WITH latest AS (
  SELECT task_results FROM student_record_analysis_pipelines
  WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
    AND pipeline_type = 'synthesis' AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
)
SELECT
  topk->>'slotId' AS slot_id,
  topk->>'grade' AS grade,
  topk->>'area' AS area,
  topk->>'tier' AS tier
FROM latest, jsonb_array_elements(task_results->'_slotAwareScores'->'topKPerSlot') topk
WHERE jsonb_array_length(topk->'candidates') = 0
ORDER BY (topk->>'grade')::int;

-- ─────────────────────────────────────────
-- Q5. 9 승수 ranking Top-N vs slot-aware Top-N — overlap 측정 (검증 C1)
--
-- 9 승수 ranking 의 Top-N 은 actual 배정(exploration_guide_assignments)으로 갈음.
-- slot-aware Top-N 은 박제된 topKPerSlot 의 union.
-- ─────────────────────────────────────────
WITH latest AS (
  SELECT id AS pipeline_id, task_results, completed_at
  FROM student_record_analysis_pipelines
  WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
    AND pipeline_type = 'synthesis' AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
),
ranking_topn AS (
  -- 실제 배정 = 9 승수 ranking 결과
  SELECT DISTINCT a.guide_id
  FROM latest l
  JOIN exploration_guide_assignments a
    ON a.student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
   AND a.created_at >= l.completed_at - interval '5 minutes'
),
shadow_topn AS (
  SELECT DISTINCT (cand->>'guideId') AS guide_id
  FROM latest l, jsonb_array_elements(l.task_results->'_slotAwareScores'->'topKPerSlot') topk,
       jsonb_array_elements(topk->'candidates') cand
)
SELECT
  (SELECT COUNT(*) FROM ranking_topn) AS ranking_n,
  (SELECT COUNT(*) FROM shadow_topn) AS shadow_n,
  (SELECT COUNT(*) FROM ranking_topn r INNER JOIN shadow_topn s USING (guide_id)) AS overlap_n,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM ranking_topn r INNER JOIN shadow_topn s USING (guide_id))
    / NULLIF((SELECT COUNT(*) FROM ranking_topn), 0),
    2
  ) AS overlap_pct;

-- ─────────────────────────────────────────
-- Q6. tierFit / subjectFit 분포 (검증 C2, C4)
-- ─────────────────────────────────────────
WITH latest AS (
  SELECT task_results FROM student_record_analysis_pipelines
  WHERE student_id = '0e3e149d-4b9c-402d-ad5c-b3df04190889'
    AND pipeline_type = 'synthesis' AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
),
all_pairs AS (
  SELECT
    cand->>'guideId' AS guide_id,
    (b->>'name') AS bonus_name,
    (b->>'rawValue')::numeric AS raw_v,
    (b->>'weighted')::numeric AS weighted
  FROM latest, jsonb_array_elements(task_results->'_slotAwareScores'->'topKPerSlot') topk,
       jsonb_array_elements(topk->'candidates') cand,
       jsonb_array_elements(cand->'breakdown'->'bonuses') b
)
SELECT
  bonus_name,
  COUNT(*) AS sample_cnt,
  ROUND(AVG(raw_v), 3) AS avg_raw,
  ROUND(AVG(weighted), 2) AS avg_weighted,
  ROUND(MIN(weighted), 2) AS min_w,
  ROUND(MAX(weighted), 2) AS max_w,
  COUNT(*) FILTER (WHERE raw_v >= 0.99) AS perfect_cnt,
  COUNT(*) FILTER (WHERE raw_v <= 0.01) AS zero_cnt
FROM all_pairs
GROUP BY bonus_name
ORDER BY bonus_name;
