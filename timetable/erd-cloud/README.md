# ERD Cloud Import 가이드

이 디렉토리는 ERD Cloud에서 데이터베이스 스키마를 Import하기 위한 SQL 파일들을 포함합니다.

## 파일 구조

PRD 문서를 기반으로 테이블을 논리적 그룹으로 나누어 여러 파일로 분리했습니다. ERD Cloud의 파싱 문제를 방지하기 위해 외래키 제약조건은 별도 파일로 분리했습니다.

### 테이블 그룹

1. **01_core_tables.sql** - 핵심 테이블 (테넌트, 사용자, 역할)
   - tenants
   - users
   - admin_users
   - students
   - parent_users
   - student_parent_links
   - student_teacher_assignments

2. **02_education_metadata.sql** - 교육 메타데이터
   - curriculum_revisions
   - subject_categories
   - subjects
   - schools

3. **03_content_tables.sql** - 콘텐츠 관련 테이블
   - master_books
   - master_lectures
   - lecture_episodes
   - student_books
   - student_lectures
   - student_custom_contents

4. **04_scores_tables.sql** - 성적 관리 테이블
   - school_scores
   - mock_scores
   - student_analysis

5. **05_plan_tables.sql** - 플랜 관련 테이블
   - plan_groups
   - student_plans
   - plan_timer_logs
   - study_sessions
   - plan_recommendations

6. **06_management_tables.sql** - 관리 기능 테이블
   - attendance_records
   - tuition_fees
   - payment_records
   - boards
   - posts
   - post_comments
   - inquiries
   - inquiry_replies
   - consulting_notes

7. **07_communication_tables.sql** - 커뮤니케이션 테이블
   - messages
   - message_attachments
   - notifications
   - notification_preferences
   - sms_logs
   - email_logs

8. **08_additional_tables.sql** - 기타 추가 테이블
   - goals
   - block_sets
   - student_global_settings
   - academies
   - academy_schedules
   - reports
   - student_history
   - user_sessions

9. **09_foreign_keys.sql** - 외래키 제약조건 (선택사항)

## ERD Cloud Import 방법

### 방법 1: 순차적 Import (권장)

1. ERD Cloud 프로젝트 생성
2. 각 SQL 파일을 순서대로 Import:
   - 01_core_tables.sql
   - 02_education_metadata.sql
   - 03_content_tables.sql
   - 04_scores_tables.sql
   - 05_plan_tables.sql
   - 06_management_tables.sql
   - 07_communication_tables.sql
   - 08_additional_tables.sql
   - 09_foreign_keys.sql (선택사항)

### 방법 2: 통합 Import

모든 테이블을 한 번에 Import하려면:

```bash
# 모든 SQL 파일을 하나로 합치기 (Windows PowerShell)
Get-Content 01_*.sql, 02_*.sql, 03_*.sql, 04_*.sql, 05_*.sql, 06_*.sql, 07_*.sql, 08_*.sql | Set-Content all_tables.sql

# 또는 Linux/Mac
cat 01_*.sql 02_*.sql 03_*.sql 04_*.sql 05_*.sql 06_*.sql 07_*.sql 08_*.sql > all_tables.sql
```

그 후 `all_tables.sql` 파일을 ERD Cloud에 Import합니다.

## 주의사항

1. **외래키 제약조건**: 
   - 기본적으로 테이블 생성 시 외래키 참조는 포함되어 있지만, 제약조건 이름은 명시하지 않았습니다.
   - ERD Cloud가 자동으로 관계를 인식할 수 있도록 참조만 포함했습니다.
   - 필요시 `09_foreign_keys.sql`에서 명시적 제약조건을 추가할 수 있습니다.

2. **UUID 기본값**:
   - 일부 테이블의 UUID는 `gen_random_uuid()` 함수를 사용합니다.
   - ERD Cloud에서 지원하지 않을 경우, 기본값을 제거하고 애플리케이션 레벨에서 생성하도록 수정하세요.

3. **인덱스**:
   - 성능 최적화를 위한 인덱스는 포함하지 않았습니다.
   - ERD Cloud에서 관계를 시각화한 후, 필요시 별도로 인덱스를 추가하세요.

4. **RLS (Row Level Security)**:
   - Supabase RLS 정책은 포함하지 않았습니다.
   - ERD Cloud는 스키마 구조만 시각화하므로 RLS는 별도로 관리하세요.

## 테이블 관계 요약

### 핵심 관계
- `tenants` ← 모든 테이블 (멀티테넌트 구조)
- `users` ← `admin_users`, `students`, `parent_users`
- `students` ← 대부분의 학생 관련 테이블

### 주요 관계
- `students` ↔ `student_plans` (1:N)
- `students` ↔ `study_sessions` (1:N)
- `students` ↔ `school_scores`, `mock_scores` (1:N)
- `plan_groups` ↔ `student_plans` (1:N)
- `master_books` ↔ `student_books` (1:N)
- `master_lectures` ↔ `student_lectures` (1:N)

## 다음 단계

1. ERD Cloud에서 스키마 Import 완료
2. 관계 확인 및 검증
3. 필요시 인덱스 추가
4. 실제 데이터베이스에 마이그레이션 적용

## 참고 문서

- [1730Timetable-PRD.md](../1730Timetable-PRD.md)
- [1730Timetable-통합-요구사항.md](../1730Timetable-통합-요구사항.md)
- [플랜-생성-로직-설계.md](../플랜-생성-로직-설계.md)

