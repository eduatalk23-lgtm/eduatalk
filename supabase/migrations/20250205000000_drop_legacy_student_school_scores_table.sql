-- ============================================
-- 레거시 테이블 삭제 마이그레이션
-- ============================================
-- 
-- Phase 5 작업: student_school_scores 테이블 삭제
-- 
-- ⚠️ 주의: 이 마이그레이션은 실제로 실행하기 전에 다음을 확인해야 합니다:
-- 1. 모든 데이터가 student_internal_scores로 마이그레이션되었는지 확인
-- 2. 백업이 완료되었는지 확인
-- 3. 애플리케이션 코드에서 student_school_scores 참조가 완전히 제거되었는지 확인
--
-- 실행 전 확인 사항:
-- - /admin/migration-status 페이지에서 데이터 일치 확인
-- - 코드베이스에서 student_school_scores 참조 검색
--
-- ============================================
-- 1. 테이블 존재 여부 확인
-- ============================================

DO $$
BEGIN
    -- 테이블이 존재하지 않으면 마이그레이션 종료
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_school_scores'
    ) THEN
        RAISE NOTICE 'student_school_scores 테이블이 존재하지 않습니다. 마이그레이션을 건너뜁니다.';
        RETURN;
    END IF;
END $$;

-- ============================================
-- 2. 백업 테이블 생성 (안전장치)
-- ============================================

-- 백업 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS student_school_scores_backup_20250205 AS 
SELECT * FROM student_school_scores WHERE false; -- 스키마만 복사

-- 기존 데이터 백업 (데이터가 있는 경우)
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    -- 데이터 개수 확인
    SELECT COUNT(*) INTO row_count FROM student_school_scores;
    
    IF row_count > 0 THEN
        -- 백업 테이블에 데이터 복사 (중복 방지)
        INSERT INTO student_school_scores_backup_20250205 
        SELECT * FROM student_school_scores 
        WHERE NOT EXISTS (
            SELECT 1 FROM student_school_scores_backup_20250205 
            WHERE student_school_scores_backup_20250205.id = student_school_scores.id
        );
        
        RAISE NOTICE 'student_school_scores 테이블에서 % 개의 레코드를 백업했습니다.', row_count;
    ELSE
        RAISE NOTICE 'student_school_scores 테이블에 데이터가 없습니다.';
    END IF;
END $$;

-- ============================================
-- 3. 외래 키 제약 조건 확인 및 제거
-- ============================================

-- 외래 키 제약 조건이 있는지 확인하고 제거
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'student_school_scores'
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE student_school_scores DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        RAISE NOTICE '외래 키 제약 조건 제거: %', r.constraint_name;
    END LOOP;
END $$;

-- ============================================
-- 4. 테이블 제거
-- ============================================

-- 테이블 제거 (CASCADE로 모든 의존성 제거)
DROP TABLE IF EXISTS student_school_scores CASCADE;

-- ============================================
-- 5. 코멘트 추가
-- ============================================

COMMENT ON TABLE student_school_scores_backup_20250205 IS 
    '레거시 student_school_scores 테이블 백업 (2025-02-05). 
     모든 데이터는 student_internal_scores로 마이그레이션되었습니다.
     안전 확인 후 삭제 가능.';

-- ============================================
-- 6. 완료 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '레거시 student_school_scores 테이블이 성공적으로 제거되었습니다.';
    RAISE NOTICE '백업 테이블: student_school_scores_backup_20250205';
END $$;

