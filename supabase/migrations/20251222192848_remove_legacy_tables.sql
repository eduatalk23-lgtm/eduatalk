-- ============================================
-- Migration: Remove Legacy Tables
-- Description: 사용되지 않는 레거시 테이블 제거
-- Date: 2025-12-22
-- 
-- 제거 대상:
-- 1. content_masters (0개 행, master_books/master_lectures로 대체됨)
-- 2. content_master_details (0개 행, book_details/lecture_episodes로 대체됨)
-- 3. student_daily_schedule (0개 행, student_plan으로 대체됨)
--
-- ⚠️ 주의: 이 마이그레이션을 실행하기 전에:
-- 1. 모든 데이터가 0개 행인지 확인 완료
-- 2. 코드베이스에서 참조가 없는지 확인 완료
-- 3. 백업 완료
-- ============================================

-- ============================================
-- Part 1: content_master_details 테이블 제거
-- ============================================
-- content_masters를 참조하므로 먼저 제거

DO $$
DECLARE
    table_exists BOOLEAN;
    policy_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'content_master_details'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE 'content_master_details 테이블이 존재하지 않습니다. 건너뜁니다.';
    ELSE
        -- RLS 정책 삭제
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'content_master_details';
        
        IF policy_count > 0 THEN
            DROP POLICY IF EXISTS content_master_details_select ON content_master_details;
            RAISE NOTICE 'content_master_details RLS 정책 제거 완료';
        END IF;
        
        -- 외래키 제약조건 확인 및 제거
        SELECT COUNT(*) INTO constraint_count
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'content_master_details'
        AND constraint_type = 'FOREIGN KEY';
        
        IF constraint_count > 0 THEN
            ALTER TABLE content_master_details 
            DROP CONSTRAINT IF EXISTS content_master_details_master_id_fkey;
            RAISE NOTICE 'content_master_details 외래키 제약조건 제거 완료';
        END IF;
        
        -- 테이블 제거 (인덱스는 자동으로 삭제됨)
        DROP TABLE IF EXISTS content_master_details CASCADE;
        RAISE NOTICE 'content_master_details 테이블 제거 완료';
    END IF;
END $$;

-- ============================================
-- Part 2: content_masters 테이블 제거
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    policy_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'content_masters'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE 'content_masters 테이블이 존재하지 않습니다. 건너뜁니다.';
    ELSE
        -- RLS 정책 삭제
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'content_masters';
        
        IF policy_count > 0 THEN
            DROP POLICY IF EXISTS content_masters_select_all ON content_masters;
            RAISE NOTICE 'content_masters RLS 정책 제거 완료';
        END IF;
        
        -- 외래키 제약조건 확인 및 제거
        SELECT COUNT(*) INTO constraint_count
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'content_masters'
        AND constraint_type = 'FOREIGN KEY';
        
        IF constraint_count > 0 THEN
            ALTER TABLE content_masters 
            DROP CONSTRAINT IF EXISTS content_masters_tenant_id_fkey;
            RAISE NOTICE 'content_masters 외래키 제약조건 제거 완료';
        END IF;
        
        -- 테이블 제거 (인덱스는 자동으로 삭제됨)
        DROP TABLE IF EXISTS content_masters CASCADE;
        RAISE NOTICE 'content_masters 테이블 제거 완료';
    END IF;
END $$;

-- ============================================
-- Part 3: student_daily_schedule 테이블 제거
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    policy_count INTEGER;
    constraint_count INTEGER;
    policy_record RECORD;
BEGIN
    -- 테이블 존재 여부 확인
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_daily_schedule'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE 'student_daily_schedule 테이블이 존재하지 않습니다. 건너뜁니다.';
    ELSE
        -- RLS 정책 삭제 (여러 개 존재)
        FOR policy_record IN (
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'student_daily_schedule'
        ) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON student_daily_schedule', policy_record.policyname);
            RAISE NOTICE 'RLS 정책 제거: %', policy_record.policyname;
        END LOOP;
        
        -- 외래키 제약조건 확인 및 제거
        SELECT COUNT(*) INTO constraint_count
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'student_daily_schedule'
        AND constraint_type = 'FOREIGN KEY';
        
        IF constraint_count > 0 THEN
            ALTER TABLE student_daily_schedule 
            DROP CONSTRAINT IF EXISTS student_daily_schedule_student_id_fkey,
            DROP CONSTRAINT IF EXISTS student_daily_schedule_tenant_id_fkey;
            RAISE NOTICE 'student_daily_schedule 외래키 제약조건 제거 완료';
        END IF;
        
        -- 테이블 제거 (인덱스는 자동으로 삭제됨)
        DROP TABLE IF EXISTS student_daily_schedule CASCADE;
        RAISE NOTICE 'student_daily_schedule 테이블 제거 완료';
    END IF;
END $$;

-- ============================================
-- Part 4: 완료 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '레거시 테이블 제거 완료';
    RAISE NOTICE '제거된 테이블:';
    RAISE NOTICE '  - content_master_details';
    RAISE NOTICE '  - content_masters';
    RAISE NOTICE '  - student_daily_schedule';
    RAISE NOTICE '========================================';
END $$;

