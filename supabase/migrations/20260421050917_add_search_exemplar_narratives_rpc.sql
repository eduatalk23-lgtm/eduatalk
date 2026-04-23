-- Drift 역흡수 — 원격 DB 에는 적용되어 있으나 로컬 migration 파일이 없던 함수를
-- production schema dump 로부터 복원한다.
--
-- 원격 적용 시각: 2026-04-21 05:09:17 UTC (supabase_migrations.schema_migrations).
-- 이 파일의 version 을 원격 entry 와 동일하게 맞춰, 향후 `supabase db push` 시
-- 중복 적용되지 않도록 한다.
--
-- 용도: exemplar_narrative_embeddings 에 대해 query_embedding 벡터 유사도 기반
-- 상위 N 건을 반환. source_table/university/subject/grade 필터 지원.
-- 참조: lib/domains/exemplar/CLAUDE.md.

CREATE OR REPLACE FUNCTION public.search_exemplar_narratives(
  query_embedding vector,
  source_table_filter text DEFAULT NULL::text,
  university_filter text DEFAULT NULL::text,
  subject_filter text DEFAULT NULL::text,
  grade_filter integer DEFAULT NULL::integer,
  match_count integer DEFAULT 10,
  similarity_threshold double precision DEFAULT 0.5
)
RETURNS TABLE(
  embedding_id uuid,
  exemplar_id uuid,
  source_table text,
  source_id uuid,
  content text,
  university_name text,
  department text,
  admission_year integer,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    ene.id                     AS embedding_id,
    ene.exemplar_id,
    ene.source_table,
    ene.source_id,
    ene.content_preview        AS content,
    adm.university_name,
    adm.department,
    adm.admission_year,
    1 - (ene.embedding <=> query_embedding) AS similarity
  FROM public.exemplar_narrative_embeddings ene
  LEFT JOIN LATERAL (
    SELECT ea.university_name, ea.department, ea.admission_year
    FROM public.exemplar_admissions ea
    WHERE ea.exemplar_id = ene.exemplar_id
    ORDER BY ea.is_primary DESC, ea.admission_year DESC
    LIMIT 1
  ) adm ON true
  WHERE
    1 - (ene.embedding <=> query_embedding) >= similarity_threshold
    AND (source_table_filter IS NULL OR ene.source_table = source_table_filter)
    AND (university_filter IS NULL OR adm.university_name ILIKE '%' || university_filter || '%')
    AND (subject_filter IS NULL OR ene.content_preview ILIKE '%' || subject_filter || '%')
    AND (grade_filter IS NULL OR EXISTS (
      SELECT 1 FROM public.exemplar_seteks es
      WHERE es.id = ene.source_id
        AND es.grade = grade_filter
        AND ene.source_table = 'exemplar_seteks'
      UNION ALL
      SELECT 1 FROM public.exemplar_creative_activities eca
      WHERE eca.id = ene.source_id
        AND eca.grade = grade_filter
        AND ene.source_table = 'exemplar_creative_activities'
      UNION ALL
      SELECT 1 FROM public.exemplar_haengteuk eht
      WHERE eht.id = ene.source_id
        AND eht.grade = grade_filter
        AND ene.source_table = 'exemplar_haengteuk'
    ))
  ORDER BY ene.embedding <=> query_embedding
  LIMIT match_count;
$function$;

-- 기본 EXECUTE 권한 (원격 상태 복제)
GRANT EXECUTE ON FUNCTION public.search_exemplar_narratives(
  vector, text, text, text, integer, integer, double precision
) TO authenticated, anon, service_role;
