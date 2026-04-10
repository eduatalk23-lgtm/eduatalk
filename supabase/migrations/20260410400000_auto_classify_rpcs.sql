-- ============================================================
-- Phase A 자동 분류 RPC (신규 가이드 → 클러스터/난이도/사슬 자동 편입)
-- ============================================================

-- (1) k-NN 최근접 가이드 조회 (클러스터+난이도 투표 + 중복 감지용)
CREATE OR REPLACE FUNCTION find_nearest_guides(
  p_guide_id uuid,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  guide_id uuid,
  title text,
  similarity numeric,
  topic_cluster_id uuid,
  cluster_name text,
  difficulty_level text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    g.id as guide_id,
    g.title,
    round((1 - (gc_target.embedding <=> gc.embedding))::numeric, 4) as similarity,
    g.topic_cluster_id,
    c.name as cluster_name,
    g.difficulty_level
  FROM exploration_guides g
  JOIN exploration_guide_content gc ON gc.guide_id = g.id
  CROSS JOIN (
    SELECT embedding FROM exploration_guide_content WHERE guide_id = p_guide_id
  ) gc_target
  LEFT JOIN exploration_guide_topic_clusters c ON c.id = g.topic_cluster_id
  WHERE g.id <> p_guide_id
    AND g.status = 'approved'
    AND g.is_latest = true
    AND g.topic_cluster_id IS NOT NULL
    AND gc.embedding IS NOT NULL
  ORDER BY gc_target.embedding <=> gc.embedding
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION find_nearest_guides IS
  'Phase A: pgvector cosine similarity로 가장 유사한 기존 가이드 k개 조회. 클러스터/난이도 투표 + 중복 감지용.';

-- (2) 사슬 링크 생성 (단일 가이드 → 인접 난이도)
CREATE OR REPLACE FUNCTION create_sequel_links(
  p_from_guide_id uuid,
  p_cluster_id uuid,
  p_target_level text,
  p_direction text DEFAULT 'forward',
  p_limit int DEFAULT 3,
  p_min_similarity numeric DEFAULT 0.4
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF p_direction = 'forward' THEN
    INSERT INTO exploration_guide_sequels
      (from_guide_id, to_guide_id, topic_cluster_id, difficulty_step, relation_type, confidence, created_by)
    SELECT
      p_from_guide_id,
      nn.id,
      p_cluster_id,
      1,
      'direct_sequel',
      round((1 - nn.dist)::numeric, 4),
      'llm'
    FROM (
      SELECT g2.id, gc2.embedding <=> gc1.embedding as dist
      FROM exploration_guides g2
      JOIN exploration_guide_content gc2 ON gc2.guide_id = g2.id
      CROSS JOIN (SELECT embedding FROM exploration_guide_content WHERE guide_id = p_from_guide_id) gc1
      WHERE g2.topic_cluster_id = p_cluster_id
        AND g2.difficulty_level = p_target_level
        AND g2.status = 'approved' AND g2.is_latest = true
        AND g2.id <> p_from_guide_id
      ORDER BY gc2.embedding <=> gc1.embedding
      LIMIT p_limit
    ) nn
    WHERE 1 - nn.dist >= p_min_similarity
    ON CONFLICT (from_guide_id, to_guide_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    INSERT INTO exploration_guide_sequels
      (from_guide_id, to_guide_id, topic_cluster_id, difficulty_step, relation_type, confidence, created_by)
    SELECT
      nn.id,
      p_from_guide_id,
      p_cluster_id,
      1,
      'direct_sequel',
      round((1 - nn.dist)::numeric, 4),
      'llm'
    FROM (
      SELECT g2.id, gc2.embedding <=> gc1.embedding as dist
      FROM exploration_guides g2
      JOIN exploration_guide_content gc2 ON gc2.guide_id = g2.id
      CROSS JOIN (SELECT embedding FROM exploration_guide_content WHERE guide_id = p_from_guide_id) gc1
      WHERE g2.topic_cluster_id = p_cluster_id
        AND g2.difficulty_level = p_target_level
        AND g2.status = 'approved' AND g2.is_latest = true
        AND g2.id <> p_from_guide_id
      ORDER BY gc2.embedding <=> gc1.embedding
      LIMIT p_limit
    ) nn
    WHERE 1 - nn.dist >= p_min_similarity
    ON CONFLICT (from_guide_id, to_guide_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION create_sequel_links IS
  'Phase A: 단일 가이드에 대해 같은 클러스터 내 인접 난이도 가이드와 사슬 링크 생성. forward=this→target, backward=target→this.';
