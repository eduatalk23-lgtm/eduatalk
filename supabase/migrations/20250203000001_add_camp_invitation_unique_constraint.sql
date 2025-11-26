-- Migration: Add UNIQUE constraint on plan_groups.camp_invitation_id
-- Description: 캠프 초대당 하나의 플랜 그룹만 생성되도록 제약 조건 추가
-- Date: 2025-02-03

-- ============================================
-- plan_groups 테이블에 camp_invitation_id UNIQUE 제약 추가
-- ============================================

-- 기존 중복 데이터 확인 및 정리 (가장 최근 것만 남기고 나머지 삭제)
-- 주의: 이 스크립트는 중복 데이터를 자동으로 정리합니다
DO $$
DECLARE
  duplicate_record RECORD;
  keep_group_id uuid;
BEGIN
  -- camp_invitation_id가 null이 아닌 중복 레코드 찾기
  FOR duplicate_record IN
    SELECT camp_invitation_id, COUNT(*) as count
    FROM plan_groups
    WHERE camp_invitation_id IS NOT NULL
    GROUP BY camp_invitation_id
    HAVING COUNT(*) > 1
  LOOP
    -- 각 중복 그룹에서 가장 최근 것만 남기고 나머지 삭제
    SELECT id INTO keep_group_id
    FROM plan_groups
    WHERE camp_invitation_id = duplicate_record.camp_invitation_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- 나머지 중복 레코드 삭제 (가장 최근 것 제외)
    DELETE FROM plan_groups
    WHERE camp_invitation_id = duplicate_record.camp_invitation_id
      AND id != keep_group_id;

    RAISE NOTICE '중복 제거: camp_invitation_id=%, 유지된 group_id=%, 삭제된 레코드 수=%',
      duplicate_record.camp_invitation_id,
      keep_group_id,
      duplicate_record.count - 1;
  END LOOP;
END $$;

-- UNIQUE 제약 조건 추가 (NULL 값은 허용하므로 WHERE 절 사용)
-- PostgreSQL에서는 NULL 값이 여러 개 있어도 UNIQUE 제약을 위반하지 않음
-- 하지만 명시적으로 NULL이 아닌 값에 대해서만 UNIQUE 제약을 적용하려면
-- 부분 인덱스(partial index)를 사용하거나, UNIQUE 제약을 직접 추가할 수 있음

-- 방법 1: UNIQUE 제약 조건 추가 (NULL 값은 여러 개 허용)
-- 이 방법은 NULL이 아닌 값에 대해서만 UNIQUE를 보장
DO $$
BEGIN
  -- 기존 제약 조건이 있는지 확인하고 없으면 추가
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plan_groups_camp_invitation_id_key'
  ) THEN
    ALTER TABLE plan_groups
    ADD CONSTRAINT plan_groups_camp_invitation_id_key
    UNIQUE (camp_invitation_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '제약 조건이 이미 존재합니다.';
END $$;

-- 방법 2: 부분 인덱스 사용 (NULL 값 제외하고 UNIQUE 보장)
-- 이 방법이 더 명확하지만, 위의 UNIQUE 제약 조건과 중복될 수 있음
-- 주석 처리: 필요시 활성화
/*
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_groups_camp_invitation_id_unique
ON plan_groups (camp_invitation_id)
WHERE camp_invitation_id IS NOT NULL;
*/

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_plan_groups_camp_invitation_id 
ON plan_groups (camp_invitation_id)
WHERE camp_invitation_id IS NOT NULL;





