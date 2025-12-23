# EduaTalk(TimeLevelUp) 비즈니스 로직 분석

> 작성일: 2024-12-24
> 버전: 1.0

## 1. 시스템 개요

**EduaTalk(TimeLevelUp)**는 학생의 성적 분석을 기반으로 맞춤형 학습 플랜을 자동 생성하는 AI 기반 통합 학습 관리 시스템입니다.

### 기술 스택
- **Frontend**: Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **상태 관리**: React Query (서버 상태), Context API (클라이언트 상태)
- **멀티테넌트**: 여러 프랜차이즈 지점의 독립적 운영 지원

---

## 2. 사용자 역할 및 라우팅

### 2.1 역할별 대시보드 및 기능 영역

| 역할 | URL 경로 | 주요 기능 |
|------|---------|---------|
| **Student(학생)** | `/dashboard`, `/today`, `/plan` | 학습 플랜 조회/생성, 오늘의 학습, 성적 입력, 캠프 참여 |
| **Admin(관리자)** | `/admin/dashboard` | 학생 관리, 학습 계획 검토, 콘텐츠 관리, 성적 모니터링 |
| **Parent(학부모)** | `/parent/dashboard` | 자녀 학습 진행 조회, 성적 확인, 학습 히스토리 |
| **SuperAdmin(슈퍼관리자)** | `/superadmin/dashboard` | 시스템 전체 관리, 테넌트 관리, 사용자 권한 설정 |
| **Consultant(컨설턴트)** | `/admin/*` | 관리자와 동일한 권한 |

### 2.2 라우팅 방식
로그인 후 사용자 역할에 따라 자동 리다이렉트:
- 학생: `/dashboard` (학습 현황)
- 관리자/컨설턴트: `/admin/dashboard` (관리 화면)
- 학부모: `/parent/dashboard` (자녀 모니터링)
- 슈퍼관리자: `/superadmin/dashboard` (시스템 관리)

---

## 3. 핵심 비즈니스 도메인

### 3.1 Plan 도메인 (학습 계획 관리)

#### 주요 엔티티
- **Plan Group** (플랜 그룹): 기간별 학습 계획의 컨테이너
  - 상태: `draft` → `saved` → `active` → `paused`/`completed`/`cancelled`
  - 기간(period_start, period_end), 학습 목표(plan_purpose), 스케줄러 옵션 포함

- **Student Plan** (학생 플랜): 일별 학습 계획
  - plan_date: 계획 날짜
  - progress: 진행률 (0-100%)
  - status: 계획 상태 추적

- **Plan Content** (플랜 콘텐츠): 플랜에 포함된 교재/강의
  - display_order: 순서 관리
  - content_type: 책/강의/커스텀 콘텐츠

- **Plan Exclusion** (제외일): 학습 불가능한 날짜
  - exclusion_type: 개인일정, 휴가, 병가 등

- **Academy Schedule** (학원 일정): 학원 수강 일정 통합

#### 비즈니스 로직
```
1. 플랜 그룹 생성 흐름
   ├─ 기간 유효성 검증 (시작일 < 종료일)
   ├─ 제외일 설정 (병가, 휴가 등)
   ├─ 학원 일정 연동
   ├─ 블록 세트 선택 (시간대 템플릿)
   └─ 스케줄러로 자동 일별 계획 생성

2. 플랜 진행률 추적
   ├─ 학생이 콘텐츠 완료 시 progress 업데이트
   ├─ 실시간 진행 상황 반영
   └─ 대시보드에서 시각화

3. 플랜 상태 관리
   ├─ draft: 작성 중
   ├─ saved: 저장됨 (아직 활성화 안함)
   ├─ active: 진행 중
   ├─ paused: 일시 중지
   └─ completed/cancelled: 종료
```

---

### 3.2 Score 도메인 (성적 관리)

#### 주요 엔티티
- **Mock Score** (모의고사 성적)
  - exam_date, exam_title, grade
  - grade_score (1-9), percentile (0-100)
  - 과목별 상세 점수 추적

- **Internal Score** (내신 성적) - 레거시
  - 학교 성적 입력 및 추적

#### 비즈니스 로직
```
1. 성적 입력 검증
   ├─ 학년 유효성 (1-3)
   ├─ 등급 범위 (1-9)
   ├─ 백분위 범위 (0-100)
   └─ 필수 필드 확인

2. 성적 기반 플랜 생성 트리거
   ├─ 약점 과목 분석 (성적 낮은 과목)
   ├─ 강점 과목 확인
   └─ 맞춤형 학습 경로 자동 제안

3. 성적 추이 분석
   ├─ 월별/시험별 성적 비교
   ├─ 진도 추적
   └─ 부모/관리자에게 리포트 제공
```

---

### 3.3 Today 도메인 (오늘의 학습)

#### 주요 기능
- 오늘 날짜의 플랜 조회 및 실시간 진행 상황
- 학습 시간 계산 및 전시
- 활성 학습 위젯 (현재 진행 중인 콘텐츠)
- 학습 성취도 표시

#### 데이터 흐름
```
학생 로그인
  ↓
Dashboard에서 오늘 진행률(%) 표시
  ├─ 완료된 플랜 수 / 전체 플랜 수
  └─ 진행률 계산: Math.round((completed / total) * 100)
  ↓
Today 페이지에서 상세 플랜 조회
  ├─ getTodayPlans(studentId, todayDate)
  ├─ 오늘 학습 계획(Today Plans) 렌더링
  ├─ 활성 학습 위젯 표시 (지연 로딩)
  └─ 학습 성취도 섹션
  ↓
실시간 모니터링
  ├─ 학생이 콘텐츠 완료 시 progress 업데이트
  ├─ Supabase Realtime으로 실시간 동기화
  └─ UI 자동 갱신
```

---

### 3.4 Attendance 도메인 (출석 관리)

#### 주요 기능
- QR 코드 기반 출석 체크인/체크아웃
- 출석 현황 통계
- SMS 알림 (학부모 연동)
- 지각/결석 추적

#### 데이터 엔티티
- **AttendanceRecord**: 일별 출석 기록
  - attendance_date, check_in_time, check_out_time
  - status: present/absent/late
  - check_in_method: qr_code/manual/api

- **AttendanceStatistics**: 통계 (월별, 주별)

#### 비즈니스 로직
```
1. 출석 기록 생성/수정
   ├─ 동일 학생, 동일 날짜의 기존 기록 확인
   ├─ 검증 (시간 유효성, 중복 체크)
   ├─ 존재하면 업데이트, 없으면 생성
   └─ 학부모 알림 발송

2. SMS 알림 규칙
   ├─ check_in_enabled: 입실 시 알림
   ├─ check_out_enabled: 퇴실 시 알림
   ├─ absent_enabled: 결석 알림
   └─ late_enabled: 지각 알림
```

---

### 3.5 Camp 도메인 (캠프/특별 프로그램)

#### 주요 엔티티
- **Camp Template** (캠프 템플릿): 윈터/썸머/파이널 캠프 등
  - camp_name, program_type, status (draft/active/archived)
  - 블록 세트 템플릿 포함

- **Camp Invitation** (캠프 초대):
  - status: pending → accepted/declined
  - expires_at: 초대 만료 시간

- **Camp Participants** (캠프 참여자):
  - 학생별 캠프 참여 상태 추적

#### 비즈니스 로직
```
1. 캠프 템플릿 생성
   ├─ 블록 세트 정의 (시간대)
   ├─ 슬롯 프리셋 설정 (고정된 학습 시간 패턴)
   └─ 학생 수 제한 설정

2. 학생 초대 및 참여
   ├─ 템플릿 기반 초대장 발송
   ├─ 학생 수락/거절
   ├─ 참여 확정 후 캠프 플랜 자동 생성
   └─ 캠프 중 학습 진행률 추적

3. 캠프 스케줄링
   ├─ 템플릿의 블록 세트로 캠프 기간 동안의 일별 계획 생성
   ├─ 필요시 재스케줄링 (수정)
   └─ 참여 학생 모두에게 동일 일정 적용
```

---

### 3.6 Block/Block Set 도메인 (시간 블록 관리)

#### 주요 개념
- **Block Set** (블록 세트): 일주일 단위의 시간대 템플릿
- **Block** (블록): 요일별 시간 구간 (예: 월요일 14:00-16:00)

#### 비즈니스 로직
```
1. 블록 세트 관리
   ├─ 학생별 활성 블록 세트
   ├─ 템플릿 블록 세트 (캠프용)
   └─ 블록 세트별 블록 CRUD

2. 시간 겹침 검증
   ├─ 같은 요일/학생의 블록 추가 시 시간 겹침 확인
   ├─ 겹치면 에러 반환
   └─ 수정 시 자신을 제외한 다른 블록만 검증

3. 학원 일정 통합
   ├─ 블록과 학원 일정을 함께 고려한 이용 가능 시간 계산
   └─ 스케줄러에서 학습 시간대 자동 배정 시 참조
```

---

### 3.7 Parent 도메인 (학부모 기능)

#### 주요 기능
- 자녀 학습 현황 모니터링
- 성적 조회 및 분석
- 학습 히스토리 조회
- 출석 현황 확인

#### 데이터 연결
- **Parent-Student Links** 테이블
  - is_approved: 학부모 승인 상태
  - relation: father/mother/guardian/other
  - auto_approve_settings: 자동 승인 설정

#### 비즈니스 로직
```
1. 학부모-학생 연결
   ├─ 학부모가 학생 검색 (이름/전화번호)
   ├─ 요청 발송
   ├─ 승인 대기 또는 자동 승인
   └─ 승인 후 학생 정보 접근 가능

2. 학습 현황 전시
   ├─ 연결된 학생들의 데이터만 조회
   ├─ 성적, 출석, 학습 진행률 표시
   └─ 알림 설정 (출석, 성적, 학습 완료)
```

---

### 3.8 Student 도메인 (학생 정보 관리)

#### 주요 엔티티
- **Students** 테이블
  - 기본: id, name, grade, class, phone
  - 활동: is_active (비활성화된 학생은 로그인 불가)
  - 성적: difficulty_level_id
  - 학교: school_id, desired_university_ids

- **Student Divisions** (학생 분류)
- **Student Connection Codes** (연결 코드로 학부모와 연결)

#### 비즈니스 로직
```
1. 학생 생성
   ├─ 회원가입 시 또는 관리자가 직접 등록
   ├─ 기본 학생 정보 입력
   └─ 테넌트에 속함

2. 학생 활성화/비활성화
   ├─ admin이 is_active 토글
   ├─ 비활성화 시 로그인 거부 ("계정이 비활성화되었습니다")
   └─ 활성화 시 다시 로그인 가능

3. 학생 검색 (부모용)
   ├─ 이름으로 검색
   ├─ 전화번호로 검색
   └─ 같은 테넌트의 학생만 조회
```

---

## 4. 데이터 흐름 아키텍처

### 4.1 전체 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    클라이언트 (React Components)             │
│                   (Client Components & Server)              │
└────────────────┬────────────────────────────────────────────┘
                 │
        (Server Actions, API Routes)
                 │
┌────────────────▼────────────────────────────────────────────┐
│           비즈니스 로직 레이어 (lib/domains/*)               │
│  ┌──────────────┬──────────────┬──────────────┐              │
│  │  Service     │  Repository  │  Actions     │              │
│  │  (검증,규칙) │  (쿼리 작성) │  (UI 호출)   │              │
│  └──────────────┴──────────────┴──────────────┘              │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│           데이터 접근 레이어 (lib/data/*)                    │
│              Supabase 클라이언트 호출                        │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│          데이터베이스 (Supabase PostgreSQL)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • students, parents, student_parents_links          │   │
│  │ • plan_groups, student_plan, plan_contents          │   │
│  │ • student_scores (mock_scores), internal_scores     │   │
│  │ • attendance_records, attendance_statistics         │   │
│  │ • camp_templates, camp_invitations, camp_* tables   │   │
│  │ • tenant_block_sets, tenant_blocks                  │   │
│  │ • goals, student_goals                              │   │
│  │ • master_books, master_lectures, master_contents    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Supabase 클라이언트 사용 패턴

```typescript
// 서버 컴포넌트/액션에서만 사용
import { createSupabaseServerClient } from "@/lib/supabase/server";
const supabase = await createSupabaseServerClient();
const data = await supabase.from("students").select("*");

// 클라이언트 컴포넌트에서 사용
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
const supabase = createSupabaseBrowserClient();

// RLS 우회 (서버 전용, 매우 제한적)
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const supabase = createSupabaseAdminClient();
```

### 4.3 상태 관리

- **React Query**: 서버 상태 (plans, scores, attendance 등)
- **Context API**: 클라이언트 상태 (토스트 알림, UI 상태)
- **Zustand** (선택적): 복잡한 클라이언트 상태

---

## 5. 주요 사용자 여정 (User Journeys)

### 5.1 학생: 학습 계획 생성 및 관리 여정

```
[시작: 학생 로그인]
          ↓
  [/dashboard 진입]
    - 오늘 학습 진행률 표시 (%)
    - 활성 학습 위젯 표시
    - 주요 기능 바로가기 제시
          ↓
  [/plan 페이지: 플랜 그룹 목록]
    - 기존 플랜 그룹 조회
    - 상태별 필터 (draft, saved, active 등)
    - 생성된 플랜 수 표시
          ↓
  [+ 플랜 생성 버튼]
    ├─ 기간 선택 (학습 기간)
    ├─ 약점 과목 선택 (성적 기반)
    ├─ 제외일 설정 (병가, 휴가)
    ├─ 학원 일정 설정 (학원에 다니는 경우)
    ├─ 블록 세트 선택 (시간대 템플릿)
    └─ "계획 생성" 클릭
          ↓
  [스케줄러 실행]
    ├─ 입력된 조건 검증
    ├─ 블록 기반 이용 가능 시간 계산
    ├─ 학원 일정, 제외일 고려
    ├─ 약점/강점 과목의 학습 일정 자동 배분
    └─ 일별 플랜 생성 (student_plan 레코드들)
          ↓
  [플랜 확인 및 저장]
    ├─ 생성된 일별 계획 미리보기 (날짜별)
    ├─ 수정 가능 (블록, 제외일 조정)
    └─ 저장 → 상태를 "saved"로 변경
          ↓
  [플랜 활성화]
    └─ "활성화" 버튼 클릭 → 상태를 "active"로
          ↓
  [/today 페이지: 오늘의 학습]
    ├─ 오늘 할당된 계획들 표시
    ├─ 콘텐츠(책, 강의) 표시
    ├─ 학습 시간 계시
    ├─ 진행률 입력
    └─ 완료 시 progress 업데이트
          ↓
  [학습 진행 추적]
    ├─ 일일 진행률 업데이트
    ├─ 대시보드에서 실시간 진행률 표시
    └─ 완료 시 축하 메시지 표시
```

### 5.2 학부모: 자녀 모니터링 여정

```
[회원가입: 학부모 선택]
          ↓
  [/parent/dashboard 진입]
          ↓
  [학생 연결]
    ├─ 학생 검색 (이름 또는 전화번호)
    ├─ 요청 발송
    ├─ 승인 대기 또는 자동 승인 (설정에 따라)
    └─ 승인 후 학생 정보 접근 가능
          ↓
  [자녀 학습 현황 모니터링]
    ├─ /parent/dashboard: 자녀 목록 및 진행률
    ├─ /parent/report: 상세 학습 히스토리
    ├─ /parent/scores: 성적 조회
    ├─ /parent/history: 학습 기록
    └─ /parent/settings: 알림 설정
          ↓
  [알림 수신]
    ├─ 학습 완료 알림
    ├─ 출석 알림 (SMS)
    ├─ 성적 입력 알림
    └─ 주간 학습 리포트
```

### 5.3 관리자: 학생 관리 및 모니터링 여정

```
[관리자 로그인]
          ↓
  [/admin/dashboard 진입]
    ├─ 전체 학생 현황
    ├─ 오늘 출석 현황
    ├─ 플랜 진행 상태
    └─ 성적 입력 현황
          ↓
  [학생 관리]
    └─ /admin/students
      ├─ 학생 목록 조회
      ├─ 학생 추가/수정
      ├─ 활성화/비활성화
      ├─ 학부모 연결 승인
      └─ 학생별 상세 정보
          ↓
  [플랜 관리]
    └─ /admin/plan-groups
      ├─ 학생별 플랜 그룹 조회
      ├─ 플랜 상태 모니터링
      ├─ 필요시 재스케줄링
      └─ 플랜 완료/취소 처리
          ↓
  [성적 관리]
    └─ /admin/master-books, /admin/scores
      ├─ 교재 및 강의 관리
      ├─ 학생 성적 입력/조회
      ├─ 성적 기반 플랜 추천
      └─ 성적 추이 분석
          ↓
  [출석 관리]
    └─ /admin/attendance
      ├─ 일별 출석 현황
      ├─ 지각/결석 통계
      ├─ SMS 알림 설정
      └─ 출석 기록 수정
          ↓
  [캠프 관리]
    └─ /admin/camp-templates
      ├─ 캠프 템플릿 생성
      ├─ 학생 초대
      ├─ 참여 현황 모니터링
      └─ 캠프별 학습 진행률
```

---

## 6. 핵심 비즈니스 규칙 및 검증 로직

### 6.1 플랜 생성 검증
- 시작일 < 종료일
- 최소 1개 과목 선택
- 일일 최소 학습 시간 설정 필요

### 6.2 성적 입력 검증
- 학년: 1-3
- 등급(grade_score): 1-9
- 백분위(percentile): 0-100
- 시험 날짜 필수

### 6.3 시간 블록 검증
- 같은 요일/학생의 블록 시간 겹침 방지
- 블록 추가/수정 시 검증
- 학원 일정과 중복되지 않도록 확인

### 6.4 출석 기록 검증
- 동일 학생, 동일 날짜: 1개만 존재 (수정)
- check_in_time < check_out_time
- 미래 날짜의 출석 기록 거부

### 6.5 학부모-학생 연결 검증
- 같은 테넌트 내에서만 연결 가능
- 자동 승인 설정에 따라 처리
- 한 명의 학생에게 여러 부모 연결 가능

---

## 7. 데이터베이스 핵심 테이블 구조

### 7.1 사용자 및 인증
```sql
-- auth.users (Supabase 기본)
-- id, email, phone, user_metadata (signup_role 등)

-- students
CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  grade TEXT,
  class TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  difficulty_level_id UUID,
  school_id UUID,
  desired_university_ids UUID[],
  tenant_id UUID NOT NULL
);

-- parents
CREATE TABLE parents (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  tenant_id UUID NOT NULL
);

-- parent_student_links
CREATE TABLE parent_student_links (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES parents(id),
  student_id UUID REFERENCES students(id),
  relation TEXT, -- father/mother/guardian/other
  is_approved BOOLEAN DEFAULT false,
  auto_approve_enabled BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL
);
```

### 7.2 학습 계획
```sql
-- plan_groups
CREATE TABLE plan_groups (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft/saved/active/paused/completed/cancelled
  plan_purpose TEXT,
  scheduler_options JSONB,
  tenant_id UUID NOT NULL
);

-- student_plan
CREATE TABLE student_plan (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  plan_group_id UUID REFERENCES plan_groups(id),
  plan_date DATE NOT NULL,
  progress INTEGER DEFAULT 0, -- 0-100
  status TEXT,
  subject_type TEXT,
  is_today_plan BOOLEAN DEFAULT false
);

-- plan_contents
CREATE TABLE plan_contents (
  id UUID PRIMARY KEY,
  plan_group_id UUID REFERENCES plan_groups(id),
  content_id UUID,
  display_order INTEGER,
  content_type TEXT, -- book/lecture/custom
  book_id UUID,
  lecture_id UUID
);

-- plan_exclusions
CREATE TABLE plan_exclusions (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  exclusion_date DATE NOT NULL,
  exclusion_type TEXT,
  reason TEXT
);

-- academy_schedules
CREATE TABLE academy_schedules (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  plan_group_id UUID,
  day_of_week INTEGER, -- 0-6
  start_time TIME,
  end_time TIME,
  academy_name TEXT,
  subject TEXT
);
```

### 7.3 성적
```sql
-- student_mock_scores
CREATE TABLE student_mock_scores (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  exam_date DATE NOT NULL,
  exam_title TEXT,
  grade INTEGER, -- 학년
  grade_score INTEGER, -- 등급 1-9
  percentile NUMERIC, -- 백분위 0-100
  subject_scores JSONB,
  tenant_id UUID NOT NULL
);
```

### 7.4 출석
```sql
-- attendance_records
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  status TEXT, -- present/absent/late
  check_in_method TEXT, -- qr_code/manual/api
  check_out_method TEXT,
  notes TEXT,
  tenant_id UUID NOT NULL
);

-- attendance_statistics
CREATE TABLE attendance_statistics (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  month DATE,
  present_count INTEGER DEFAULT 0,
  absent_count INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0
);
```

### 7.5 캠프
```sql
-- camp_templates
CREATE TABLE camp_templates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  camp_name TEXT NOT NULL,
  program_type TEXT,
  status TEXT DEFAULT 'draft', -- draft/active/archived
  block_sets JSONB
);

-- camp_invitations
CREATE TABLE camp_invitations (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  template_id UUID REFERENCES camp_templates(id),
  status TEXT DEFAULT 'pending', -- pending/accepted/declined/expired
  expires_at TIMESTAMP
);

-- camp_participants
CREATE TABLE camp_participants (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  camp_id UUID,
  joined_at TIMESTAMP,
  status TEXT
);
```

### 7.6 시간 블록
```sql
-- tenant_block_sets
CREATE TABLE tenant_block_sets (
  id UUID PRIMARY KEY,
  student_id UUID, -- null for template
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  tenant_id UUID NOT NULL
);

-- tenant_blocks
CREATE TABLE tenant_blocks (
  id UUID PRIMARY KEY,
  block_set_id UUID REFERENCES tenant_block_sets(id),
  day_of_week INTEGER, -- 0-6
  start_time TIME,
  end_time TIME,
  display_order INTEGER
);
```

---

## 8. 보안 및 RLS (Row Level Security)

### 8.1 역할 기반 접근 제어
- **학생**: 자신의 데이터만 접근 (student_id 필터)
- **부모**: 연결된 자녀의 데이터만 접근 (parent_student_links 검증)
- **관리자**: 같은 테넌트의 모든 학생 데이터
- **슈퍼관리자**: 전체 시스템 접근

### 8.2 RLS 정책 예시
```sql
-- students 테이블
CREATE POLICY "Students can view own data"
  ON students FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Parents can view linked students"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid()
        AND student_id = students.id
        AND is_approved = true
    )
  );

CREATE POLICY "Admins can view tenant students"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
        AND tenant_id = students.tenant_id
    )
  );
```

---

## 9. 핵심 API 및 Server Actions

### 9.1 Plan Actions
```typescript
// Plan Group CRUD
createPlanGroup(data) → PlanGroup 생성
updatePlanGroup(groupId, updates) → 수정
deletePlanGroup(groupId) → soft delete
updatePlanGroupStatus(groupId, newStatus) → 상태 변경

// Student Plan CRUD
createStudentPlan(plan) → 일별 계획 생성
createStudentPlans(plans[]) → 일괄 생성
updateStudentPlan(planId, updates) → 수정
deleteStudentPlan(planId) → 삭제
updateProgress(planId, progress) → 진행률 업데이트

// Plan Content
savePlanContents(groupId, contents[]) → 콘텐츠 저장 (덮어쓰기)

// Plan Exclusion
createPlanExclusion(exclusion) → 제외일 추가
deletePlanExclusion(exclusionId) → 제외일 삭제
```

### 9.2 Score Actions
```typescript
createMockScore(input) → 모의고사 성적 생성
updateMockScore(scoreId, updates) → 수정
deleteMockScore(scoreId) → 삭제
getMockScores(studentId, filters) → 조회
```

### 9.3 Attendance Actions
```typescript
recordAttendance(input) → 출석 기록 (생성/수정)
getAttendanceRecords(filters) → 조회
getAttendanceStatistics(studentId, month) → 통계
```

### 9.4 Camp Actions
```typescript
createCampTemplate(data) → 캠프 템플릿 생성
inviteStudentsToCamp(templateId, studentIds[]) → 초대
acceptCampInvitation(invitationId) → 수락
getCampParticipants(templateId) → 참여자 조회
```

---

## 10. 멀티테넌트 구조

### 10.1 테넌트 분리
- 모든 주요 테이블에 `tenant_id` 컬럼
- 쿼리 시 항상 `tenant_id` 필터 적용
- 테넌트 간 데이터 누수 방지

### 10.2 테넌트 컨텍스트
```typescript
// 서버 컴포넌트/액션에서
const tenantContext = await getTenantContext();
const { tenantId } = tenantContext;

// 쿼리 시
await supabase
  .from("students")
  .select("*")
  .eq("tenant_id", tenantId);
```

---

## 11. 실시간 기능 (Supabase Realtime)

### 11.1 구현된 Realtime 기능
- 출석 기록 실시간 동기화
- 학습 진행률 실시간 업데이트
- 캠프 초대 실시간 알림

### 11.2 구독 패턴
```typescript
supabase
  .channel(`student_plans:${studentId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'student_plan' },
    (payload) => {
      // UI 업데이트
      updateProgress(payload.new);
    }
  )
  .subscribe();
```

---

## 12. 디렉토리 구조

```
lib/domains/
├── plan/           # 학습 계획 도메인
│   ├── actions/    # Server Actions
│   ├── queries/    # React Query 쿼리
│   ├── repository/ # 데이터 접근 레이어
│   └── types.ts    # 타입 정의
├── score/          # 성적 도메인
├── attendance/     # 출석 도메인
├── camp/           # 캠프 도메인
├── student/        # 학생 도메인
├── parent/         # 학부모 도메인
└── block/          # 시간 블록 도메인

app/
├── (student)/      # 학생 라우트 그룹
│   ├── dashboard/
│   ├── today/
│   ├── plan/
│   └── scores/
├── (admin)/        # 관리자 라우트 그룹
│   └── admin/
├── (parent)/       # 학부모 라우트 그룹
│   └── parent/
└── (superadmin)/   # 슈퍼관리자 라우트 그룹
    └── superadmin/
```

---

## 13. 결론

**EduaTalk(TimeLevelUp)**는 학생 중심의 통합 학습 관리 시스템으로:

1. **학생**: 성적 기반 맞춤형 학습 플랜 자동 생성 및 일일 진행 추적
2. **부모**: 자녀 학습 현황 실시간 모니터링 및 성적 관리
3. **관리자**: 전체 학생 관리, 플랜 검토, 콘텐츠 큐레이션
4. **슈퍼관리자**: 멀티테넌트 운영 및 시스템 설정

### 핵심 강점
- 자동 스케줄링으로 복잡한 시간 제약 조건 처리
- 실시간 진행률 추적 및 시각화
- 멀티테넌트 아키텍처로 확장성
- Row Level Security로 데이터 보안
- React Query 캐싱으로 성능 최적화

### 기술적 특징
- Next.js 16 App Router의 Server Actions로 백엔드 간편화
- TypeScript로 타입 안전성 확보
- Supabase로 인증, DB, Realtime 통합
- Tailwind CSS 4로 반응형 UI
