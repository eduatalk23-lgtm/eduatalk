-- ============================================================
-- S9: 세특/창체/행특 임포트 원자적 배치 upsert RPC
--
-- 세특/창체/행특 3종을 단일 트랜잭션으로 upsert.
-- 하나라도 실패하면 전체 롤백.
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_record_batch(
  p_seteks   jsonb DEFAULT '[]'::jsonb,
  p_changches jsonb DEFAULT '[]'::jsonb,
  p_haengteuk jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setek   jsonb;
  v_changche jsonb;
  v_haengteuk jsonb;
  v_id      uuid;
  v_setek_ids   uuid[] := '{}';
  v_changche_ids uuid[] := '{}';
  v_haengteuk_ids uuid[] := '{}';
BEGIN
  -- ── 세특 upsert ──
  FOR v_setek IN SELECT * FROM jsonb_array_elements(p_seteks)
  LOOP
    INSERT INTO student_record_seteks (
      tenant_id, student_id, school_year, grade, semester, subject_id,
      imported_content, imported_at, content, deleted_at
    ) VALUES (
      (v_setek->>'tenant_id')::uuid,
      (v_setek->>'student_id')::uuid,
      (v_setek->>'school_year')::int,
      (v_setek->>'grade')::int,
      (v_setek->>'semester')::int,
      (v_setek->>'subject_id')::uuid,
      v_setek->>'imported_content',
      COALESCE((v_setek->>'imported_at')::timestamptz, now()),
      CASE WHEN v_setek->>'content' IS NOT NULL THEN v_setek->>'content' ELSE NULL END,
      NULL  -- 복원 (soft delete 해제)
    )
    ON CONFLICT (tenant_id, student_id, school_year, grade, semester, subject_id)
    DO UPDATE SET
      imported_content = EXCLUDED.imported_content,
      imported_at = EXCLUDED.imported_at,
      deleted_at = NULL,
      updated_at = now()
    RETURNING id INTO v_id;

    v_setek_ids := array_append(v_setek_ids, v_id);
  END LOOP;

  -- ── 창체 upsert ──
  FOR v_changche IN SELECT * FROM jsonb_array_elements(p_changches)
  LOOP
    INSERT INTO student_record_changche (
      tenant_id, student_id, school_year, grade, activity_type,
      imported_content, imported_at, content, hours
    ) VALUES (
      (v_changche->>'tenant_id')::uuid,
      (v_changche->>'student_id')::uuid,
      (v_changche->>'school_year')::int,
      (v_changche->>'grade')::int,
      v_changche->>'activity_type',
      v_changche->>'imported_content',
      COALESCE((v_changche->>'imported_at')::timestamptz, now()),
      CASE WHEN v_changche->>'content' IS NOT NULL THEN v_changche->>'content' ELSE NULL END,
      (v_changche->>'hours')::int
    )
    ON CONFLICT (tenant_id, student_id, school_year, grade, activity_type)
    DO UPDATE SET
      imported_content = EXCLUDED.imported_content,
      imported_at = EXCLUDED.imported_at,
      hours = COALESCE(EXCLUDED.hours, student_record_changche.hours),
      updated_at = now()
    RETURNING id INTO v_id;

    v_changche_ids := array_append(v_changche_ids, v_id);
  END LOOP;

  -- ── 행특 upsert ──
  FOR v_haengteuk IN SELECT * FROM jsonb_array_elements(p_haengteuk)
  LOOP
    INSERT INTO student_record_haengteuk (
      tenant_id, student_id, school_year, grade,
      imported_content, imported_at, content
    ) VALUES (
      (v_haengteuk->>'tenant_id')::uuid,
      (v_haengteuk->>'student_id')::uuid,
      (v_haengteuk->>'school_year')::int,
      (v_haengteuk->>'grade')::int,
      v_haengteuk->>'imported_content',
      COALESCE((v_haengteuk->>'imported_at')::timestamptz, now()),
      CASE WHEN v_haengteuk->>'content' IS NOT NULL THEN v_haengteuk->>'content' ELSE NULL END
    )
    ON CONFLICT (tenant_id, student_id, school_year, grade)
    DO UPDATE SET
      imported_content = EXCLUDED.imported_content,
      imported_at = EXCLUDED.imported_at,
      updated_at = now()
    RETURNING id INTO v_id;

    v_haengteuk_ids := array_append(v_haengteuk_ids, v_id);
  END LOOP;

  RETURN jsonb_build_object(
    'setek_ids', to_jsonb(v_setek_ids),
    'changche_ids', to_jsonb(v_changche_ids),
    'haengteuk_ids', to_jsonb(v_haengteuk_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.import_record_batch IS 'S9: 세특/창체/행특 3종 원자적 배치 upsert — 하나라도 실패 시 전체 롤백';
