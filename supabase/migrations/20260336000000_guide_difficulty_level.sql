-- 가이드 + 주제 난이도 레벨링 (AI 제안 + 컨설턴트 확정)

-- exploration_guides: 난이도 + AI 자동 여부
ALTER TABLE exploration_guides
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK(difficulty_level IN ('basic','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS difficulty_auto BOOLEAN DEFAULT true;

COMMENT ON COLUMN exploration_guides.difficulty_level IS '난이도: basic(기초)/intermediate(심화)/advanced(고급)';
COMMENT ON COLUMN exploration_guides.difficulty_auto IS 'true=AI 자동 설정, false=컨설턴트 수동 변경';

-- suggested_topics: 난이도
ALTER TABLE suggested_topics
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK(difficulty_level IN ('basic','intermediate','advanced'));

COMMENT ON COLUMN suggested_topics.difficulty_level IS '난이도: basic(기초)/intermediate(심화)/advanced(고급)';

-- 필터용 인덱스
CREATE INDEX IF NOT EXISTS idx_eg_difficulty ON exploration_guides(difficulty_level) WHERE difficulty_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_st_difficulty ON suggested_topics(difficulty_level) WHERE difficulty_level IS NOT NULL;
