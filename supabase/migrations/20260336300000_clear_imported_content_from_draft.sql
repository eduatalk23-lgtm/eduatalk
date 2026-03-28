-- ============================================
-- 임포트 시 content(컨설턴트 가안)에 복사된 데이터 정리
-- imported_content와 동일한 content는 컨설턴트가 직접 작성한 것이 아니므로 빈 문자열로 초기화
-- ============================================

-- 세특
UPDATE public.student_record_seteks
SET content = ''
WHERE imported_content IS NOT NULL
  AND content IS NOT NULL
  AND content = imported_content;

-- 창체
UPDATE public.student_record_changche
SET content = ''
WHERE imported_content IS NOT NULL
  AND content IS NOT NULL
  AND content = imported_content;

-- 행특
UPDATE public.student_record_haengteuk
SET content = ''
WHERE imported_content IS NOT NULL
  AND content IS NOT NULL
  AND content = imported_content;

-- 개인세특
UPDATE public.student_record_personal_seteks
SET content = ''
WHERE imported_content IS NOT NULL
  AND content IS NOT NULL
  AND content = imported_content;
