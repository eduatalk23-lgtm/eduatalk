# 📊 Supabase 스키마 기반 서비스 재설계 문서

> **작성일**: 2024-11-27  
> **목적**: 스키마 기반 서비스 기능/화면 구조 정규화 및 재구성

---

## 1. 스키마 전체 분석

### 1.1 도메인 그룹핑 (총 11개 도메인)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TimeLevelUp 도메인 구조                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Auth &    │    │   Student   │    │   Score     │                 │
│  │    User     │───▶│ Management  │◀───│ Management  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                 │                   │                         │
│         ▼                 ▼                   ▼                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Tenant    │    │  Learning   │    │   Study     │                 │
│  │   (Multi)   │───▶│  Content    │───▶│    Plan     │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                           │                   │                         │
│                           ▼                   ▼                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Camp      │    │  Progress   │    │   Block     │                 │
│  │ Management  │───▶│ & Sessions  │◀───│   Time      │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐                                    │
│  │   Academy   │    │  Metadata   │                                    │
│  │ Management  │    │   (Codes)   │                                    │
│  └─────────────┘    └─────────────┘                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 도메인별 테이블 상세

#### 🔐 Domain 1: 인증 및 사용자 관리 (Auth & User)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `auth.users` | Supabase 기본 인증 | id, email, role | - |
| `tenants` | 멀티테넌트 기관 | name, type(academy/school/enterprise) | → 대부분 테이블 |
| `admin_users` | 관리자/컨설턴트 | role(student/consultant/admin) | → auth.users, tenants |
| `parent_users` | 학부모 | name | → auth.users, tenants |
| `user_sessions` | 세션 관리 | session_token, device_name, ip_address | → auth.users |

**역할 구조**:
```
auth.users.id
├── admin_users (role: admin/consultant/student)
└── parent_users (학부모 전용)
```

---

#### 👨‍🎓 Domain 2: 학생 관리 (Student)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `students` | 학생 기본 정보 | name, grade, class, status, school_id | → tenants, schools |
| `student_profiles` | 상세 프로필 (1:1) | gender, phone, address, medical_info | → students |
| `student_career_goals` | 진로 목표 (1:1) | exam_year, target_major, desired_career_field | → students |
| `student_career_field_preferences` | 진로 분야 우선순위 | career_field, priority | → students |
| `parent_student_links` | 학부모-학생 연결 | relation(mother/father/guardian) | → parent_users, students |

**학생 상태 값**: `enrolled`, `on_leave`, `graduated`, `transferred`

---

#### 📊 Domain 3: 성적 관리 (Score)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `student_scores` | 일반 성적 | subject, score_type, score, test_date | → students |
| `student_school_scores` | 내신 성적 | grade, semester, subject_group, raw_score, grade_score | → students, subjects |
| `student_mock_scores` | 모의고사 성적 | exam_type, exam_round, percentile, standard_score | → students, subjects |
| `student_analysis` | 학습 분석 결과 | risk_score, consistency_score, mastery_estimate | → students |

**성적 타입 흐름**:
```
student_scores (레거시/일반)
├── student_school_scores (내신 - 정규화된 구조)
│   ├── grade(학년) + semester(학기)
│   ├── subject_group → subject_groups
│   └── subject → subjects
└── student_mock_scores (모의고사)
    ├── exam_type + exam_round
    └── percentile + standard_score
```

---

#### 📚 Domain 4: 학습 콘텐츠 (Content)

**마스터 콘텐츠 (관리자 관리용)**:

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `master_books` | 마스터 교재 | title, publisher, total_pages, difficulty_level |
| `master_lectures` | 마스터 강의 | title, platform, total_episodes, total_duration |
| `book_details` | 교재 상세 (대단원/소단원) | major_unit, minor_unit, page_number |
| `lecture_episodes` | 강의 에피소드 | episode_number, episode_title, duration |
| `content_masters` | 통합 마스터 (Deprecated) | content_type(book/lecture) |

**학생 콘텐츠 (할당용)**:

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `books` | 학생 할당 교재 | title, total_pages, subject | → master_books, students |
| `lectures` | 학생 할당 강의 | title, total_episodes, platform | → master_lectures, students |
| `student_book_details` | 학생 교재 상세 | major_unit, minor_unit, page_number | → books |
| `student_lecture_episodes` | 학생 강의 에피소드 | episode_number, duration | → lectures |
| `student_custom_contents` | 커스텀 콘텐츠 | content_type, title, total_page_or_time | → students |
| `recommended_contents` | 추천 콘텐츠 | content_type, content_id, is_selected | → students |

**콘텐츠 구조**:
```
Master Content (관리자)           Student Content (학생 할당)
─────────────────────          ──────────────────────────
master_books ──────────────────▶ books
  └── book_details                 └── student_book_details

master_lectures ───────────────▶ lectures
  └── lecture_episodes             └── student_lecture_episodes

                               student_custom_contents (직접 생성)
```

---

#### 📅 Domain 5: 학습 계획 (Plan)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `plan_groups` | 계획 그룹 (기간별 묶음) | period_start/end, plan_purpose, scheduler_type, status | → students, camp_templates |
| `student_plan` | 일일 학습 계획 | plan_date, block_index, content_type, content_id, progress | → plan_groups, students |
| `plan_contents` | 계획 콘텐츠 목록 | content_type, content_id, start_range, end_range | → plan_groups |
| `plan_exclusions` | 제외 날짜 | exclusion_date, exclusion_type(휴가/개인사정) | → plan_groups, students |
| `excluded_dates` | 제외 날짜 (별도) | date, reason | → students |

**plan_groups 상태**: `draft`, `saved`, `active`, `paused`, `completed`, `cancelled`  
**plan_purpose**: `내신대비`, `모의고사`, `수능`, `기타`  
**scheduler_type**: `성적기반`, `1730_timetable`, `전략취약과목`, `커스텀`

---

#### ⏱️ Domain 6: 학습 진도 및 세션 (Progress)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `student_study_sessions` | 학습 세션 | started_at, ended_at, duration_seconds, focus_level | → student_plan |
| `student_content_progress` | 콘텐츠별 진도 | content_type, content_id, progress(0-100) | → student_plan |
| `plan_timer_logs` | 타이머 이벤트 | event_type(start/pause/resume/complete), duration_seconds | → student_plan |
| `student_goals` | 학습 목표 | goal_type, title, start_date, end_date, target_score | → students |
| `student_goal_progress` | 목표 진척도 | progress_amount | → student_goals, student_plan |

**세션 흐름**:
```
student_plan (계획)
    │
    ├──▶ plan_timer_logs (타이머 이벤트)
    │       event_type: start → pause → resume → complete
    │
    ├──▶ student_study_sessions (학습 세션)
    │       started_at → paused_at → resumed_at → ended_at
    │
    └──▶ student_content_progress (진도 업데이트)
            progress: 0 → ... → 100
```

---

#### 🕐 Domain 7: 시간 블록 관리 (Block Time)

**테넌트 레벨**:

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `tenant_block_sets` | 테넌트 블록 세트 | name, description |
| `tenant_blocks` | 테넌트 블록 | day_of_week, start_time, end_time |

**학생 레벨**:

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `student_block_sets` | 학생 블록 세트 | name, description |
| `student_block_schedule` | 학생 블록 스케줄 | day_of_week, start_time, end_time |
| `student_daily_schedule` | 일일 스케줄 | schedule_date, block_index, content_type |

**블록 구조**:
```
tenant_block_sets (테넌트 기본 템플릿)
  └── tenant_blocks (요일별 시간대)

student_block_sets (학생 개별 세트)
  └── student_block_schedule (요일별 시간대)
        └── student_daily_schedule (일별 상세)

students.active_block_set_id → student_block_sets (현재 활성 세트)
```

---

#### 🏫 Domain 8: 학원 관리 (Academy)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `academies` | 학원 정보 | name, travel_time | → students |
| `academy_schedules` | 학원 시간표 | day_of_week, start_time, end_time, subject | → academies, plan_groups |

---

#### 🏕️ Domain 9: 캠프 관리 (Camp)

| 테이블 | 역할 | 핵심 컬럼 | FK 관계 |
|--------|------|-----------|---------|
| `camp_templates` | 캠프 템플릿 | name, program_type, camp_start_date, camp_end_date, template_data | → tenants |
| `camp_invitations` | 캠프 초대 | status(pending/accepted/declined) | → camp_templates, students |
| `camp_template_block_sets` | 캠프 블록 세트 연결 | | → camp_templates, tenant_block_sets |

**캠프 프로그램 타입**: `윈터캠프`, `썸머캠프`, `파이널캠프`, `기타`

**캠프 흐름**:
```
camp_templates (템플릿 생성)
    │
    ├──▶ camp_template_block_sets (블록 세트 연결)
    │
    └──▶ camp_invitations (학생 초대)
              │
              └──▶ plan_groups (캠프 기반 계획 생성)
                      plan_type: 'camp'
```

---

#### 📋 Domain 10: 메타데이터/코드 테이블 (Metadata)

**교육과정 체계**:

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `curriculum_revisions` | 교육과정 개정 버전 | name(2009/2015/2022 개정), year |
| `subject_groups` | 과목 그룹 (교과 영역) | name | → curriculum_revisions |
| `subject_types` | 과목 유형 | name | → curriculum_revisions |
| `subjects` | 과목 정보 | name | → subject_groups, subject_types |

**기관/지역**:

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `schools` | 학교 정보 | name, type(중학교/고등학교/대학교), category, region_id |
| `regions` | 지역 정보 (계층) | name, level(1/2/3), parent_id |

**기타 코드**:

| 테이블 | 역할 |
|--------|------|
| `grades` | 학년 |
| `semesters` | 학기 |
| `publishers` | 출판사 |
| `platforms` | 강의 플랫폼 |
| `career_fields` | 진로 분야 |
| `content_subjects` | 콘텐츠 과목 |

---

#### 📝 Domain 11: 기타 (Misc)

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `student_history` | 학습 이력 | event_type, detail(JSONB) |
| `student_consulting_notes` | 상담 노트 | note | → students, admin_users |
| `make_scenario_logs` | Make.com 연동 로그 | scenario_type, status, input_data, output_data |

**student_history event_type**:
- `plan_completed`, `study_session`, `goal_progress`, `goal_created`, `goal_completed`
- `score_added`, `score_updated`, `content_progress`, `auto_schedule_generated`, `risk_evaluation`

---

### 1.3 관계 기반 프로세스 분석

#### 핵심 비즈니스 프로세스 1: 학생 온보딩

```
1. 회원가입 (auth.users)
2. 학생 기본정보 등록 (students)
3. 상세 프로필 입력 (student_profiles)
4. 진로 목표 설정 (student_career_goals)
5. 시간 블록 세트 생성 (student_block_sets + student_block_schedule)
6. 학원 등록 (academies + academy_schedules)
```

#### 핵심 비즈니스 프로세스 2: 학습 계획 생성

```
1. 계획 그룹 생성 (plan_groups)
   - period_start/end 설정
   - plan_purpose 선택
   - scheduler_type 선택
   - block_set_id 연결

2. 콘텐츠 선택 (plan_contents)
   - 교재/강의 선택 (books/lectures)
   - 범위 설정 (start_range, end_range)

3. 제외일 설정 (plan_exclusions)
   - 휴가, 개인사정 등록

4. 일일 계획 생성 (student_plan)
   - 자동 스케줄러 또는 수동 배치
   - 블록별 콘텐츠 할당
```

#### 핵심 비즈니스 프로세스 3: 학습 실행

```
1. 오늘 계획 조회 (student_plan WHERE plan_date = today)
2. 타이머 시작 (plan_timer_logs: event_type = 'start')
3. 일시정지/재개 (plan_timer_logs: event_type = 'pause'/'resume')
4. 완료 처리
   - plan_timer_logs: event_type = 'complete'
   - student_plan.progress 업데이트
   - student_content_progress 업데이트
   - student_study_sessions 기록
5. 목표 진척도 업데이트 (student_goal_progress)
```

#### 핵심 비즈니스 프로세스 4: 성적 관리

```
1. 성적 입력
   - 내신: student_school_scores (학년/학기/과목 구조화)
   - 모의고사: student_mock_scores (시험유형/회차/백분위)

2. 분석 실행 (student_analysis)
   - risk_score: 위험도
   - consistency_score: 일관성
   - mastery_estimate: 숙달도

3. 추천 생성 (recommended_contents)
   - 분석 결과 기반 콘텐츠 추천
```

---

### 1.4 RLS 정책 설계 가이드 (현재 미적용, 향후 적용 시 참고)

> 현재 모든 테이블의 `rls_enabled: false` 상태

#### 권장 RLS 정책 구조

```sql
-- 1. Tenant 격리 정책 (기본)
CREATE POLICY "tenant_isolation" ON {table}
  USING (tenant_id = get_current_tenant_id());

-- 2. 역할별 접근 정책
CREATE POLICY "admin_full_access" ON {table}
  FOR ALL
  USING (get_user_role() IN ('admin', 'consultant'));

CREATE POLICY "student_own_data" ON students
  FOR SELECT
  USING (id = auth.uid() OR get_user_role() IN ('admin', 'consultant'));

-- 3. 학부모 접근 정책
CREATE POLICY "parent_view_linked_students" ON students
  FOR SELECT
  USING (
    id IN (
      SELECT student_id FROM parent_student_links 
      WHERE parent_id = auth.uid()
    )
  );
```

#### 테이블별 RLS 권장 사항

| 도메인 | 테이블 | 학생 | 학부모 | 컨설턴트 | 관리자 |
|--------|--------|:----:|:------:|:--------:|:------:|
| Student | students | R(own) | R(linked) | RW | CRUD |
| Student | student_profiles | RW(own) | R(linked) | RW | CRUD |
| Score | student_*_scores | R(own) | R(linked) | RW | CRUD |
| Plan | plan_groups | RW(own) | R(linked) | RW | CRUD |
| Plan | student_plan | RW(own) | R(linked) | RW | CRUD |
| Content | master_* | R | R | R | CRUD |
| Content | books/lectures | R(own) | R(linked) | RW | CRUD |

---

## 2. 화면/기능 구조 자동 생성

### 2.1 역할별 화면 구조

#### 🛠️ Admin 역할 화면

```
/admin
├── /dashboard                    # 대시보드 (전체 현황)
│
├── /students                     # 학생 관리
│   ├── /[id]                    # 학생 상세
│   ├── /[id]/profile            # 프로필 편집
│   ├── /[id]/scores             # 성적 관리
│   ├── /[id]/plans              # 계획 관리
│   └── /[id]/progress           # 진도 현황
│
├── /content                      # 콘텐츠 관리
│   ├── /books                   # 마스터 교재
│   ├── /lectures                # 마스터 강의
│   └── /recommendations         # 추천 관리
│
├── /camps                        # 캠프 관리
│   ├── /templates               # 템플릿 관리
│   └── /invitations             # 초대 관리
│
├── /settings                     # 설정
│   ├── /tenant                  # 기관 설정
│   ├── /block-sets              # 블록 세트 관리
│   └── /codes                   # 코드 관리 (과목, 학교 등)
│
└── /reports                      # 리포트
    ├── /students                # 학생 분석
    └── /usage                   # 사용 현황
```

#### 📋 Consultant 역할 화면

```
/consultant
├── /dashboard                    # 대시보드 (담당 학생 현황)
│
├── /students                     # 담당 학생 관리
│   ├── /[id]                    # 학생 상세
│   ├── /[id]/scores             # 성적 입력/관리
│   ├── /[id]/plans              # 계획 생성/관리
│   ├── /[id]/progress           # 진도 모니터링
│   └── /[id]/notes              # 상담 노트
│
├── /content                      # 콘텐츠 조회
│   ├── /books                   # 교재 조회
│   └── /lectures                # 강의 조회
│
└── /camps                        # 캠프
    └── /invitations             # 초대 관리
```

#### 👨‍🎓 Student 역할 화면

```
/student
├── /dashboard                    # 대시보드 (오늘 요약)
│
├── /today                        # 오늘의 학습
│   ├── 계획 목록
│   ├── 타이머 (학습 실행)
│   └── 진도 입력
│
├── /plan                         # 학습 계획
│   ├── /groups                  # 계획 그룹 목록
│   ├── /groups/[id]             # 계획 그룹 상세
│   ├── /calendar                # 캘린더 뷰
│   └── /wizard                  # 계획 생성 위저드
│
├── /scores                       # 성적
│   ├── /school                  # 내신 성적
│   ├── /mock                    # 모의고사 성적
│   └── /analysis                # 분석 결과
│
├── /contents                     # 내 콘텐츠
│   ├── /books                   # 내 교재
│   ├── /lectures                # 내 강의
│   └── /custom                  # 커스텀 콘텐츠
│
├── /goals                        # 목표
│   └── /[id]                    # 목표 상세
│
├── /blocks                       # 시간 블록
│   └── /sets                    # 블록 세트 관리
│
├── /camp                         # 캠프
│   └── /[invitationId]          # 캠프 상세
│
└── /settings                     # 설정
    ├── /profile                 # 프로필
    └── /career                  # 진로 설정
```

#### 👨‍👩‍👧 Parent 역할 화면

```
/parent
├── /dashboard                    # 대시보드 (자녀 현황)
│
└── /children
    └── /[studentId]
        ├── /overview            # 개요
        ├── /scores              # 성적 조회
        ├── /plans               # 계획 조회
        └── /progress            # 진도 조회
```

---

### 2.2 화면별 기능 플로우

#### 📱 Student: 오늘의 학습 (`/today`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        오늘의 학습                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  입력 ──────────────────────────────────────────────────────▶  │
│  • 현재 날짜                                                    │
│  • 학생 ID (auth)                                               │
│                                                                 │
│  처리 ──────────────────────────────────────────────────────▶  │
│  1. 오늘 계획 조회 (student_plan WHERE plan_date = today)       │
│  2. 블록별 그룹핑                                               │
│  3. 콘텐츠 정보 조인 (books/lectures/custom)                    │
│  4. 진도 상태 계산                                              │
│                                                                 │
│  저장 ──────────────────────────────────────────────────────▶  │
│  • 타이머 시작/정지 → plan_timer_logs                           │
│  • 진도 업데이트 → student_plan.progress                        │
│  • 세션 기록 → student_study_sessions                           │
│  • 콘텐츠 진도 → student_content_progress                       │
│                                                                 │
│  조회 ──────────────────────────────────────────────────────▶  │
│  • 블록별 계획 목록                                             │
│  • 전체 진행률                                                  │
│  • 완료/미완료 카운트                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 Student: 계획 생성 위저드 (`/plan/wizard`)

```
┌─────────────────────────────────────────────────────────────────┐
│                     계획 생성 위저드                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: 기본 정보                                              │
│  ├── 입력: name, plan_purpose, period_start, period_end        │
│  └── 저장: plan_groups (status: draft)                         │
│                                                                 │
│  Step 2: 블록 세트 선택                                         │
│  ├── 조회: student_block_sets                                   │
│  └── 저장: plan_groups.block_set_id                            │
│                                                                 │
│  Step 3: 콘텐츠 선택                                            │
│  ├── 조회: books, lectures, recommended_contents               │
│  ├── 입력: content_id, start_range, end_range                  │
│  └── 저장: plan_contents                                        │
│                                                                 │
│  Step 4: 제외일 설정                                            │
│  ├── 입력: exclusion_date, exclusion_type, reason              │
│  └── 저장: plan_exclusions                                      │
│                                                                 │
│  Step 5: 스케줄 생성                                            │
│  ├── 처리: scheduler_type에 따른 자동 배치                      │
│  ├── 저장: student_plan (bulk insert)                          │
│  └── 저장: plan_groups.status = 'saved'                        │
│                                                                 │
│  Step 6: 활성화                                                 │
│  └── 저장: plan_groups.status = 'active'                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 Student: 성적 입력 (`/scores/school`)

```
┌─────────────────────────────────────────────────────────────────┐
│                      내신 성적 입력                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  입력 ──────────────────────────────────────────────────────▶  │
│  • grade (학년: 1-3)                                            │
│  • semester (학기: 1-2)                                         │
│  • subject_group (교과영역)                                     │
│  • subject_type (과목유형)                                      │
│  • subject_name (과목명)                                        │
│  • raw_score (원점수)                                           │
│  • grade_score (등급: 1-9)                                      │
│  • credit_hours (단위수)                                        │
│                                                                 │
│  처리 ──────────────────────────────────────────────────────▶  │
│  1. 유효성 검증                                                 │
│  2. 중복 체크 (같은 학년/학기/과목)                             │
│  3. 등급 자동 계산 (옵션)                                       │
│                                                                 │
│  저장 ──────────────────────────────────────────────────────▶  │
│  • student_school_scores INSERT/UPDATE                         │
│  • student_history (event: score_added/updated)                │
│                                                                 │
│  조회 ──────────────────────────────────────────────────────▶  │
│  • 학년/학기별 성적 목록                                        │
│  • 평균 등급 계산                                               │
│  • 성적 추이 차트                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 Admin: 마스터 교재 관리 (`/admin/content/books`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    마스터 교재 관리                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  목록 조회 ─────────────────────────────────────────────────▶  │
│  • master_books (필터: revision, subject_category, subject)    │
│  • 페이지네이션, 검색                                           │
│                                                                 │
│  생성 ──────────────────────────────────────────────────────▶  │
│  • 입력: title, publisher, total_pages, difficulty_level       │
│  • 입력: revision, content_category, semester, subject         │
│  • 저장: master_books                                          │
│  • 상세 입력: book_details (대단원/소단원/페이지)               │
│                                                                 │
│  수정 ──────────────────────────────────────────────────────▶  │
│  • master_books UPDATE                                         │
│  • book_details UPSERT                                         │
│                                                                 │
│  삭제 ──────────────────────────────────────────────────────▶  │
│  • 사용 여부 체크 (books 참조 확인)                             │
│  • master_books DELETE (CASCADE: book_details)                 │
│                                                                 │
│  엑셀 Import/Export ────────────────────────────────────────▶  │
│  • 일괄 등록                                                    │
│  • 데이터 내보내기                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 기능 ↔ 테이블 매핑

### 3.1 CRUD 매트릭스

#### Student 화면 CRUD

| 화면 | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| /today | plan_timer_logs, student_study_sessions | student_plan, books, lectures | student_plan.progress, student_content_progress | - |
| /plan/groups | plan_groups | plan_groups | plan_groups | plan_groups |
| /plan/wizard | plan_groups, plan_contents, plan_exclusions, student_plan | books, lectures, student_block_sets, recommended_contents | - | - |
| /scores/school | student_school_scores | student_school_scores, subjects | student_school_scores | student_school_scores |
| /scores/mock | student_mock_scores | student_mock_scores, subjects | student_mock_scores | student_mock_scores |
| /contents/books | books (from master) | books, master_books | books | books |
| /goals | student_goals | student_goals, student_goal_progress | student_goals | student_goals |
| /blocks/sets | student_block_sets, student_block_schedule | student_block_sets, student_block_schedule | student_block_sets, student_block_schedule | student_block_sets |
| /settings/profile | - | students, student_profiles | students, student_profiles | - |
| /settings/career | student_career_goals, student_career_field_preferences | student_career_goals | student_career_goals | - |

#### Admin 화면 CRUD

| 화면 | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| /admin/students | students | students, student_profiles | students | students |
| /admin/content/books | master_books, book_details | master_books, book_details | master_books, book_details | master_books |
| /admin/content/lectures | master_lectures, lecture_episodes | master_lectures, lecture_episodes | master_lectures, lecture_episodes | master_lectures |
| /admin/camps/templates | camp_templates, camp_template_block_sets | camp_templates | camp_templates | camp_templates |
| /admin/camps/invitations | camp_invitations | camp_invitations | camp_invitations | camp_invitations |
| /admin/settings/codes | subjects, subject_groups, schools, regions | all code tables | all code tables | all code tables |
| /admin/settings/block-sets | tenant_block_sets, tenant_blocks | tenant_block_sets, tenant_blocks | tenant_block_sets, tenant_blocks | tenant_block_sets |

---

### 3.2 주요 기능별 테이블 사용

#### 기능: 계획 자동 생성 (1730 Timetable)

```
Read:
├── plan_groups (기본 설정)
├── plan_contents (학습 콘텐츠)
├── student_block_sets → student_block_schedule (가용 시간)
├── academy_schedules (학원 시간 제외)
├── plan_exclusions (제외일)
├── books/lectures (콘텐츠 상세)
└── student_content_progress (현재 진도)

Write:
├── student_plan (일별 계획 생성)
└── plan_groups.status (상태 업데이트)
```

#### 기능: 학습 분석

```
Read:
├── student_school_scores (내신 성적)
├── student_mock_scores (모의고사 성적)
├── student_content_progress (진도)
├── student_study_sessions (학습 세션)
└── student_plan (계획 달성률)

Write:
├── student_analysis (분석 결과)
├── recommended_contents (추천 콘텐츠)
└── student_history (분석 이력)
```

#### 기능: 캠프 운영

```
Read:
├── camp_templates (템플릿)
├── camp_template_block_sets → tenant_block_sets (블록 세트)
├── students (참가 대상)
└── camp_invitations (초대 상태)

Write:
├── camp_invitations (초대 생성/상태변경)
├── plan_groups (캠프 기반 계획)
├── plan_contents (캠프 콘텐츠)
└── student_plan (일별 계획)
```

---

## 4. API/쿼리/데이터 흐름 설계

### 4.1 Supabase 쿼리 패턴

#### 패턴 1: 계층적 조회 (Nested Select)

```typescript
// 학생 상세 조회 (프로필, 진로목표 포함)
const { data: student } = await supabase
  .from('students')
  .select(`
    *,
    student_profiles (*),
    student_career_goals (*),
    school:schools (name, type),
    active_block_set:student_block_sets (*)
  `)
  .eq('id', studentId)
  .single();
```

#### 패턴 2: 날짜 기반 조회 (오늘의 계획)

```typescript
// 오늘의 학습 계획
const today = new Date().toISOString().split('T')[0];

const { data: plans } = await supabase
  .from('student_plan')
  .select(`
    *,
    plan_group:plan_groups (name, status)
  `)
  .eq('student_id', studentId)
  .eq('plan_date', today)
  .order('block_index');
```

#### 패턴 3: 집계 쿼리 (성적 통계)

```typescript
// 학년/학기별 평균 등급
const { data: scores } = await supabase
  .from('student_school_scores')
  .select('grade, semester, grade_score, credit_hours')
  .eq('student_id', studentId);

// 클라이언트에서 가중 평균 계산
const averageByGradeSemester = calculateWeightedAverage(scores);
```

#### 패턴 4: Upsert (성적 입력)

```typescript
// 성적 입력/수정 (중복 시 업데이트)
const { data, error } = await supabase
  .from('student_school_scores')
  .upsert({
    student_id,
    tenant_id,
    grade,
    semester,
    subject_name,
    raw_score,
    grade_score,
  }, {
    onConflict: 'student_id,grade,semester,subject_name',
    ignoreDuplicates: false
  });
```

#### 패턴 5: 트랜잭션 (계획 생성)

```typescript
// RPC 함수 또는 Edge Function 사용 권장
// 여러 테이블에 동시 insert 필요

// Option A: RPC Function
const { data, error } = await supabase
  .rpc('create_plan_with_contents', {
    p_plan_group: planGroupData,
    p_plan_contents: planContentsData,
    p_daily_plans: dailyPlansData
  });

// Option B: Sequential (비권장, 일관성 이슈)
const { data: group } = await supabase.from('plan_groups').insert(...);
await supabase.from('plan_contents').insert(...);
await supabase.from('student_plan').insert(...);
```

---

### 4.2 Next.js 16 데이터 Fetching 전략

#### Server Component 전략

```typescript
// app/(student)/today/page.tsx
export default async function TodayPage() {
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  
  // 서버에서 직접 데이터 fetch
  const { data: plans } = await supabase
    .from('student_plan')
    .select('*, plan_group:plan_groups(name)')
    .eq('student_id', user.id)
    .eq('plan_date', new Date().toISOString().split('T')[0]);
  
  return <TodayPlans initialData={plans} />;
}
```

#### Client Component + React Query 전략

```typescript
// app/(student)/today/_components/TodayPlans.tsx
'use client';

export function TodayPlans({ initialData }) {
  const { data: plans } = useQuery({
    queryKey: ['today-plans'],
    queryFn: fetchTodayPlans,
    initialData,
    staleTime: 1000 * 60, // 1분
  });

  // 타이머 mutation
  const timerMutation = useMutation({
    mutationFn: startTimer,
    onSuccess: () => queryClient.invalidateQueries(['today-plans']),
  });
  
  return <div>...</div>;
}
```

#### Server Actions 전략

```typescript
// app/(student)/actions/plans.ts
'use server';

export async function updatePlanProgress(planId: string, progress: number) {
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('student_plan')
    .update({ progress, updated_at: new Date().toISOString() })
    .eq('id', planId);
  
  if (error) throw error;
  
  revalidatePath('/today');
}
```

#### 추천 데이터 Fetching 패턴

| 데이터 유형 | 전략 | 이유 |
|-------------|------|------|
| 목록 (첫 로드) | Server Component | SEO, 초기 로딩 속도 |
| 실시간 업데이트 | React Query | 자동 갱신, 캐시 |
| 폼 제출 | Server Action | 보안, 간결함 |
| 타이머 이벤트 | Client + Mutation | 즉시 반응 |
| 대시보드 통계 | Server + Revalidate | 캐시 + 주기적 갱신 |

---

## 5. FE/BE 재구현 설계

### 5.1 폴더 구조 제안

```
app/
├── (auth)/                          # 인증 그룹
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   └── layout.tsx
│
├── (admin)/                         # 관리자 그룹
│   ├── admin/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── students/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── scores/
│   │   │   │   └── plans/
│   │   │   └── _components/
│   │   │       ├── StudentList.tsx
│   │   │       └── StudentForm.tsx
│   │   ├── content/
│   │   │   ├── books/
│   │   │   │   ├── page.tsx
│   │   │   │   └── _components/
│   │   │   └── lectures/
│   │   ├── camps/
│   │   └── settings/
│   ├── actions/                     # 관리자용 Server Actions
│   │   ├── students.ts
│   │   ├── content.ts
│   │   └── camps.ts
│   └── layout.tsx
│
├── (student)/                       # 학생 그룹
│   ├── today/
│   │   ├── page.tsx
│   │   └── _components/
│   │       ├── TodayHeader.tsx
│   │       ├── PlanList.tsx
│   │       ├── PlanCard.tsx
│   │       └── StudyTimer.tsx
│   ├── plan/
│   │   ├── page.tsx                 # 계획 목록
│   │   ├── wizard/
│   │   │   └── page.tsx
│   │   ├── [groupId]/
│   │   │   └── page.tsx
│   │   └── _components/
│   ├── scores/
│   │   ├── page.tsx                 # 성적 개요
│   │   ├── school/
│   │   │   └── page.tsx
│   │   ├── mock/
│   │   │   └── page.tsx
│   │   └── _components/
│   ├── contents/
│   ├── goals/
│   ├── blocks/
│   ├── settings/
│   ├── actions/                     # 학생용 Server Actions
│   │   ├── plans.ts
│   │   ├── progress.ts
│   │   ├── scores.ts
│   │   └── timer.ts
│   └── layout.tsx
│
├── (parent)/                        # 학부모 그룹
│   └── parent/
│       ├── dashboard/
│       └── children/
│
├── api/                             # API Routes
│   ├── auth/
│   └── webhooks/
│
├── layout.tsx                       # 루트 레이아웃
├── page.tsx                         # 랜딩/리다이렉트
└── providers.tsx                    # 전역 Providers

components/
├── ui/                              # 기본 UI 컴포넌트
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Form.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Table.tsx
│   └── ...
│
├── layout/                          # 레이아웃 컴포넌트
│   ├── AdminLayout.tsx
│   ├── StudentLayout.tsx
│   ├── ParentLayout.tsx
│   └── Sidebar.tsx
│
└── shared/                          # 공유 컴포넌트
    ├── DataTable.tsx
    ├── DatePicker.tsx
    ├── FileUpload.tsx
    └── Charts/

lib/
├── supabase/
│   ├── client.ts                    # Browser Client
│   ├── server.ts                    # Server Client
│   └── admin.ts                     # Admin Client
│
├── auth/
│   ├── getCurrentUser.ts
│   └── getCurrentUserRole.ts
│
├── data/                            # 데이터 fetching 함수
│   ├── students.ts
│   ├── plans.ts
│   ├── scores.ts
│   ├── content.ts
│   └── ...
│
├── hooks/                           # React Query Hooks
│   ├── useStudents.ts
│   ├── usePlans.ts
│   ├── useScores.ts
│   └── ...
│
├── types/                           # TypeScript 타입
│   ├── database.ts                  # Supabase 생성 타입
│   ├── student.ts
│   ├── plan.ts
│   └── ...
│
├── utils/
│   ├── date.ts
│   ├── format.ts
│   └── validation.ts
│
└── constants/
    ├── roles.ts
    └── status.ts
```

---

### 5.2 클라이언트/서버 컴포넌트 구분 기준

#### Server Component (기본)

```typescript
// ✅ Server Component 사용
// - 초기 데이터 로딩
// - SEO 필요한 페이지
// - 정적 콘텐츠

// app/(student)/scores/school/page.tsx
export default async function SchoolScoresPage() {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  
  const { data: scores } = await supabase
    .from('student_school_scores')
    .select('*')
    .eq('student_id', user.studentId);
  
  return (
    <div>
      <h1>내신 성적</h1>
      <ScoreList scores={scores} />
      <ScoreInputForm /> {/* Client Component */}
    </div>
  );
}
```

#### Client Component

```typescript
// ✅ Client Component 사용
// - 사용자 상호작용 (클릭, 입력)
// - 상태 관리 (useState, useReducer)
// - 브라우저 API (localStorage, timer)
// - 실시간 업데이트

// app/(student)/today/_components/StudyTimer.tsx
'use client';

export function StudyTimer({ planId }: { planId: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  
  const startMutation = useMutation({
    mutationFn: () => startTimer(planId),
  });
  
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);
  
  return (
    <div>
      <span>{formatTime(elapsed)}</span>
      <button onClick={() => setIsRunning(!isRunning)}>
        {isRunning ? '일시정지' : '시작'}
      </button>
    </div>
  );
}
```

#### 하이브리드 패턴

```typescript
// page.tsx (Server)
export default async function TodayPage() {
  const plans = await fetchTodayPlans();
  return <TodayClient initialPlans={plans} />;
}

// _components/TodayClient.tsx (Client)
'use client';
export function TodayClient({ initialPlans }) {
  const { data: plans } = useQuery({
    queryKey: ['today-plans'],
    initialData: initialPlans,
  });
  // ... 상호작용 로직
}
```

---

### 5.3 반복 가능한 단순 구조

#### 패턴 1: 목록 페이지

```typescript
// 템플릿: 목록 페이지
// app/(domain)/[resource]/page.tsx

export default async function ResourceListPage() {
  const data = await fetchResources();
  
  return (
    <div className="p-6">
      <PageHeader
        title="리소스 목록"
        action={<CreateButton />}
      />
      <ResourceFilters />
      <ResourceTable data={data} />
      <Pagination />
    </div>
  );
}
```

#### 패턴 2: 상세 페이지

```typescript
// 템플릿: 상세 페이지
// app/(domain)/[resource]/[id]/page.tsx

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resource = await fetchResourceById(id);
  
  if (!resource) notFound();
  
  return (
    <div className="p-6">
      <PageHeader
        title={resource.name}
        backLink="/resources"
        actions={<EditButton id={id} />}
      />
      <ResourceDetail resource={resource} />
      <RelatedSection resourceId={id} />
    </div>
  );
}
```

#### 패턴 3: 폼 페이지

```typescript
// 템플릿: 생성/수정 폼
// app/(domain)/[resource]/new/page.tsx 또는 [id]/edit/page.tsx

'use client';

export function ResourceForm({ initialData, mode }: FormProps) {
  const [formData, setFormData] = useState(initialData || defaultValues);
  
  const mutation = useMutation({
    mutationFn: mode === 'create' ? createResource : updateResource,
    onSuccess: () => router.push('/resources'),
  });
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="이름" name="name" value={formData.name} onChange={...} />
      <FormField label="설명" name="description" value={formData.description} onChange={...} />
      <FormActions
        isLoading={mutation.isPending}
        onCancel={() => router.back()}
      />
    </form>
  );
}
```

---

## 6. 재구현 로드맵

### 6.1 우선순위 및 단계

```
┌─────────────────────────────────────────────────────────────────┐
│                    재구현 로드맵 (12주)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: 기반 구축 (Week 1-2) ─────────────────────────────▶  │
│  ├── 프로젝트 셋업 (Next.js 16, Supabase)                      │
│  ├── 인증 시스템 구현                                           │
│  ├── 멀티테넌트 기본 구조                                       │
│  └── 공통 컴포넌트 라이브러리                                   │
│                                                                 │
│  Phase 2: 핵심 기능 (Week 3-6) ─────────────────────────────▶  │
│  ├── 학생 관리 (students, profiles)                            │
│  ├── 성적 관리 (school_scores, mock_scores)                    │
│  ├── 콘텐츠 관리 (master_books, master_lectures)               │
│  └── 기본 대시보드                                              │
│                                                                 │
│  Phase 3: 계획 시스템 (Week 7-9) ───────────────────────────▶  │
│  ├── 계획 그룹 관리 (plan_groups)                              │
│  ├── 계획 위저드 구현                                           │
│  ├── 일일 학습 (today) 화면                                     │
│  ├── 타이머 및 진도 추적                                        │
│  └── 블록 세트 관리                                             │
│                                                                 │
│  Phase 4: 부가 기능 (Week 10-11) ───────────────────────────▶  │
│  ├── 캠프 관리                                                  │
│  ├── 학습 분석 및 추천                                          │
│  ├── 학부모 화면                                                │
│  └── 리포트 기능                                                │
│                                                                 │
│  Phase 5: 마무리 (Week 12) ─────────────────────────────────▶  │
│  ├── RLS 정책 적용                                              │
│  ├── 성능 최적화                                                │
│  ├── 테스트 및 버그 수정                                        │
│  └── 배포                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.2 상세 구현 단계

#### Phase 1: 기반 구축 (Week 1-2)

| 작업 | 상세 | 산출물 |
|------|------|--------|
| 프로젝트 셋업 | Next.js 16, TypeScript, Tailwind | 기본 프로젝트 |
| Supabase 연결 | 환경변수, 클라이언트 설정 | lib/supabase/* |
| 타입 생성 | Supabase 타입 자동 생성 | lib/types/database.ts |
| 인증 | 로그인, 회원가입, 역할 분기 | (auth)/*, lib/auth/* |
| 레이아웃 | Admin, Student, Parent 레이아웃 | components/layout/* |
| UI 컴포넌트 | Button, Card, Form, Table 등 | components/ui/* |

#### Phase 2: 핵심 기능 (Week 3-6)

| 작업 | 관련 테이블 | 화면 |
|------|-------------|------|
| 학생 CRUD | students, student_profiles | /admin/students/* |
| 학교 관리 | schools, regions | /admin/settings/schools |
| 과목 관리 | subjects, subject_groups | /admin/settings/subjects |
| 마스터 교재 | master_books, book_details | /admin/content/books |
| 마스터 강의 | master_lectures, lecture_episodes | /admin/content/lectures |
| 내신 성적 | student_school_scores | /student/scores/school |
| 모의 성적 | student_mock_scores | /student/scores/mock |
| 학생 대시보드 | 통합 조회 | /student/dashboard |

#### Phase 3: 계획 시스템 (Week 7-9)

| 작업 | 관련 테이블 | 화면 |
|------|-------------|------|
| 블록 세트 | student_block_sets, student_block_schedule | /student/blocks |
| 콘텐츠 할당 | books, lectures | /student/contents |
| 계획 그룹 | plan_groups, plan_contents, plan_exclusions | /student/plan/groups |
| 계획 위저드 | 복합 | /student/plan/wizard |
| 오늘의 학습 | student_plan | /student/today |
| 타이머 | plan_timer_logs, student_study_sessions | /student/today |
| 진도 추적 | student_content_progress, student_goal_progress | /student/today |

#### Phase 4: 부가 기능 (Week 10-11)

| 작업 | 관련 테이블 | 화면 |
|------|-------------|------|
| 캠프 템플릿 | camp_templates | /admin/camps/templates |
| 캠프 초대 | camp_invitations | /admin/camps/invitations |
| 학습 분석 | student_analysis | /student/scores/analysis |
| 추천 콘텐츠 | recommended_contents | /student/contents |
| 학부모 화면 | parent_users, parent_student_links | /parent/* |
| 상담 노트 | student_consulting_notes | /admin/students/[id]/notes |

#### Phase 5: 마무리 (Week 12)

| 작업 | 상세 |
|------|------|
| RLS 정책 | 테넌트 격리, 역할별 접근 제어 |
| 성능 최적화 | 쿼리 최적화, 캐싱, 번들 분석 |
| 에러 처리 | 에러 바운더리, 토스트 알림 |
| 테스트 | E2E 테스트 (Playwright) |
| 배포 | Vercel + Supabase Production |

---

### 6.3 위험 요소 및 누락 점검

#### 🚨 위험 요소

| 위험 | 영향도 | 대응 방안 |
|------|--------|-----------|
| RLS 미적용 상태 | 높음 | Phase 5에서 일괄 적용, 초기에 미들웨어로 보완 |
| content_masters 테이블 역할 불명확 | 중간 | master_books/lectures만 사용, 필요 시 마이그레이션 |
| 스키마 변경 가능성 | 중간 | 타입 자동 생성, 마이그레이션 문서화 |
| 복잡한 계획 생성 로직 | 높음 | RPC 함수 또는 Edge Function으로 분리 |

#### 📋 누락 가능성 있는 기능

| 기능 | 관련 테이블 | 우선순위 |
|------|-------------|----------|
| 학원 스케줄 연동 | academies, academy_schedules | 중간 |
| Make.com 연동 | make_scenario_logs | 낮음 |
| 학습 이력 조회 | student_history | 중간 |
| 진로 분야 우선순위 | student_career_field_preferences | 낮음 |
| 사용자 세션 관리 | user_sessions | 낮음 |

#### ❓ 확인 필요 사항

1. **content_masters vs master_books/lectures**
   - content_masters 테이블이 별도로 존재하는데, master_books/lectures와의 관계가 불명확
   - 현재 구조에서는 master_books/lectures 사용 권장

2. **student_scores vs student_school_scores/mock_scores**
   - student_scores가 레거시 테이블인지 확인 필요
   - 정규화된 school_scores, mock_scores 사용 권장

3. **excluded_dates vs plan_exclusions**
   - 두 테이블 모두 제외일 관리
   - plan_exclusions가 plan_group 연결되어 있어 더 적합

4. **student_daily_schedule vs student_plan**
   - 기능 중복 가능성
   - student_plan 중심으로 구현 권장

---

## 7. 요약

### 핵심 도메인 (11개)

1. Auth & User (인증/사용자)
2. Student (학생 관리)
3. Score (성적 관리)
4. Content (학습 콘텐츠)
5. Plan (학습 계획)
6. Progress (진도/세션)
7. Block Time (시간 블록)
8. Academy (학원)
9. Camp (캠프)
10. Metadata (코드 테이블)
11. Misc (기타)

### 역할별 핵심 화면

- **Admin**: 학생 관리, 콘텐츠 관리, 캠프 관리, 설정
- **Consultant**: 담당 학생 관리, 상담, 계획 지원
- **Student**: 오늘의 학습, 계획, 성적, 콘텐츠, 설정
- **Parent**: 자녀 현황 조회

### 구현 전략

- Server Component 기본, Client Component 필요 시
- React Query로 서버 상태 관리
- Server Actions로 데이터 mutation
- 반복 가능한 템플릿 패턴 적용
- 12주 로드맵으로 단계별 구현

---

*문서 끝*

