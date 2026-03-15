-- perf(index): drop 25 duplicate indexes to reduce write amplification
--
-- Problem: 41 duplicate index pairs detected, causing unnecessary write overhead
-- on every INSERT/UPDATE. Each duplicate index doubles the index maintenance cost.
--
-- Approach: 3 tiers of safe removals
--   Tier 1 (13): Exact duplicate of unique constraint index (same columns, no WHERE)
--   Tier 2 (5):  Partial index (WHERE col IS NOT NULL) covered by unique constraint
--   Tier 3 (7):  Narrower partial index fully covered by broader existing index
--
-- Preserved (NOT duplicate despite same key columns):
--   - calendars: 4 partial unique indexes (enforce different owner_type business rules)
--   - calendar_events: unfinished vs rrule_time (different WHERE clauses)
--   - student_plan: incomplete_by_date vs student_date (partial vs full, different use)
--   - plan_groups: student_id vs unique_draft_unnamed (general vs constraint)
--   - study_sessions: student_id vs unique_active_session (general vs constraint)
--   - admin_users: one_owner_per_tenant vs tenant_id (constraint vs general)
--   - chat_room_members: active_room vs room_active (different WHERE clauses)
--   - event_study_data: event_id_key vs done (unique vs partial on done=false)
--   - user_presence: pkey vs active (PK vs partial on status='active')

-- ============================================================
-- TIER 1: Exact duplicates of unique constraint indexes
-- ============================================================
-- Pattern: UNIQUE constraint already creates a btree index;
-- manual index on same columns is pure waste.

-- attendance_records: unique (student_id, attendance_date) already exists
DROP INDEX IF EXISTS idx_attendance_records_student_date;

-- book_details: unique (book_id, display_order) already exists
DROP INDEX IF EXISTS idx_book_details_order;

-- camp_template_block_sets: unique (camp_template_id) already exists
DROP INDEX IF EXISTS idx_camp_template_block_sets_template_id;

-- chat_room_members: unique (room_id, user_id, user_type) already exists
DROP INDEX IF EXISTS idx_chat_room_members_room_user_type;

-- google_oauth_tokens: unique (admin_user_id) already exists
DROP INDEX IF EXISTS idx_google_oauth_tokens_admin;

-- habit_logs: unique (habit_id, log_date) already exists
DROP INDEX IF EXISTS idx_habit_logs_habit_date;

-- parent_student_links: unique (parent_id, student_id) already exists
DROP INDEX IF EXISTS idx_parent_student_links_parent;

-- payment_orders: unique (toss_order_id) already exists
DROP INDEX IF EXISTS idx_po_toss_order_id;

-- payment_links: unique (token) constraint already exists
DROP INDEX IF EXISTS idx_payment_links_token;

-- student_reminder_settings: unique (student_id) already exists
DROP INDEX IF EXISTS idx_reminder_settings_student;

-- tenant_scheduler_settings: unique (tenant_id) already exists
DROP INDEX IF EXISTS idx_tenant_scheduler_settings_tenant_id;

-- time_slots: unique (tenant_id, slot_order) already exists
DROP INDEX IF EXISTS idx_time_slots_order;

-- user_consents: unique (user_id, consent_type) already exists
DROP INDEX IF EXISTS idx_user_consents_user_id_consent_type;

-- ============================================================
-- TIER 2: Partial (WHERE col IS NOT NULL) covered by unique constraint
-- ============================================================
-- Pattern: Unique constraint btree includes all rows (including NULLs).
-- A partial index filtering IS NOT NULL is redundant for lookups.

-- books: uq_books_student_master covers (student_id, master_content_id) all rows
DROP INDEX IF EXISTS idx_books_student_master;

-- lectures: uq_lectures_student_master covers (student_id, master_lecture_id) all rows
DROP INDEX IF EXISTS idx_lectures_student_master;

-- payment_records: payment_records_toss_order_id_key covers all toss_order_id rows
DROP INDEX IF EXISTS idx_payment_records_toss_order_id;

-- plan_groups: plan_groups_camp_invitation_id_key covers all camp_invitation_id rows
DROP INDEX IF EXISTS idx_plan_groups_camp_invitation_id;

-- daily_check_ins: unique (student_id, check_date) covers DESC scans too (btree bidirectional)
DROP INDEX IF EXISTS idx_daily_check_ins_student_date;

-- ============================================================
-- TIER 3: Narrower partial index covered by broader existing index
-- ============================================================
-- Pattern: A full index on the same columns can serve any query
-- the partial index would serve (with post-scan filter).

-- admin_users: idx_admin_users_member_check (id, tenant_id) covers admin_check (same + WHERE role IN ...)
DROP INDEX IF EXISTS idx_admin_users_admin_check;

-- plan_groups: idx_plan_groups_camp_template_id (full) covers camp_template (WHERE IS NOT NULL)
DROP INDEX IF EXISTS idx_plan_groups_camp_template;

-- plan_groups: idx_plan_groups_student_status (student_id, status) covers student_content_based (same + WHERE)
DROP INDEX IF EXISTS idx_plan_groups_student_content_based;

-- plan_views: idx_plan_views_student (student_id) covers plan_views_default (same + WHERE is_default)
DROP INDEX IF EXISTS idx_plan_views_default;

-- sms_logs: idx_sms_logs_status (status) covers pending_delivery (same + WHERE)
DROP INDEX IF EXISTS idx_sms_logs_pending_delivery;

-- student_milestone_logs: btree scans both ASC/DESC; keep the DESC variant
DROP INDEX IF EXISTS idx_milestone_logs_student_date;

-- student_plan: idx_student_plan_student_date_group (full) covers null_tenant (same + WHERE)
DROP INDEX IF EXISTS idx_student_plan_student_date_group_null_tenant;

-- ============================================================
-- ANALYZE affected tables for fresh planner statistics
-- ============================================================
ANALYZE attendance_records;
ANALYZE book_details;
ANALYZE camp_template_block_sets;
ANALYZE chat_room_members;
ANALYZE google_oauth_tokens;
ANALYZE habit_logs;
ANALYZE parent_student_links;
ANALYZE payment_orders;
ANALYZE payment_links;
ANALYZE student_reminder_settings;
ANALYZE tenant_scheduler_settings;
ANALYZE time_slots;
ANALYZE user_consents;
ANALYZE books;
ANALYZE lectures;
ANALYZE payment_records;
ANALYZE plan_groups;
ANALYZE daily_check_ins;
ANALYZE admin_users;
ANALYZE plan_views;
ANALYZE sms_logs;
ANALYZE student_milestone_logs;
ANALYZE student_plan;
