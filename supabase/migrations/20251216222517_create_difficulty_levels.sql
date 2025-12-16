-- 난이도 마스터 테이블 생성
CREATE TABLE IF NOT EXISTS difficulty_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  content_type varchar(20) NOT NULL CHECK (content_type IN ('book', 'lecture', 'custom', 'common')),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, content_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_difficulty_levels_content_type ON difficulty_levels(content_type);
CREATE INDEX IF NOT EXISTS idx_difficulty_levels_active ON difficulty_levels(is_active);
CREATE INDEX IF NOT EXISTS idx_difficulty_levels_display_order ON difficulty_levels(content_type, display_order);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_difficulty_levels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_difficulty_levels_updated_at
  BEFORE UPDATE ON difficulty_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_difficulty_levels_updated_at();

-- 초기 데이터 삽입 (기존 폼에서 사용하던 난이도 옵션)
-- book 타입: 개념, 기본, 심화
INSERT INTO difficulty_levels (name, content_type, display_order, is_active, description)
VALUES
  ('개념', 'book', 1, true, '기본 개념 학습용 교재'),
  ('기본', 'book', 2, true, '기본 문제 풀이용 교재'),
  ('심화', 'book', 3, true, '심화 문제 풀이용 교재')
ON CONFLICT (name, content_type) DO NOTHING;

-- lecture 타입: 개념, 기본, 심화
INSERT INTO difficulty_levels (name, content_type, display_order, is_active, description)
VALUES
  ('개념', 'lecture', 1, true, '기본 개념 학습용 강의'),
  ('기본', 'lecture', 2, true, '기본 문제 풀이용 강의'),
  ('심화', 'lecture', 3, true, '심화 문제 풀이용 강의')
ON CONFLICT (name, content_type) DO NOTHING;

-- custom 타입: 상, 중, 하
INSERT INTO difficulty_levels (name, content_type, display_order, is_active, description)
VALUES
  ('상', 'custom', 1, true, '상급 난이도 커스텀 콘텐츠'),
  ('중', 'custom', 2, true, '중급 난이도 커스텀 콘텐츠'),
  ('하', 'custom', 3, true, '하급 난이도 커스텀 콘텐츠')
ON CONFLICT (name, content_type) DO NOTHING;

-- RLS 정책 (모든 사용자가 읽기 가능, 관리자만 쓰기 가능)
ALTER TABLE difficulty_levels ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 모든 인증된 사용자
CREATE POLICY "difficulty_levels_select_policy"
  ON difficulty_levels
  FOR SELECT
  USING (true);

-- 쓰기 정책: 관리자만
CREATE POLICY "difficulty_levels_insert_policy"
  ON difficulty_levels
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "difficulty_levels_update_policy"
  ON difficulty_levels
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "difficulty_levels_delete_policy"
  ON difficulty_levels
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

