# Supabase 데이터베이스 스키마 분석

## 📋 개요

이 문서는 Supabase 데이터베이스의 전체 스키마 구조를 분석한 리포트입니다. 마이그레이션 파일과 ERD 문서를 기반으로 작성되었습니다.

**분석 일자**: 2025-01-31  
**마이그레이션 파일 수**: 64개  
**주요 테이블 수**: 약 50개 이상

---

## 🏗 아키텍처 개요

### 멀티테넌트 구조

시스템은 **멀티테넌트 아키텍처**를 기반으로 설계되어 있으며, 모든 주요 테이블에 `tenant_id`가 포함되어 있습니다.

```
tenants (기관)
  ├── users (통합 사용자)
  ├── students (학생)
  ├── admin_users (관리자)
  ├── parent_users (학부모)
  └── ... (모든 하위 테이블)
```

### 역할 기반 접근 제어 (RBAC)

- **superadmin**: 시스템 관리자
- **admin**: 테넌트 관리자
- **teacher**: 담당자
- **student**: 학생
- **parent**: 학부모

---

## 📊 주요 테이블 그룹

### 1. 핵심 사용자 및 인증 테이블

#### tenants (기관)
```sql
- id: uuid (PK)
- name: text
- type: text (academy, school, enterprise, other)
- status: text (active, inactive, suspended)
- settings: jsonb
- created_at, updated_at: timestamptz
```

#### users (통합 사용자)
```sql
- id: uuid (PK, Supabase Auth 연동)
- tenant_id: uuid (FK → tenants)
- email: text (UNIQUE)
- role: text (superadmin, admin, teacher, student, parent)
- name, phone, profile_image_url: text
- is_active: boolean
- last_login_at: timestamptz
- created_at, updated_at: timestamptz
```

#### students (학생 정보)
```sql
- id: uuid (PK, FK → users)
- tenant_id: uuid (FK → tenants)
- student_number, grade, class_number: text
- school_id: uuid
- birth_date: date
- gender: text (male, female, other)
- address, parent_contact, emergency_contact: text
- medical_info, notes: text
- is_active: boolean
- enrolled_at: date
- active_block_set_id: uuid (FK → student_block_sets)
- created_at, updated_at: timestamptz
```

#### admin_users (관리자 상세 정보)
```sql
- id: uuid (PK, FK → users)
- tenant_id: uuid (FK → tenants)
- position, department: text
- permissions: jsonb
- notes: text
- created_at, updated_at: timestamptz
```

#### parent_users (학부모 정보)
```sql
- id: uuid (PK, FK → users)
- tenant_id: uuid (FK → tenants)
- relationship: text (father, mother, guardian, other)
- occupation: text
- created_at, updated_at: timestamptz
```

#### student_parent_links (학생-학부모 연결)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- student_id: uuid (FK → students)
- parent_id: uuid (FK → parent_users)
- relationship: text
- is_primary, is_approved: boolean
- approved_at: timestamptz
- created_at: timestamptz
- UNIQUE(student_id, parent_id)
```

---

### 2. 플랜 및 스케줄링 테이블

#### plan_groups (플랜 그룹 - 메타데이터)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- student_id: uuid (FK → students)
- name: varchar(200)
- plan_purpose: varchar(50) (내신대비, 모의고사, 수능, 기타)
- scheduler_type: varchar(50) (성적기반, 1730_timetable, 전략취약과목, 커스텀)
- period_start, period_end: date
- target_date: date (D-day)
- block_set_id: uuid (FK → student_block_sets)
- status: varchar(20) (draft, saved, active, paused, completed, cancelled)
- deleted_at: timestamptz (Soft Delete)
- scheduler_options: jsonb (스케줄러 옵션)
- study_hours: jsonb (학습 시간 설정)
- self_study_hours: jsonb (자율학습 시간 설정)
- non_study_time_blocks: jsonb (학습 시간 제외 항목)
- subject_constraints: jsonb (교과 제약 조건)
- additional_period_reallocation: jsonb (추가 기간 재배치)
- daily_schedule: jsonb (일별 스케줄 정보)
- schedule_summary: jsonb (스케줄 요약)
- student_level: text (1730 Timetable용)
- created_at, updated_at: timestamptz
```

#### student_plan (개별 플랜 항목)
```sql
- id: uuid (PK)
- plan_group_id: uuid (FK → plan_groups)
- student_id: uuid (FK → students)
- plan_date: date
- content_type: text (book, lecture, custom)
- content_id: uuid
- start_page_or_time: numeric
- end_page_or_time: numeric
- planned_time: integer (계획된 학습 시간, 분)
- plan_number: integer (플랜 번호)
- sequence: integer (순서)
- memo: text
- content_metadata: jsonb
- plan_metadata: jsonb
- created_at, updated_at: timestamptz
```

#### plan_contents (플랜 그룹-콘텐츠 관계)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- plan_group_id: uuid (FK → plan_groups)
- content_type: varchar(20) (book, lecture, custom)
- content_id: uuid
- start_range: numeric (시작 페이지/회차)
- end_range: numeric (종료 페이지/회차)
- display_order: integer
- created_at, updated_at: timestamptz
```

#### plan_exclusions (학습 제외일)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- plan_group_id: uuid (FK → plan_groups)
- exclusion_date: date
- exclusion_type: varchar(20) (휴가, 개인사정, 휴일지정, 기타)
- reason: text
- created_at: timestamptz
- UNIQUE(plan_group_id, exclusion_date)
```

#### plan_timer_logs (플랜 타이머 이벤트 로그)
```sql
- id: uuid (PK)
- plan_id: uuid (FK → student_plan)
- student_id: uuid (FK → students)
- tenant_id: uuid (FK → tenants)
- event_type: text (start, pause, resume, complete)
- timestamp: timestamptz
- duration_seconds: integer (누적 학습 시간)
- note: text
- created_at: timestamptz
```

---

### 3. 콘텐츠 관리 테이블

#### content_metadata (콘텐츠 메타데이터)
다음 테이블들이 콘텐츠 분류를 위한 메타데이터를 제공합니다:

- **curriculum_revisions** (개정교육과정): 2015개정, 2022개정 등
- **grades** (학년): 중1, 중2, 중3, 고1, 고2, 고3
- **semesters** (학기): 1학기, 2학기, 여름방학, 겨울방학
- **subject_categories** (교과): 국어, 수학, 영어, 사회, 과학 등
- **content_subjects** (과목): 화법과 작문, 수학Ⅰ, 영어독해와 작문 등
- **platforms** (플랫폼): 메가스터디, EBSi, 이투스 등
- **publishers** (출판사): 비상교육, 천재교육, 좋은책신사고 등

#### student_contents (학생 콘텐츠)
```sql
-- books (교재)
- id: uuid (PK)
- student_id: uuid (FK → students)
- master_content_id: uuid (FK → content_masters, nullable)
- title, publisher: text
- total_pages: integer
- current_page: integer
- subject_category, subject: text
- ... (기타 필드)

-- lectures (강의)
- id: uuid (PK)
- student_id: uuid (FK → students)
- master_content_id: uuid (FK → content_masters, nullable)
- title, platform: text
- total_episodes: integer
- current_episode: integer
- linked_book_id: uuid (FK → books, nullable)
- ... (기타 필드)
```

#### lecture_episodes (강의 회차)
```sql
- id: uuid (PK)
- lecture_id: uuid (FK → lectures)
- episode_number: integer
- title: text
- duration_minutes: integer
- display_order: integer
- created_at: timestamptz
```

---

### 4. 성적 관리 테이블

#### student_scores (통합 성적 테이블)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- tenant_id: uuid (FK → tenants)
- subject_type: text (school, mock)
- semester: text
- course: text (중간고사, 기말고사 등)
- course_detail: text
- raw_score: numeric
- grade: integer (1-9)
- score_type_detail: text
- test_date: date
- created_at: timestamptz
```

#### subject_groups (교과 그룹)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- name: text (국어, 수학, 영어 등)
- display_order: integer
- created_at, updated_at: timestamptz
- UNIQUE(tenant_id, name)
```

#### subjects (과목)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- subject_group_id: uuid (FK → subject_groups)
- name: text (수학Ⅰ, 수학Ⅱ 등)
- display_order: integer
- created_at, updated_at: timestamptz
- UNIQUE(tenant_id, subject_group_id, name)
```

#### student_analysis (학생 분석)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- tenant_id: uuid (FK → tenants)
- subject: text
- risk_score: numeric
- recent_grade_trend: numeric
- consistency_score: numeric
- mastery_estimate: numeric
- updated_at, created_at: timestamptz
```

---

### 5. 학습 세션 및 목표 테이블

#### student_study_sessions (학습 세션)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- plan_id: uuid (FK → student_plan, nullable)
- content_type: text (book, lecture, custom)
- content_id: uuid
- started_at: timestamptz
- ended_at: timestamptz (nullable)
- duration_seconds: integer
- focus_level: integer (1-5)
- note: text
- pause_count: integer (일시정지 횟수)
- pause_duration_seconds: integer (일시정지 총 시간)
- created_at: timestamptz
```

#### student_goals (학습 목표)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- goal_type: text (range, exam, weekly, monthly)
- title: text
- description: text
- subject: text
- content_id: uuid
- start_date, end_date: date
- expected_amount: integer
- target_score: integer
- created_at: timestamptz
```

#### student_goal_progress (목표 달성률)
```sql
- id: uuid (PK)
- goal_id: uuid (FK → student_goals)
- student_id: uuid (FK → students)
- plan_id: uuid (FK → student_plan, nullable)
- session_id: uuid (FK → student_study_sessions, nullable)
- progress_amount: integer
- recorded_at: timestamptz
```

---

### 6. 블록 및 시간 관리 테이블

#### student_block_sets (블록 세트)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- student_id: uuid (FK → students)
- name: varchar(100)
- description: text
- display_order: integer
- created_at, updated_at: timestamptz
- UNIQUE(student_id, name)
```

#### student_block_schedule (블록 스케줄)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- block_set_id: uuid (FK → student_block_sets)
- day_of_week: integer (0-6)
- start_time: time
- end_time: time
- block_type: text
- created_at, updated_at: timestamptz
```

---

### 7. 학원 및 일정 관리 테이블

#### academies (학원)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- student_id: uuid (FK → students)
- name: varchar(255)
- travel_time: integer (분 단위)
- created_at, updated_at: timestamptz
```

#### academy_schedules (학원 일정)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- academy_id: uuid (FK → academies)
- plan_group_id: uuid (FK → plan_groups, nullable)
- day_of_week: integer (0-6)
- start_time: time
- end_time: time
- academy_name: varchar(100) (하위 호환성)
- subject: varchar(50) (하위 호환성)
- created_at, updated_at: timestamptz
```

---

### 8. 기타 관리 테이블

#### student_history (학생 이력)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- tenant_id: uuid (FK → tenants)
- action_type: text
- action_data: jsonb
- created_at: timestamptz
```

#### student_global_settings (학생 전역 설정)
```sql
- id: uuid (PK)
- student_id: uuid (FK → students)
- tenant_id: uuid (FK → tenants)
- exclusions: jsonb (제외일)
- academy_schedules: jsonb (학원 일정)
- ... (기타 전역 설정)
```

#### consulting_notes (상담 기록)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- student_id: uuid (FK → students)
- admin_id: uuid (FK → admin_users)
- note: text
- created_at, updated_at: timestamptz
```

#### notification_preferences (알림 설정)
```sql
- id: uuid (PK)
- user_id: uuid (FK → users)
- tenant_id: uuid (FK → tenants)
- preferences: jsonb
- created_at, updated_at: timestamptz
```

#### user_sessions (사용자 세션)
```sql
- id: uuid (PK)
- user_id: uuid (FK → users)
- tenant_id: uuid (FK → tenants)
- session_data: jsonb
- expires_at: timestamptz
- created_at: timestamptz
```

#### schools (학교)
```sql
- id: uuid (PK)
- tenant_id: uuid (FK → tenants)
- name: text
- region: text
- school_type: text
- created_at, updated_at: timestamptz
```

---

## 🔗 주요 관계도

### 플랜 생성 흐름
```
plan_groups (플랜 그룹)
  ├── plan_contents (콘텐츠 선택)
  ├── plan_exclusions (제외일)
  ├── academy_schedules (학원 일정)
  └── student_plan (개별 플랜 항목)
        └── plan_timer_logs (타이머 로그)
```

### 콘텐츠 구조
```
content_metadata (메타데이터)
  ├── curriculum_revisions
  ├── grades
  ├── semesters
  ├── subject_categories
  ├── content_subjects
  ├── platforms
  └── publishers

student_contents
  ├── books (교재)
  └── lectures (강의)
        └── lecture_episodes (회차)
```

### 성적 관리 구조
```
subject_groups (교과 그룹)
  └── subjects (과목)
        └── student_scores (성적)
              └── student_analysis (분석)
```

### 학습 추적 구조
```
student_plan (플랜)
  ├── student_study_sessions (학습 세션)
  └── plan_timer_logs (타이머 로그)

student_goals (목표)
  └── student_goal_progress (진행률)
```

---

## 🔒 보안 및 RLS (Row Level Security)

### RLS 정책 패턴

모든 테이블에 RLS가 활성화되어 있으며, 다음과 같은 패턴을 따릅니다:

1. **학생 접근**: 본인 데이터만 조회/수정 가능
2. **관리자 접근**: 같은 tenant 내 모든 데이터 조회/수정 가능
3. **학부모 접근**: 연결된 자녀의 데이터만 조회 가능
4. **테넌트 격리**: tenant_id 기반 자동 격리

### 주요 RLS 정책 예시

```sql
-- 학생: 본인 데이터만
USING (auth.uid() = student_id)

-- 관리자: 같은 tenant 내 모든 데이터
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.tenant_id = table_name.tenant_id
  )
)

-- 학부모: 연결된 자녀의 데이터
USING (
  EXISTS (
    SELECT 1 FROM student_parent_links
    WHERE student_id = table_name.student_id
    AND parent_id = auth.uid()
  )
)
```

---

## 📈 인덱스 전략

### 주요 인덱스 패턴

1. **기본 인덱스**: PK, FK 컬럼
2. **조회 최적화**: `(student_id, created_at DESC)`, `(tenant_id, status)`
3. **날짜 범위 조회**: `(period_start, period_end)`, `(test_date DESC)`
4. **NULL 필터링**: `WHERE column IS NOT NULL` 조건부 인덱스

### 주요 복합 인덱스

- `plan_groups`: `(student_id, status)`, `(period_start, period_end)`
- `student_plan`: `(plan_group_id, plan_date)`
- `student_study_sessions`: `(student_id, started_at DESC)`
- `student_scores`: `(student_id, test_date DESC)`

---

## 🗄 JSONB 필드 활용

### plan_groups JSONB 필드

- **scheduler_options**: 스케줄러 설정 (study_days, review_days 등)
- **study_hours**: 학습 시간 설정
- **self_study_hours**: 자율학습 시간 설정
- **non_study_time_blocks**: 학습 시간 제외 항목
- **subject_constraints**: 교과 제약 조건
- **additional_period_reallocation**: 추가 기간 재배치
- **daily_schedule**: 일별 스케줄 정보
- **schedule_summary**: 스케줄 요약

### 기타 JSONB 필드

- **users.settings**: 사용자 설정
- **tenants.settings**: 테넌트 설정
- **student_global_settings**: 학생 전역 설정
- **student_history.action_data**: 이력 데이터

---

## 🔄 마이그레이션 이력

### 주요 마이그레이션 타임라인

1. **2025-01-01**: 학교 및 모의고사 성적 테이블 생성
2. **2025-01-02**: 학습 세션 테이블 생성
3. **2025-01-03**: 목표 테이블 생성
4. **2025-01-07**: 테넌트 구조 도입
5. **2025-01-10**: 블록 세트 기능 추가
6. **2025-01-15**: 플랜 그룹 구조 확장
7. **2025-01-16**: 콘텐츠 마스터 분리
8. **2025-01-29**: 내신 성적 구조 재설계
9. **2025-02-01**: 콘텐츠 메타데이터 테이블 생성
10. **2025-11-20**: 학원 단위 관리 구조 변경
11. **2025-11-22**: 플랜 타이머 로그 테이블 생성

### 최근 주요 변경사항

- **1730 Timetable 기능**: `plan_groups`에 `student_level`, `scheduler_options` 등 추가
- **학원 관리 개선**: `academies` 테이블 생성, `academy_schedules` 리팩토링
- **플랜 메타데이터 확장**: `plan_metadata`, `content_metadata` 필드 추가
- **타이머 로그**: `plan_timer_logs` 테이블로 학습 시간 추적 강화

---

## ⚠️ 주의사항 및 권장사항

### 1. Soft Delete 패턴

일부 테이블은 `deleted_at` 필드를 사용한 Soft Delete를 구현하고 있습니다:
- `plan_groups.deleted_at`

### 2. 외래키 제약조건

- 대부분 `ON DELETE CASCADE` 또는 `ON DELETE RESTRICT` 사용
- `ON DELETE SET NULL`은 선택적 관계에 사용

### 3. 데이터 무결성

- `UNIQUE` 제약조건으로 중복 방지
- `CHECK` 제약조건으로 값 검증
- 트리거로 `updated_at` 자동 업데이트

### 4. 성능 최적화

- JSONB 필드에 대한 인덱스 고려 필요
- 자주 조회되는 복합 조건에 대한 인덱스 추가 권장
- RLS 정책이 복잡한 경우 성능 모니터링 필요

---

## 📝 향후 개선 제안

1. **인덱스 최적화**: JSONB 필드에 대한 GIN 인덱스 추가 검토
2. **파티셔닝**: 대용량 테이블(예: `student_study_sessions`) 파티셔닝 고려
3. **아카이빙**: 오래된 데이터 아카이빙 전략 수립
4. **모니터링**: 쿼리 성능 모니터링 및 최적화
5. **문서화**: 각 JSONB 필드의 스키마 문서화

---

## 📚 참고 자료

- 마이그레이션 파일: `supabase/migrations/`
- ERD 문서: `timetable/erd-cloud/`
- 플랜 그룹 분석: `docs/plan-group-wizard-flow-analysis.md`

---

**문서 버전**: 1.0  
**최종 업데이트**: 2025-01-31

