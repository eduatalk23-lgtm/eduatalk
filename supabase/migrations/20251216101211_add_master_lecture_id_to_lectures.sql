-- lectures 테이블에 master_lecture_id 컬럼 추가
-- master_content_id를 master_lecture_id로 변경하는 마이그레이션

-- ============================================
-- 1단계: master_lecture_id 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- master_lecture_id 컬럼이 존재하지 않는 경우에만 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'lectures' 
      AND column_name = 'master_lecture_id'
  ) THEN
    ALTER TABLE public.lectures
      ADD COLUMN master_lecture_id uuid REFERENCES public.master_lectures(id) ON DELETE SET NULL;
    
    -- 인덱스 추가
    CREATE INDEX IF NOT EXISTS idx_lectures_master_lecture_id 
      ON public.lectures(master_lecture_id) 
      WHERE master_lecture_id IS NOT NULL;
    
    -- 코멘트 추가
    COMMENT ON COLUMN public.lectures.master_lecture_id IS '마스터 강의 ID (FK to master_lectures)';
  END IF;
END $$;

-- ============================================
-- 2단계: 기존 master_content_id 데이터 마이그레이션 (있는 경우)
-- ============================================

DO $$
BEGIN
  -- master_content_id 컬럼이 존재하고 master_lecture_id가 NULL인 경우에만 마이그레이션
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'lectures' 
      AND column_name = 'master_content_id'
  ) THEN
    -- master_content_id의 값이 master_lectures 테이블에 존재하는 경우에만 복사
    UPDATE public.lectures l
    SET master_lecture_id = l.master_content_id
    WHERE l.master_content_id IS NOT NULL
      AND l.master_lecture_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.master_lectures ml 
        WHERE ml.id = l.master_content_id
      );
    
    RAISE NOTICE '마이그레이션 완료: % 개의 레코드가 업데이트되었습니다.', 
      (SELECT COUNT(*) FROM public.lectures WHERE master_lecture_id IS NOT NULL);
  END IF;
END $$;

