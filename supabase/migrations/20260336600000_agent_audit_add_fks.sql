-- ============================================
-- agent_audit_logs FK 보완
-- student_id → students(id) ON UPDATE/DELETE CASCADE
-- ============================================

ALTER TABLE agent_audit_logs
  ADD CONSTRAINT fk_agent_audit_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
