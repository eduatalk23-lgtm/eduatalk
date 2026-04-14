-- 트랙 D (2026-04-14): student_record_analysis_pipelines 좀비 판정 근본 수정.
--
-- 기존 좀비 판정은 started_at < 5분 전 기반이었으나, 트랙 D 분할 구조에서
-- synthesis 파이프라인은 phase 6개 + narrative 청크 루프로 총 10~13분 정상 소요.
-- started_at 기준은 정상 실행 중인 파이프라인도 오판하여 자동 cancel했다.
--
-- 해결: updated_at 컬럼 추가 + ON UPDATE trigger로 자동 갱신.
-- 각 task 완료/상태 변경마다 runTaskWithState → updatePipelineState 가 UPDATE를 수행하므로
-- 자동으로 heartbeat 역할을 하고, 진짜 좀비(Vercel kill 후 DB write 없음)만 정확히 감지된다.

-- 1. updated_at 컬럼 추가 (기존 row 전부 created_at 값으로 backfill)
ALTER TABLE student_record_analysis_pipelines
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 기존 데이터: started_at 있으면 started_at, 없으면 created_at으로 초기화
UPDATE student_record_analysis_pipelines
SET updated_at = COALESCE(started_at, created_at)
WHERE updated_at IS NOT DISTINCT FROM NOW()::timestamptz
  OR updated_at = created_at;

-- 2. ON UPDATE trigger — 행이 수정될 때마다 updated_at = NOW() 자동 갱신
CREATE OR REPLACE FUNCTION set_analysis_pipelines_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analysis_pipelines_updated_at ON student_record_analysis_pipelines;
CREATE TRIGGER trg_analysis_pipelines_updated_at
BEFORE UPDATE ON student_record_analysis_pipelines
FOR EACH ROW
EXECUTE FUNCTION set_analysis_pipelines_updated_at();

-- 3. 좀비 판정에 쓸 인덱스 (status + updated_at)
CREATE INDEX IF NOT EXISTS idx_analysis_pipelines_status_updated_at
  ON student_record_analysis_pipelines (status, updated_at)
  WHERE status IN ('running', 'pending');
