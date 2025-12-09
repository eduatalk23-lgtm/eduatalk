-- ============================================
-- Migration: Postgres ENUM 타입 생성
-- Date: 2025-12-09
-- Phase: 2 (재조정 기능 - 데이터 모델 및 롤백 정교화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R2-7]
-- ============================================

-- 콘텐츠 타입 ENUM
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type_enum') THEN
    CREATE TYPE content_type_enum AS ENUM ('book', 'lecture', 'custom');
  END IF;
END $$;

-- 조정 타입 ENUM
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjustment_type_enum') THEN
    CREATE TYPE adjustment_type_enum AS ENUM ('range', 'replace', 'full');
  END IF;
END $$;

-- 플랜 상태 ENUM
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_status_enum') THEN
    CREATE TYPE plan_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'canceled');
  END IF;
END $$;

-- 재조정 로그 상태 ENUM
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reschedule_log_status_enum') THEN
    CREATE TYPE reschedule_log_status_enum AS ENUM ('pending', 'completed', 'failed', 'rolled_back');
  END IF;
END $$;

-- 주석
COMMENT ON TYPE content_type_enum IS '콘텐츠 타입: book(교재), lecture(강의), custom(커스텀)';
COMMENT ON TYPE adjustment_type_enum IS '조정 타입: range(범위 수정), replace(콘텐츠 교체), full(전체 재생성)';
COMMENT ON TYPE plan_status_enum IS '플랜 상태: pending(대기), in_progress(진행중), completed(완료), canceled(취소)';
COMMENT ON TYPE reschedule_log_status_enum IS '재조정 로그 상태: pending(대기), completed(완료), failed(실패), rolled_back(롤백됨)';

