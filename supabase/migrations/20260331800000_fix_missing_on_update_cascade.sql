-- =============================================================================
-- students.id 참조 FK에 ON UPDATE CASCADE 누락분 보강
--
-- transfer_student_identity RPC는 user_profiles.id → students.id CASCADE로
-- 학생 ID를 변경한다. 이후 추가된 테이블들이 ON UPDATE CASCADE를 빠뜨려
-- RPC 호출 시 23503 (foreign_key_violation) 발생.
--
-- 대상: calendar_memos + student_record_* 20개 테이블
-- =============================================================================

-- calendar_memos
ALTER TABLE public.calendar_memos
  DROP CONSTRAINT IF EXISTS calendar_memos_student_id_fkey,
  ADD CONSTRAINT calendar_memos_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_activity_tags
ALTER TABLE public.student_record_activity_tags
  DROP CONSTRAINT IF EXISTS student_record_activity_tags_student_id_fkey,
  ADD CONSTRAINT student_record_activity_tags_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_applications
ALTER TABLE public.student_record_applications
  DROP CONSTRAINT IF EXISTS student_record_applications_student_id_fkey,
  ADD CONSTRAINT student_record_applications_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_attendance
ALTER TABLE public.student_record_attendance
  DROP CONSTRAINT IF EXISTS student_record_attendance_student_id_fkey,
  ADD CONSTRAINT student_record_attendance_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_awards
ALTER TABLE public.student_record_awards
  DROP CONSTRAINT IF EXISTS student_record_awards_student_id_fkey,
  ADD CONSTRAINT student_record_awards_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_changche
ALTER TABLE public.student_record_changche
  DROP CONSTRAINT IF EXISTS student_record_changche_student_id_fkey,
  ADD CONSTRAINT student_record_changche_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_competency_scores
ALTER TABLE public.student_record_competency_scores
  DROP CONSTRAINT IF EXISTS student_record_competency_scores_student_id_fkey,
  ADD CONSTRAINT student_record_competency_scores_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_diagnosis
ALTER TABLE public.student_record_diagnosis
  DROP CONSTRAINT IF EXISTS student_record_diagnosis_student_id_fkey,
  ADD CONSTRAINT student_record_diagnosis_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_disciplinary
ALTER TABLE public.student_record_disciplinary
  DROP CONSTRAINT IF EXISTS student_record_disciplinary_student_id_fkey,
  ADD CONSTRAINT student_record_disciplinary_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_haengteuk
ALTER TABLE public.student_record_haengteuk
  DROP CONSTRAINT IF EXISTS student_record_haengteuk_student_id_fkey,
  ADD CONSTRAINT student_record_haengteuk_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_interview_questions
ALTER TABLE public.student_record_interview_questions
  DROP CONSTRAINT IF EXISTS student_record_interview_questions_student_id_fkey,
  ADD CONSTRAINT student_record_interview_questions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_min_score_simulations
ALTER TABLE public.student_record_min_score_simulations
  DROP CONSTRAINT IF EXISTS student_record_min_score_simulations_student_id_fkey,
  ADD CONSTRAINT student_record_min_score_simulations_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_min_score_targets
ALTER TABLE public.student_record_min_score_targets
  DROP CONSTRAINT IF EXISTS student_record_min_score_targets_student_id_fkey,
  ADD CONSTRAINT student_record_min_score_targets_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_personal_seteks
ALTER TABLE public.student_record_personal_seteks
  DROP CONSTRAINT IF EXISTS student_record_personal_seteks_student_id_fkey,
  ADD CONSTRAINT student_record_personal_seteks_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_reading
ALTER TABLE public.student_record_reading
  DROP CONSTRAINT IF EXISTS student_record_reading_student_id_fkey,
  ADD CONSTRAINT student_record_reading_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_roadmap_items
ALTER TABLE public.student_record_roadmap_items
  DROP CONSTRAINT IF EXISTS student_record_roadmap_items_student_id_fkey,
  ADD CONSTRAINT student_record_roadmap_items_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_seteks
ALTER TABLE public.student_record_seteks
  DROP CONSTRAINT IF EXISTS student_record_seteks_student_id_fkey,
  ADD CONSTRAINT student_record_seteks_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_storylines
ALTER TABLE public.student_record_storylines
  DROP CONSTRAINT IF EXISTS student_record_storylines_student_id_fkey,
  ADD CONSTRAINT student_record_storylines_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_strategies
ALTER TABLE public.student_record_strategies
  DROP CONSTRAINT IF EXISTS student_record_strategies_student_id_fkey,
  ADD CONSTRAINT student_record_strategies_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- student_record_volunteer
ALTER TABLE public.student_record_volunteer
  DROP CONSTRAINT IF EXISTS student_record_volunteer_student_id_fkey,
  ADD CONSTRAINT student_record_volunteer_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
