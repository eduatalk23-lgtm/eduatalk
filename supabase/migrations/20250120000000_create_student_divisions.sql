-- 학생 구분 항목 관리 테이블 생성
-- 고등부, 중등부, 기타 구분을 동적으로 관리하기 위한 마스터 테이블

-- student_divisions 테이블 생성
CREATE TABLE IF NOT EXISTS student_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_divisions_display_order 
ON student_divisions(display_order);

CREATE INDEX IF NOT EXISTS idx_student_divisions_is_active 
ON student_divisions(is_active);

-- 코멘트 추가
COMMENT ON TABLE student_divisions IS '학생 구분 항목 마스터 테이블 (고등부, 중등부, 기타 등)';
COMMENT ON COLUMN student_divisions.name IS '구분 이름 (예: 고등부, 중등부, 기타)';
COMMENT ON COLUMN student_divisions.display_order IS '표시 순서 (작을수록 먼저 표시)';
COMMENT ON COLUMN student_divisions.is_active IS '활성화 여부';

-- 초기 데이터 삽입 (기존 하드코딩된 값)
INSERT INTO student_divisions (name, display_order, is_active)
VALUES 
  ('고등부', 1, true),
  ('중등부', 2, true),
  ('기타', 3, true)
ON CONFLICT (name) DO NOTHING;

-- RLS 정책 설정
ALTER TABLE student_divisions ENABLE ROW LEVEL SECURITY;

-- 관리자만 CRUD 가능
CREATE POLICY "관리자는 student_divisions 조회 가능"
ON student_divisions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "관리자는 student_divisions 생성 가능"
ON student_divisions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "관리자는 student_divisions 수정 가능"
ON student_divisions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "관리자는 student_divisions 삭제 가능"
ON student_divisions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_student_divisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_student_divisions_updated_at
BEFORE UPDATE ON student_divisions
FOR EACH ROW
EXECUTE FUNCTION update_student_divisions_updated_at();

