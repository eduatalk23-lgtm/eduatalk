-- perf(index): add missing FK indexes to prevent sequential scans on DELETE cascade
--
-- Problem: 23 foreign key columns lack indexes. When a referenced row is deleted,
-- PostgreSQL must seq-scan the referencing table to check for dependent rows.
-- This becomes costly as tables grow.
--
-- All indexes use IF NOT EXISTS for idempotency.

-- ============================================================
-- High priority (tables with data)
-- ============================================================

-- school_info (5,909 rows) → district_office
CREATE INDEX IF NOT EXISTS idx_school_info_district_id
  ON school_info (district_id);

-- master_books (2,278 rows) → publishers
CREATE INDEX IF NOT EXISTS idx_master_books_publisher_id
  ON master_books (publisher_id);

-- chat_messages (388 rows) → chat_messages (self-ref for reply threads)
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id
  ON chat_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- district_office (194 rows) → edu_office
CREATE INDEX IF NOT EXISTS idx_district_office_office_id
  ON district_office (office_id);

-- ============================================================
-- Medium priority (small but will grow)
-- ============================================================

-- calendars → student_block_sets
CREATE INDEX IF NOT EXISTS idx_calendars_block_set_id
  ON calendars (block_set_id) WHERE block_set_id IS NOT NULL;

-- student_consulting_notes → enrollments
CREATE INDEX IF NOT EXISTS idx_student_consulting_notes_enrollment_id
  ON student_consulting_notes (enrollment_id) WHERE enrollment_id IS NOT NULL;

-- student_terms → curriculum_revisions
CREATE INDEX IF NOT EXISTS idx_student_terms_curriculum_revision_id
  ON student_terms (curriculum_revision_id);

-- payment_links → students
CREATE INDEX IF NOT EXISTS idx_payment_links_student_id
  ON payment_links (student_id);

-- student_internal_scores (4 FK columns)
CREATE INDEX IF NOT EXISTS idx_student_internal_scores_subject_type_id
  ON student_internal_scores (subject_type_id);

CREATE INDEX IF NOT EXISTS idx_student_internal_scores_subject_group_id
  ON student_internal_scores (subject_group_id);

CREATE INDEX IF NOT EXISTS idx_student_internal_scores_student_term_id
  ON student_internal_scores (student_term_id);

CREATE INDEX IF NOT EXISTS idx_student_internal_scores_curriculum_revision_id
  ON student_internal_scores (curriculum_revision_id);

-- student_mock_scores (2 FK columns)
CREATE INDEX IF NOT EXISTS idx_student_mock_scores_student_term_id
  ON student_mock_scores (student_term_id);

CREATE INDEX IF NOT EXISTS idx_student_mock_scores_subject_group_id
  ON student_mock_scores (subject_group_id);

-- ============================================================
-- Lower priority (0 rows now, indexed for future growth)
-- ============================================================

-- scheduled_messages → chat_messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_sent_message_id
  ON scheduled_messages (sent_message_id) WHERE sent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_reply_to_id
  ON scheduled_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- chat_reports → chat_messages, admin_users
CREATE INDEX IF NOT EXISTS idx_chat_reports_reported_message_id
  ON chat_reports (reported_message_id);

CREATE INDEX IF NOT EXISTS idx_chat_reports_reviewed_by
  ON chat_reports (reviewed_by) WHERE reviewed_by IS NOT NULL;

-- consultation_event_data → enrollments
CREATE INDEX IF NOT EXISTS idx_consultation_event_data_enrollment_id
  ON consultation_event_data (enrollment_id) WHERE enrollment_id IS NOT NULL;

-- content_concepts → subjects
CREATE INDEX IF NOT EXISTS idx_content_concepts_subject_id
  ON content_concepts (subject_id);

-- google_calendar_sync_queue → admin_users
CREATE INDEX IF NOT EXISTS idx_google_cal_sync_queue_admin_user_id
  ON google_calendar_sync_queue (admin_user_id);

-- plan_creation_history → plan_creation_templates
CREATE INDEX IF NOT EXISTS idx_plan_creation_history_template_id
  ON plan_creation_history (template_id) WHERE template_id IS NOT NULL;

-- push_dlq → push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_dlq_subscription_id
  ON push_dlq (subscription_id);

-- ============================================================
-- Autovacuum tuning for small tables with high dead tuple ratios
-- Default threshold=50 never triggers for tables <50 rows
-- ============================================================
ALTER TABLE students SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE flexible_contents SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE plan_groups SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE plan_events SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE lectures SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE books SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE payment_records SET (autovacuum_vacuum_threshold = 10, autovacuum_vacuum_scale_factor = 0.1);
