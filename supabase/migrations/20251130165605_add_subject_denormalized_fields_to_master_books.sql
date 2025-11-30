-- Add denormalized subject fields to master_books table
-- This follows the same pattern as publisher_name denormalization

-- Add new columns
ALTER TABLE master_books
ADD COLUMN subject_group_id uuid REFERENCES subject_groups(id) ON DELETE SET NULL,
ADD COLUMN subject_category text,
ADD COLUMN subject text;

-- Create index on subject_group_id for better query performance
CREATE INDEX idx_master_books_subject_group_id ON master_books(subject_group_id);

-- Update existing data: populate subject_group_id, subject_category, and subject
-- from the subjects and subject_groups tables via subject_id
UPDATE master_books mb
SET 
  subject_group_id = sg.id,
  subject_category = sg.name,
  subject = s.name
FROM subjects s
JOIN subject_groups sg ON s.subject_group_id = sg.id
WHERE mb.subject_id = s.id
  AND mb.subject_id IS NOT NULL;

-- Add comment to explain the denormalization
COMMENT ON COLUMN master_books.subject_group_id IS 'FK to subject_groups, denormalized for performance';
COMMENT ON COLUMN master_books.subject_category IS 'Denormalized subject group name (교과), same as subject_groups.name';
COMMENT ON COLUMN master_books.subject IS 'Denormalized subject name (과목), same as subjects.name';

