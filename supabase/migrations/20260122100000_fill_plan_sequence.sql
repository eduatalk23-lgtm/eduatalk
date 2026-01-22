-- 기존 플랜의 sequence 필드를 채우는 마이그레이션
-- 날짜/컨테이너 타입별로 sequence를 1, 2, 3... 으로 설정

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, plan_date, container_type
      ORDER BY created_at ASC
    ) as new_seq
  FROM student_plan
  WHERE is_active = true
    AND sequence IS NULL
)
UPDATE student_plan
SET sequence = ranked.new_seq,
    updated_at = NOW()
FROM ranked
WHERE student_plan.id = ranked.id;

-- 결과 확인용 (실행 후 삭제 가능)
-- SELECT COUNT(*) FROM student_plan WHERE sequence IS NULL AND is_active = true;
