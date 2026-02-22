-- ============================================
-- Phase 2: 기존 데이터 → 캘린더 스키마 마이그레이션
-- ============================================
--
-- 멱등성(Idempotent): WHERE NOT EXISTS로 중복 실행 방지
-- 소스 추적: metadata.migrated_from에 원본 테이블/ID 기록
--
-- 마이그레이션 순서:
--   Step 1. planners → calendars (Primary Calendar 생성)
--   Step 2. student_plan → calendar_events + event_study_data
--   Step 3. ad_hoc_plans → calendar_events + event_study_data
--   Step 4. student_non_study_time → calendar_events
--   Step 5. student_block_sets → availability_schedules
--   Step 6. student_block_schedule + student_non_study_time(학원) → availability_windows
--

-- =============================
-- Step 1: planners → calendars
-- =============================
-- 모든 활성 플래너에 대해 Primary Calendar 생성.
-- 삭제된 플래너는 마이그레이션하지 않음 (필요 시 별도 처리).

INSERT INTO calendars (
  id, tenant_id, owner_id, owner_type, planner_id,
  summary, calendar_type, is_primary, source_type,
  created_at, updated_at
)
SELECT
  uuid_generate_v4(),
  p.tenant_id,
  p.student_id,            -- owner = student
  'student',
  p.id,                    -- planner_id
  p.name,                  -- summary = planner name
  'study',
  true,                    -- is_primary
  'local',
  NOW(),
  NOW()
FROM planners p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM calendars c
    WHERE c.planner_id = p.id AND c.deleted_at IS NULL
  );


-- =============================
-- Step 2: student_plan → calendar_events + event_study_data
-- =============================
-- student_plan 경로: student_plan.plan_group_id → plan_groups.planner_id → calendars.planner_id
-- 상태 매핑:
--   student_plan.status → calendar_events.status
--     pending/in_progress/null → confirmed
--     completed → completed
--     skipped → cancelled
--     postponed → tentative
--   student_plan.status → event_study_data.completion_status
--     pending/postponed/null → pending
--     in_progress → in_progress
--     completed → completed
--     skipped → skipped

-- Step 2a: calendar_events 생성
INSERT INTO calendar_events (
  id, calendar_id, tenant_id, student_id,
  title, description, location, event_type, event_subtype,
  start_at, end_at, timezone, is_all_day,
  status, transparency,
  plan_group_id, container_type, order_index,
  color, icon, priority, tags,
  source, sequence, metadata,
  created_by, created_at, updated_at, deleted_at
)
SELECT
  sp.id,                   -- 원본 ID 보존 (FK 추적 용이)
  cal.id,                  -- calendar_id
  sp.tenant_id,
  sp.student_id,

  -- title: custom_title > content_title > '제목 없음'
  COALESCE(sp.custom_title, sp.content_title, '제목 없음'),
  sp.description,
  NULL,                    -- location
  'study',                 -- event_type
  sp.content_type,         -- event_subtype (free, lecture, book 등)

  -- 시간: plan_date + start_time → TIMESTAMPTZ
  CASE WHEN sp.start_time IS NOT NULL
    THEN (sp.plan_date + sp.start_time) AT TIME ZONE 'Asia/Seoul'
    ELSE NULL
  END,
  CASE WHEN sp.end_time IS NOT NULL
    THEN (sp.plan_date + sp.end_time) AT TIME ZONE 'Asia/Seoul'
    ELSE NULL
  END,
  'Asia/Seoul',
  false,                   -- is_all_day

  -- status 매핑
  CASE sp.status
    WHEN 'completed' THEN 'completed'
    WHEN 'skipped' THEN 'cancelled'
    WHEN 'postponed' THEN 'tentative'
    ELSE 'confirmed'
  END,
  'opaque',                -- transparency

  sp.plan_group_id,
  COALESCE(sp.container_type, 'daily'),
  COALESCE(sp.order_index, 0),

  sp.color,
  sp.icon,
  COALESCE(sp.priority, 0),
  COALESCE(sp.tags, '{}'),

  'migration',             -- source
  COALESCE(sp.sequence, 0),
  jsonb_build_object(
    'migrated_from', jsonb_build_object(
      'table', 'student_plan',
      'id', sp.id,
      'migrated_at', NOW()::TEXT
    )
  ),

  sp.created_by,
  COALESCE(sp.created_at, NOW()),
  COALESCE(sp.updated_at, NOW()),
  sp.deleted_at
FROM student_plan sp
JOIN plan_groups pg ON pg.id = sp.plan_group_id
JOIN calendars cal ON cal.planner_id = pg.planner_id AND cal.is_primary = true AND cal.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_events ce WHERE ce.id = sp.id
);

-- Step 2b: event_study_data 생성
INSERT INTO event_study_data (
  id, event_id,
  content_type, content_id, master_content_id, flexible_content_id,
  content_title, subject_name, subject_category,
  planned_start_page, planned_end_page, chapter,
  origin_plan_item_id,
  completion_status, started_at, completed_at,
  estimated_minutes, actual_minutes,
  paused_at, paused_duration_seconds, pause_count,
  completed_amount, progress,
  simple_completion, simple_completed_at,
  memo
)
SELECT
  uuid_generate_v4(),
  sp.id,                   -- event_id = student_plan.id (Step 2a에서 보존한 ID)

  -- content 매핑
  CASE sp.content_type
    WHEN 'book' THEN 'book'
    WHEN 'lecture' THEN 'lecture'
    WHEN 'free' THEN 'custom'
    ELSE 'custom'
  END,
  sp.content_id,
  NULL,                    -- master_content_id (student_plan에는 없음)
  sp.flexible_content_id,
  COALESCE(sp.content_title, sp.custom_title),
  sp.content_subject,
  sp.content_subject_category,
  sp.planned_start_page_or_time,
  sp.planned_end_page_or_time,
  sp.chapter,
  sp.origin_plan_item_id,

  -- completion_status 매핑
  CASE sp.status
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'skipped' THEN 'skipped'
    ELSE 'pending'
  END,
  sp.started_at,
  sp.completed_at,
  sp.estimated_minutes,
  sp.actual_minutes,
  sp.paused_at,
  COALESCE(sp.paused_duration_seconds, 0),
  COALESCE(sp.pause_count, 0),
  sp.completed_amount,
  sp.progress,
  COALESCE(sp.simple_completion, false),
  sp.simple_completed_at,
  sp.memo
FROM student_plan sp
-- calendar_events가 존재하는 것만 (Step 2a에서 생성됨)
WHERE EXISTS (
  SELECT 1 FROM calendar_events ce WHERE ce.id = sp.id
)
AND NOT EXISTS (
  SELECT 1 FROM event_study_data esd WHERE esd.event_id = sp.id
);


-- =============================
-- Step 3: ad_hoc_plans → calendar_events + event_study_data
-- =============================
-- ad_hoc_plans는 현재 0건이지만 향후 데이터를 위해 마이그레이션 로직 포함.

INSERT INTO calendar_events (
  id, calendar_id, tenant_id, student_id,
  title, description, event_type,
  start_at, end_at, timezone, is_all_day,
  status, transparency,
  plan_group_id, container_type, order_index,
  color, icon, priority, tags,
  source, metadata,
  created_by, created_at, updated_at
)
SELECT
  ah.id,
  cal.id,
  ah.tenant_id,
  ah.student_id,

  ah.title,
  ah.description,
  'custom',                -- event_type (ad_hoc → custom)

  CASE WHEN ah.start_time IS NOT NULL
    THEN (ah.plan_date + ah.start_time) AT TIME ZONE 'Asia/Seoul'
    ELSE NULL
  END,
  CASE WHEN ah.end_time IS NOT NULL
    THEN (ah.plan_date + ah.end_time) AT TIME ZONE 'Asia/Seoul'
    ELSE NULL
  END,
  'Asia/Seoul',
  false,

  CASE ah.status
    WHEN 'completed' THEN 'completed'
    WHEN 'skipped' THEN 'cancelled'
    ELSE 'confirmed'
  END,
  'opaque',

  ah.plan_group_id,
  COALESCE(ah.container_type, 'daily'),
  COALESCE(ah.order_index, 0),

  ah.color,
  ah.icon,
  COALESCE(ah.priority, 0),
  COALESCE(ah.tags, '{}'),

  'migration',
  jsonb_build_object(
    'migrated_from', jsonb_build_object(
      'table', 'ad_hoc_plans',
      'id', ah.id,
      'migrated_at', NOW()::TEXT
    )
  ),

  ah.created_by,
  COALESCE(ah.created_at, NOW()),
  COALESCE(ah.updated_at, NOW())
FROM ad_hoc_plans ah
JOIN plan_groups pg ON pg.id = ah.plan_group_id
JOIN calendars cal ON cal.planner_id = pg.planner_id AND cal.is_primary = true AND cal.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_events ce WHERE ce.id = ah.id
);

-- ad_hoc_plans → event_study_data (학습 추적만)
INSERT INTO event_study_data (
  id, event_id,
  content_type, flexible_content_id, content_title,
  completion_status, started_at, completed_at,
  estimated_minutes, actual_minutes,
  paused_at, paused_duration_seconds, pause_count,
  planned_start_page, planned_end_page,
  simple_completion, simple_completed_at
)
SELECT
  uuid_generate_v4(),
  ah.id,
  CASE ah.content_type
    WHEN 'book' THEN 'book'
    WHEN 'lecture' THEN 'lecture'
    ELSE 'custom'
  END,
  ah.flexible_content_id,
  ah.title,
  CASE ah.status
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'skipped' THEN 'skipped'
    ELSE 'pending'
  END,
  ah.started_at,
  ah.completed_at,
  ah.estimated_minutes,
  ah.actual_minutes,
  ah.paused_at,
  COALESCE(ah.paused_duration_seconds, 0),
  COALESCE(ah.pause_count, 0),
  ah.page_range_start,
  ah.page_range_end,
  COALESCE(ah.simple_completion, false),
  ah.simple_completed_at
FROM ad_hoc_plans ah
WHERE EXISTS (
  SELECT 1 FROM calendar_events ce WHERE ce.id = ah.id
)
AND NOT EXISTS (
  SELECT 1 FROM event_study_data esd WHERE esd.event_id = ah.id
);


-- =============================
-- Step 4: student_non_study_time → calendar_events
-- =============================
-- 타입 매핑:
--   '제외일' → event_type='exclusion', is_all_day=true
--   '학원' → event_type='academy'
--   나머지 (점심식사, 아침식사, 저녁식사, 수면, 이동시간, 기타) → event_type='non_study'

INSERT INTO calendar_events (
  id, calendar_id, tenant_id, student_id,
  title, event_type, event_subtype,
  start_at, end_at, start_date, end_date, timezone,
  is_all_day, status, transparency,
  source, metadata,
  created_at, updated_at
)
SELECT
  nst.id,
  cal.id,
  nst.tenant_id,
  p.student_id,

  -- title = label > type
  COALESCE(nst.label, nst.type),

  -- event_type 매핑
  CASE nst.type
    WHEN '제외일' THEN 'exclusion'
    WHEN '학원' THEN 'academy'
    ELSE 'non_study'
  END,

  -- event_subtype = 원본 한국어 타입
  nst.type,

  -- 시간: is_all_day에 따라 분기
  CASE WHEN nst.is_all_day = false AND nst.start_time IS NOT NULL
    THEN (nst.plan_date + nst.start_time) AT TIME ZONE 'Asia/Seoul'
    ELSE NULL
  END,
  CASE WHEN nst.is_all_day = false AND nst.end_time IS NOT NULL
    THEN (nst.plan_date + nst.end_time) AT TIME ZONE 'Asia/Seoul'
    ELSE NULL
  END,
  CASE WHEN nst.is_all_day = true THEN nst.plan_date ELSE NULL END,
  CASE WHEN nst.is_all_day = true THEN nst.plan_date ELSE NULL END,
  'Asia/Seoul',

  nst.is_all_day,
  'confirmed',
  CASE nst.type
    WHEN '제외일' THEN 'transparent'
    ELSE 'opaque'
  END,

  'migration',
  jsonb_build_object(
    'migrated_from', jsonb_build_object(
      'table', 'student_non_study_time',
      'id', nst.id,
      'migrated_at', NOW()::TEXT
    ),
    'group_id', nst.group_id,
    'is_template_based', nst.is_template_based
  ),

  COALESCE(nst.created_at, NOW()),
  COALESCE(nst.updated_at, NOW())
FROM student_non_study_time nst
JOIN planners p ON p.id = nst.planner_id
JOIN calendars cal ON cal.planner_id = nst.planner_id AND cal.is_primary = true AND cal.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_events ce WHERE ce.id = nst.id
);


-- =============================
-- Step 5: availability_schedules 생성 (통합)
-- =============================
-- 소스 1: student_block_sets (블록 세트 → 가용성 스케줄)
-- 소스 2: planner_academy_schedules (학원이 있는 플래너 → 기본 스케줄)
-- 두 소스를 한 번에 처리하여 플래너당 1개 기본 스케줄 보장.

-- 5a: student_block_sets에서 생성
INSERT INTO availability_schedules (
  id, tenant_id, planner_id, name, timezone, is_default, created_at, updated_at
)
SELECT
  sbs.id,                  -- 원본 ID 보존
  sbs.tenant_id,
  p.id,                    -- planner_id
  sbs.name,
  'Asia/Seoul',
  true,                    -- 기본 스케줄
  COALESCE(sbs.created_at, NOW()),
  COALESCE(sbs.updated_at, NOW())
FROM student_block_sets sbs
JOIN planners p ON p.student_id = sbs.student_id AND p.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM availability_schedules avs WHERE avs.id = sbs.id
);

-- 5b: 학원 일정이 있는 플래너 중 아직 스케줄 없는 경우 기본 스케줄 생성
-- (레거시 planner_academy_schedules → student_non_study_time type='학원'으로 전환)
INSERT INTO availability_schedules (
  id, tenant_id, planner_id, name, timezone, is_default, created_at, updated_at
)
SELECT
  uuid_generate_v4(),
  sub.tenant_id,
  sub.planner_id,
  '기본',
  'Asia/Seoul',
  true,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON (nst.planner_id) nst.tenant_id, nst.planner_id
  FROM student_non_study_time nst
  JOIN planners p ON p.id = nst.planner_id AND p.deleted_at IS NULL
  WHERE nst.type = '학원'
    AND NOT EXISTS (
      SELECT 1 FROM availability_schedules avs WHERE avs.planner_id = nst.planner_id
    )
  ORDER BY nst.planner_id
) sub;


-- =============================
-- Step 6a: student_block_schedule → availability_windows
-- =============================
-- 학습 시간 블록을 가용성 윈도우로 변환.
-- day_of_week: 기존 0=일 ~ 6=토 → ISO 1=월 ~ 7=일 변환

INSERT INTO availability_windows (
  id, schedule_id, days, start_time, end_time,
  window_type, label, source, created_at, updated_at
)
SELECT
  sb.id,
  sb.block_set_id,         -- schedule_id = block_set_id (Step 5a에서 ID 보존)
  -- day_of_week 변환: 0=일→7, 1=월→1, ..., 6=토→6
  ARRAY[CASE WHEN sb.day_of_week = 0 THEN 7 ELSE sb.day_of_week END],
  sb.start_time,
  sb.end_time,
  'study',                 -- window_type
  NULL,                    -- label
  'migration',
  COALESCE(sb.created_at, NOW()),
  NOW()
FROM student_block_schedule sb
WHERE sb.block_set_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM availability_schedules avs WHERE avs.id = sb.block_set_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM availability_windows aw WHERE aw.id = sb.id
  );


-- =============================
-- Step 6b: student_non_study_time (type='학원') → availability_windows
-- =============================
-- 학원 일정을 가용성 윈도우(academy)로 변환.
-- (레거시 planner_academy_schedules → student_non_study_time으로 전환)
-- 날짜별 레코드를 day_of_week 기준으로 유니크하게 집약.

INSERT INTO availability_windows (
  id, schedule_id, days, start_time, end_time,
  window_type, label, source,
  created_at, updated_at
)
SELECT
  nst.id,
  avs.id,                  -- 해당 플래너의 기본 스케줄
  -- plan_date에서 요일 추출 (DOW: 0=일→7, 1=월→1, ..., 6=토→6)
  ARRAY[CASE WHEN EXTRACT(DOW FROM nst.plan_date::date) = 0 THEN 7
        ELSE EXTRACT(DOW FROM nst.plan_date::date)::integer END],
  nst.start_time,
  nst.end_time,
  'academy',               -- window_type
  COALESCE(nst.label, '학원'),
  'migration',
  COALESCE(nst.created_at, NOW()),
  COALESCE(nst.created_at, NOW())
FROM (
  -- planner_id + 요일 + start_time + end_time 기준으로 첫 번째 레코드만 선택
  SELECT DISTINCT ON (planner_id, EXTRACT(DOW FROM plan_date::date), start_time, end_time)
    id, planner_id, plan_date, start_time, end_time, label, created_at
  FROM student_non_study_time
  WHERE type = '학원'
    AND start_time IS NOT NULL
    AND end_time IS NOT NULL
  ORDER BY planner_id, EXTRACT(DOW FROM plan_date::date), start_time, end_time, created_at
) nst
-- 플래너당 정확히 1개의 기본 스케줄과 JOIN (Step 5에서 보장)
JOIN LATERAL (
  SELECT id FROM availability_schedules
  WHERE planner_id = nst.planner_id AND is_default = true
  LIMIT 1
) avs ON true
WHERE NOT EXISTS (
  SELECT 1 FROM availability_windows aw WHERE aw.id = nst.id
);


-- =============================
-- 마이그레이션 결과 확인용 뷰 (임시)
-- =============================

COMMENT ON TABLE calendars IS 'Google Calendar Resource 매핑 - 캘린더 글로벌 리소스 컨테이너 [Phase 2 마이그레이션 완료]';
