-- invitations.student_id FK를 ON UPDATE CASCADE로 변경
-- transfer_student_identity RPC가 students.id를 변경할 때
-- invitations.student_id도 자동으로 업데이트되도록 함
ALTER TABLE invitations
  DROP CONSTRAINT IF EXISTS invitations_student_id_fkey;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
