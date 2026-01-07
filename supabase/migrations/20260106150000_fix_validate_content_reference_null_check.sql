-- Fix validate_content_reference trigger to allow NULL content_id
-- When creating plans without master content, content_id can be NULL
-- and only flexible_content_id is used

CREATE OR REPLACE FUNCTION public.validate_content_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- content_id가 NULL이면 검증 건너뛰기 (flexible_content_id만 사용하는 경우)
    IF NEW.content_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- content_type에 따라 해당 테이블에 content_id가 존재하는지 확인
    IF NEW.content_type = 'book' THEN
        IF NOT EXISTS (SELECT 1 FROM books WHERE id = NEW.content_id) THEN
            RAISE EXCEPTION 'Referenced book (%) does not exist in books or master_books', NEW.content_id;
        END IF;
    ELSIF NEW.content_type = 'lecture' THEN
        IF NOT EXISTS (SELECT 1 FROM lectures WHERE id = NEW.content_id) THEN
            RAISE EXCEPTION 'Referenced lecture (%) does not exist', NEW.content_id;
        END IF;
    ELSIF NEW.content_type = 'custom' THEN
        IF NOT EXISTS (SELECT 1 FROM student_custom_contents WHERE id = NEW.content_id) THEN
            RAISE EXCEPTION 'Referenced custom content (%) does not exist', NEW.content_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_content_reference() IS
'Validates that content_id references an existing record in the appropriate content table.
Uses SECURITY DEFINER to bypass RLS so admins can create plans for students.
Allows NULL content_id for plans using only flexible_content_id.';
