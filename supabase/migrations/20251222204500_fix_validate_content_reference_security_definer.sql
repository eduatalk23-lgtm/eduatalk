-- Fix validate_content_reference trigger to bypass RLS
-- The trigger needs SECURITY DEFINER to validate content existence
-- regardless of who is inserting the student_plan record
--
-- Problem: When admin creates a plan for a student, the trigger couldn't
-- see the student's lectures/books due to RLS policies (auth.uid() = student_id)

CREATE OR REPLACE FUNCTION public.validate_content_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- content_type에 따라 해당 테이블에 content_id가 존재하는지 확인
    IF NEW.content_type = 'book' THEN
        IF NOT EXISTS (SELECT 1 FROM books WHERE id = NEW.content_id) THEN
            RAISE EXCEPTION 'Referenced book (%) does not exist', NEW.content_id;
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
Uses SECURITY DEFINER to bypass RLS so admins can create plans for students.';
