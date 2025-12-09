-- ============================================
-- Migration: plan_group_items 테이블 생성 및 origin_plan_item_id 추가
-- Date: 2025-12-09
-- Phase: 2 (플랜 구조·CRUD 리팩토링)
-- Refs: docs/refactoring/03_phase_todo_list.md [P2-1], [P2-2]
-- ============================================

-- ============================================
-- Part 1: plan_group_items 테이블 생성 (논리 플랜 항목)
-- ============================================

CREATE TABLE IF NOT EXISTS plan_group_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  plan_group_id uuid NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
  
  -- 콘텐츠 참조
  content_type text NOT NULL CHECK (content_type IN ('book', 'lecture', 'custom')),
  content_id uuid NOT NULL,
  master_content_id uuid, -- 마스터 콘텐츠 참조 (학생 콘텐츠가 복제본인 경우)
  
  -- 목표 범위
  target_start_page_or_time integer NOT NULL DEFAULT 0,
  target_end_page_or_time integer NOT NULL DEFAULT 0,
  
  -- 분할/반복 전략
  repeat_count integer DEFAULT 1, -- 몇 회차로 나눌지
  split_strategy text DEFAULT 'equal', -- 분할 전략: 'equal', 'custom', 'auto'
  
  -- 플래그
  is_review boolean DEFAULT false, -- 복습 항목 여부
  is_required boolean DEFAULT true, -- 필수 여부 (false = 선택적)
  
  -- 순서/우선순위
  priority integer DEFAULT 0, -- 높을수록 우선
  display_order integer DEFAULT 0, -- 표시 순서
  
  -- 추가 메타데이터
  metadata jsonb DEFAULT '{}', -- 확장 가능한 메타데이터
  
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_group_items_plan_group_id 
  ON plan_group_items(plan_group_id);
  
CREATE INDEX IF NOT EXISTS idx_plan_group_items_content_id 
  ON plan_group_items(content_id);
  
CREATE INDEX IF NOT EXISTS idx_plan_group_items_tenant_id 
  ON plan_group_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_plan_group_items_display_order
  ON plan_group_items(plan_group_id, display_order);

-- 주석
COMMENT ON TABLE plan_group_items IS '논리 플랜 항목 테이블 - 플랜그룹 내 학습 계획의 "설계" 단위';
COMMENT ON COLUMN plan_group_items.content_type IS '콘텐츠 유형: book(교재), lecture(강의), custom(커스텀)';
COMMENT ON COLUMN plan_group_items.target_start_page_or_time IS '목표 시작 범위 (페이지 또는 시간)';
COMMENT ON COLUMN plan_group_items.target_end_page_or_time IS '목표 끝 범위 (페이지 또는 시간)';
COMMENT ON COLUMN plan_group_items.repeat_count IS '분할 회차 수 (예: 3이면 3회에 나눠서 학습)';
COMMENT ON COLUMN plan_group_items.split_strategy IS '분할 전략: equal(균등), custom(사용자 지정), auto(자동)';
COMMENT ON COLUMN plan_group_items.is_review IS '복습 항목 여부';
COMMENT ON COLUMN plan_group_items.is_required IS '필수 항목 여부 (선택적 항목은 시간 부족 시 제외 가능)';
COMMENT ON COLUMN plan_group_items.priority IS '우선순위 (높을수록 먼저 배치)';
COMMENT ON COLUMN plan_group_items.display_order IS '표시 순서';
COMMENT ON COLUMN plan_group_items.metadata IS '확장 가능한 메타데이터 (JSON)';

-- updated_at 트리거
DROP TRIGGER IF EXISTS update_plan_group_items_updated_at ON plan_group_items;
CREATE TRIGGER update_plan_group_items_updated_at
  BEFORE UPDATE ON plan_group_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Part 2: student_plan에 origin_plan_item_id 컬럼 추가
-- ============================================

-- 컬럼 추가 (이미 존재하면 무시)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_plan' AND column_name = 'origin_plan_item_id'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN origin_plan_item_id uuid REFERENCES plan_group_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_student_plan_origin_plan_item_id 
  ON student_plan(origin_plan_item_id)
  WHERE origin_plan_item_id IS NOT NULL;

-- 주석
COMMENT ON COLUMN student_plan.origin_plan_item_id IS 
'원본 논리 플랜 항목 ID - 어떤 논리 플랜에서 파생되었는지 추적';

-- ============================================
-- Part 3: plan_group_items RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE plan_group_items ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "plan_group_items_student_all" ON plan_group_items;
DROP POLICY IF EXISTS "plan_group_items_admin_all" ON plan_group_items;

-- 학생 정책: 자신의 플랜 그룹에 속한 항목만 접근 가능
CREATE POLICY "plan_group_items_student_all" ON plan_group_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plan_groups
      WHERE plan_groups.id = plan_group_items.plan_group_id
      AND plan_groups.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_groups
      WHERE plan_groups.id = plan_group_items.plan_group_id
      AND plan_groups.student_id = auth.uid()
    )
  );

-- 관리자/컨설턴트 정책: 같은 테넌트 내 모든 항목 접근 가능
CREATE POLICY "plan_group_items_admin_all" ON plan_group_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = plan_group_items.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = plan_group_items.tenant_id
    )
  );

-- 주석
COMMENT ON POLICY "plan_group_items_student_all" ON plan_group_items IS 
'Students can manage their own plan group items';

COMMENT ON POLICY "plan_group_items_admin_all" ON plan_group_items IS 
'Admins can manage all plan group items within their tenant';

