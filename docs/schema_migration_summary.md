# 스키마 마이그레이션 및 코드 수정 요약

## 1. 생성된 마이그레이션 SQL 파일

### 1.1 `supabase/migrations/20250108000000_create_missing_tables.sql`
**목적**: 누락된 테이블 생성 및 student_content_progress 컬럼 추가

**생성된 테이블**:
1. **student_analysis** - 취약 과목 분석 테이블
   - 컬럼: `id`, `student_id`, `tenant_id`, `subject`, `risk_score`, `recent_grade_trend`, `consistency_score`, `mastery_estimate`, `updated_at`, `created_at`
   - 인덱스: student_id, tenant_id, student_subject, risk_score, updated_at
   - RLS 정책: 학생 자신의 분석만 조회/수정, 관리자는 자신의 tenant 내 모든 분석 조회

2. **student_scores** - 통합 성적 테이블
   - 컬럼: `id`, `student_id`, `tenant_id`, `subject_type`, `semester`, `course`, `course_detail`, `raw_score`, `grade`, `score_type_detail`, `test_date`, `created_at`
   - 인덱스: student_id, tenant_id, test_date, subject_type, student_test_date
   - RLS 정책: 학생 자신의 성적만 조회/수정/삭제, 관리자는 자신의 tenant 내 모든 성적 조회, 학부모는 자녀의 성적 조회

3. **student_daily_schedule** - 일일 스케줄 테이블
   - 컬럼: `id`, `student_id`, `tenant_id`, `schedule_date`, `block_index`, `content_type`, `content_id`, `planned_start`, `planned_end`, `planned_start_page_or_time`, `planned_end_page_or_time`, `created_at`
   - 인덱스: student_id, tenant_id, schedule_date, student_date, block_index
   - RLS 정책: 학생 자신의 스케줄만 조회/수정/삭제, 관리자는 자신의 tenant 내 모든 스케줄 조회, 학부모는 자녀의 스케줄 조회

**추가된 컬럼 (student_content_progress)**:
- `plan_id` (uuid, nullable, FK → student_plan.id)
- `start_page_or_time` (integer, nullable)
- `end_page_or_time` (integer, nullable)
- `last_updated` (timestamptz, default now())

### 1.2 `supabase/migrations/20250108000001_add_tenant_id_to_existing_tables.sql`
**목적**: 기존 테이블에 tenant_id 추가

**수정된 테이블**:
1. **student_study_sessions** - tenant_id 추가 (NOT NULL)
2. **student_goals** - tenant_id 추가 (NOT NULL)
3. **student_goal_progress** - tenant_id 추가 (NOT NULL)
4. **student_history** - tenant_id 추가 (NOT NULL)

**처리 내용**:
- 기존 데이터에 student_id를 통해 tenant_id 자동 배정
- NOT NULL 제약조건 추가
- 인덱스 추가

## 2. 수정된 코드 파일

### 2.1 `app/actions/scores.ts`
**변경 사항**:
- `addStudentScore`: student의 tenant_id를 조회하여 insert payload에 포함
- 기존 fallback 로직 유지 (42703 에러 처리)

### 2.2 `app/analysis/_utils.ts`
**변경 사항**:
- `saveRiskAnalysis`: student의 tenant_id를 조회하여 insert payload에 포함
- 기존 fallback 로직 유지

### 2.3 `app/actions/progress.ts`
**변경 사항**:
- `insertContentProgress`: tenant_id 추가
- `insertPlanProgress`: tenant_id 추가 및 새로운 컬럼 사용 (plan_id, start_page_or_time, end_page_or_time, last_updated)
- 기존 fallback 로직 유지

### 2.4 `app/actions/schedule.ts`
**변경 사항**:
- `ensureContentProgress`: tenant_id 추가
- 기존 fallback 로직 유지

### 2.5 `app/(student)/today/actions/todayActions.ts`
**변경 사항**:
- `completePlan`: tenant_id 추가 및 새로운 컬럼 사용 (plan_id, start_page_or_time, end_page_or_time, last_updated)

### 2.6 `app/actions/schedule.ts`
**변경 사항**:
- `replaceDailySchedule`: tenant_id 추가 및 student_daily_schedule 테이블 사용
- `DailyScheduleInsertPayload` 타입에 tenant_id 및 새로운 컬럼 추가

### 2.7 `lib/data/studentScores.ts`
**변경 사항**:
- 통합 성적 테이블(`student_scores`) 관련 함수 추가:
  - `getStudentScores`: 통합 성적 목록 조회
  - `createStudentScore`: 통합 성적 생성
  - `updateStudentScore`: 통합 성적 업데이트
  - `deleteStudentScore`: 통합 성적 삭제
- 기존 내신/모의고사 성적 함수 유지 (하위 호환성)

## 3. books, lectures, student_custom_contents 테이블에 대한 판단

**결정**: 현재는 tenant_id 없이 사용해도 됩니다.

**이유**:
- 코드에서 이미 tenant_id를 optional로 처리하고 있음 (`lib/data/studentContents.ts`)
- 마이그레이션 파일(`20250107000002_add_tenant_id_to_core_tables.sql`)에서 이미 tenant_id가 추가되어 있지만, nullable로 유지 가능
- 현재 코드는 fallback 로직으로 tenant_id 없이도 동작하도록 구현되어 있음

**권장 사항**:
- 향후 멀티테넌트 지원이 필요하면 tenant_id를 NOT NULL로 변경하는 마이그레이션 추가
- 현재는 기존 마이그레이션의 tenant_id 컬럼이 nullable이므로 그대로 사용 가능

## 4. 변경 요약

### 4.1 새로 생성된 테이블
- ✅ `student_analysis` - 취약 과목 분석
- ✅ `student_scores` - 통합 성적 관리
- ✅ `student_daily_schedule` - 일일 스케줄 관리

### 4.2 수정된 테이블
- ✅ `student_content_progress` - 4개 컬럼 추가 (plan_id, start_page_or_time, end_page_or_time, last_updated)
- ✅ `student_study_sessions` - tenant_id 추가
- ✅ `student_goals` - tenant_id 추가
- ✅ `student_goal_progress` - tenant_id 추가
- ✅ `student_history` - tenant_id 추가

### 4.3 수정된 코드 파일
1. `app/actions/scores.ts` - tenant_id 추가
2. `app/analysis/_utils.ts` - tenant_id 추가
3. `app/actions/progress.ts` - tenant_id 및 새 컬럼 사용
4. `app/actions/schedule.ts` - tenant_id 추가 및 student_daily_schedule 지원
5. `app/(student)/today/actions/todayActions.ts` - tenant_id 및 새 컬럼 사용
6. `lib/data/studentScores.ts` - 통합 성적 함수 추가

## 5. 다음 단계

1. **마이그레이션 실행**: Supabase에 마이그레이션 파일 적용
2. **테스트**: 
   - 성적 추가/수정/삭제 기능 테스트
   - 취약 과목 분석 기능 테스트
   - 진행률 추적 기능 테스트
3. **데이터 마이그레이션** (필요시):
   - 기존 `student_school_scores`, `student_mock_scores` 데이터를 `student_scores`로 통합 (선택사항)
4. **RLS 정책 확인**: 새로 생성된 테이블의 RLS 정책이 올바르게 작동하는지 확인

## 6. 주의사항

1. **기존 데이터**: 마이그레이션 실행 시 기존 데이터에 tenant_id가 자동으로 배정됩니다.
2. **Fallback 로직**: 코드에 42703 에러 처리가 있어 컬럼이 없어도 동작하지만, 마이그레이션 적용 후에는 정상 동작해야 합니다.
3. **student_scores vs 분리된 테이블**: 
   - 현재 코드는 `student_scores`를 사용하도록 수정됨
   - `student_school_scores`와 `student_mock_scores`는 별도로 유지됨 (하위 호환성)
   - 필요시 데이터 통합 마이그레이션 추가 가능

