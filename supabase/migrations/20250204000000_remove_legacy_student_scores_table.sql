-- Migration: Remove Legacy student_scores Table
-- Description: 레거시 student_scores 테이블 제거
-- Date: 2025-02-04
--
-- ⚠️ 주의: 이 마이그레이션을 실행하기 전에:
-- 1. 모든 데이터가 student_internal_scores 또는 student_mock_scores로 마이그레이션되었는지 확인
-- 2. 백업 테이블 생성 (CREATE TABLE student_scores_backup AS SELECT * FROM student_scores;)
-- 3. 코드베이스에서 student_scores 테이블 참조가 없는지 확인
--
-- Phase 4 마이그레이션 완료 후, 모든 코드가 새 구조를 사용하므로
-- 레거시 테이블을 안전하게 제거할 수 있습니다.

-- ============================================
-- 1. 테이블 존재 여부 확인
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_scores'
    ) INTO table_exists;
    
    -- 테이블이 존재하지 않으면 마이그레이션 종료
    IF NOT table_exists THEN
        RAISE NOTICE 'student_scores 테이블이 존재하지 않습니다. 마이그레이션을 건너뜁니다.';
        RETURN;
    END IF;
END $$;

-- ============================================
-- 2. 백업 테이블 생성 (안전장치)
-- ============================================

-- 테이블이 존재하는 경우에만 백업 테이블 생성
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_scores'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- 백업 테이블이 없으면 생성
        CREATE TABLE IF NOT EXISTS student_scores_backup AS 
        SELECT * FROM student_scores WHERE false; -- 스키마만 복사
    END IF;
END $$;

-- 기존 데이터 백업 (데이터가 있는 경우)
DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_scores'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- 데이터 개수 확인
        SELECT COUNT(*) INTO row_count FROM student_scores;
        
        IF row_count > 0 THEN
            -- 백업 테이블에 데이터 복사 (중복 방지)
            INSERT INTO student_scores_backup 
            SELECT * FROM student_scores 
            WHERE NOT EXISTS (
                SELECT 1 FROM student_scores_backup 
                WHERE student_scores_backup.id = student_scores.id
            );
            
            RAISE NOTICE 'student_scores 테이블에서 % 개의 레코드를 백업했습니다.', row_count;
        ELSE
            RAISE NOTICE 'student_scores 테이블에 데이터가 없습니다.';
        END IF;
    END IF;
END $$;

-- ============================================
-- 3. 외래 키 제약 조건 확인 및 제거
-- ============================================

-- 외래 키 제약 조건이 있는지 확인하고 제거
DO $$
DECLARE
    table_exists BOOLEAN;
    r RECORD;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_scores'
    ) INTO table_exists;
    
    IF table_exists THEN
        FOR r IN (
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = 'student_scores'
            AND constraint_type = 'FOREIGN KEY'
        ) LOOP
            EXECUTE 'ALTER TABLE student_scores DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
            RAISE NOTICE '외래 키 제약 조건 제거: %', r.constraint_name;
        END LOOP;
    END IF;
END $$;

-- ============================================
-- 4. 테이블 제거
-- ============================================

-- 테이블 제거 (CASCADE로 모든 의존성 제거)
DROP TABLE IF EXISTS student_scores CASCADE;

-- ============================================
-- 5. 코멘트 추가
-- ============================================

COMMENT ON TABLE student_scores_backup IS 
    '레거시 student_scores 테이블 백업 (2025-02-04). 
     모든 데이터는 student_internal_scores 또는 student_mock_scores로 마이그레이션되었습니다.
     안전 확인 후 삭제 가능.';

-- ============================================
-- 6. 완료 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '레거시 student_scores 테이블이 성공적으로 제거되었습니다.';
    RAISE NOTICE '백업 테이블: student_scores_backup';
END $$;

