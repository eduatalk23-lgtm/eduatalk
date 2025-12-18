# 학생 삭제 기능 하드 삭제 변경 및 최적화 작업 문서

## 작업 개요

학생 삭제 기능을 소프트 삭제(`is_active = false`)에서 실제 DB 삭제(하드 삭제)로 변경하고, SMS 발송 페이지 등에서 삭제된 학생이 조회되지 않도록 수정했습니다.

## 작업 일자

2025년 1월 31일

## 문제 분석

### 발견된 문제점

1. **삭제 기능**: `deleteStudent` 함수가 소프트 삭제만 수행하여 실제로 DB에 데이터가 남아있음
2. **SMS 발송**: 삭제 처리한 학생이 SMS 발송 기능에서 조회됨 (`is_active` 필터 누락)
3. **외래 키 제약조건**: 일부 테이블이 NO ACTION으로 설정되어 삭제 시 오류 발생 가능

### 외래 키 제약조건 분석

**CASCADE** (자동 삭제됨):
- 대부분의 테이블이 CASCADE로 설정되어 있어 students 삭제 시 자동으로 관련 데이터가 삭제됨

**NO ACTION** (수동 처리 필요):
- `student_internal_scores` - 내신 성적
- `student_mock_scores` - 모의고사 성적
- `student_score_analysis_cache` - 성적 분석 캐시
- `student_score_events` - 성적 이벤트 로그
- `student_terms` - 학기 정보

**SET NULL**: 
- `make_scenario_logs` - 문제 없음

## 수정 내용

### 1. 삭제 함수 변경

**파일**: `app/(admin)/actions/studentManagementActions.ts`

#### `deleteStudent` 함수

- 실제 DB 삭제로 변경
- NO ACTION 제약조건이 있는 테이블들을 먼저 삭제하는 순서로 구현
- 삭제 순서:
  1. `student_score_analysis_cache`
  2. `student_score_events`
  3. `student_internal_scores`
  4. `student_mock_scores`
  5. `student_terms`
  6. `auth.users` (auth.admin.deleteUser)
  7. `students` (CASCADE로 나머지 자동 삭제)

#### `bulkDeleteStudents` 함수

- 각 학생에 대해 `deleteStudent`와 동일한 프로세스 수행
- 일괄 삭제 시 에러 처리 강화

### 2. SMS 발송 페이지 필터 추가

**파일 1**: `app/(admin)/admin/sms/send/page.tsx`
- `.eq("is_active", true)` 필터 추가

**파일 2**: `app/(admin)/admin/sms/page.tsx`
- `.eq("is_active", true)` 필터 추가

### 3. 공통 유틸리티 함수 생성

**파일**: `lib/data/students.ts`

`getActiveStudentsForSMS()` 함수 추가:
- SMS 발송용 활성화된 학생 목록 조회
- `is_active` 필터를 자동으로 적용
- 동적으로 필드 확인하여 조회 (컬럼 존재 여부 확인)
- 두 SMS 페이지에서 중복 코드 제거

### 4. 관련 페이지 수정

**보고서 페이지** (`app/(admin)/admin/reports/page.tsx`):
- 활성화된 학생만 조회하도록 `is_active` 필터 추가

**대시보드 페이지** (`app/(admin)/admin/dashboard/page.tsx`):
- 전체 학생 수 카운트 시 활성화된 학생만 포함
- 위험 학생 조회 함수에도 `is_active` 필터 추가

## 코드 변경 요약

### 수정된 파일

1. `app/(admin)/actions/studentManagementActions.ts`
   - `deleteStudent`: 하드 삭제로 변경
   - `bulkDeleteStudents`: 하드 삭제로 변경

2. `app/(admin)/admin/sms/send/page.tsx`
   - `is_active` 필터 추가
   - 공통 함수 사용으로 리팩토링

3. `app/(admin)/admin/sms/page.tsx`
   - `is_active` 필터 추가
   - 공통 함수 사용으로 리팩토링

4. `lib/data/students.ts`
   - `getActiveStudentsForSMS()` 함수 추가

5. `app/(admin)/admin/reports/page.tsx`
   - `is_active` 필터 추가

6. `app/(admin)/admin/dashboard/page.tsx`
   - `is_active` 필터 추가 (여러 위치)

## 테스트 필요 사항

### 기능 테스트

1. **단일 학생 삭제 테스트**
   - 삭제된 학생이 DB에서 완전히 제거되는지 확인
   - 관련 데이터가 올바른 순서로 삭제되는지 확인
   - 외래 키 제약조건 위반이 발생하지 않는지 확인

2. **일괄 학생 삭제 테스트**
   - 여러 학생을 한 번에 삭제했을 때 정상 작동하는지 확인
   - 일부 실패 시 에러 처리 확인

3. **SMS 발송 페이지 테스트**
   - 삭제된 학생이 SMS 발송 대상 목록에 나타나지 않는지 확인
   - 활성화된 학생만 목록에 표시되는지 확인

4. **기타 페이지 테스트**
   - 보고서 페이지에서 삭제된 학생이 나타나지 않는지 확인
   - 대시보드 통계에서 삭제된 학생이 제외되는지 확인

### 데이터 무결성 확인

- 삭제 후 관련 테이블에 orphaned 레코드가 없는지 확인
- NO ACTION 제약조건이 있는 테이블들이 올바르게 삭제되는지 확인

## 주의사항

1. **데이터 백업**: 실제 삭제 전 데이터 백업 권장
2. **트랜잭션**: 여러 테이블 삭제 시 트랜잭션 사용 고려 (현재는 순차 처리)
3. **에러 핸들링**: NO ACTION 제약조건 위반 시 명확한 에러 메시지 제공
4. **RLS 정책**: 삭제 시 RLS 정책 확인 필요
5. **역할 확인**: 관리자만 삭제 가능하도록 권한 체크 유지

## 향후 개선 사항

1. **트랜잭션 적용**: 여러 테이블 삭제 시 트랜잭션을 사용하여 원자성 보장
2. **소프트 삭제 옵션**: 필요에 따라 소프트 삭제와 하드 삭제를 선택할 수 있는 옵션 추가 검토
3. **삭제 로그**: 학생 삭제 이력을 별도 테이블에 기록하는 기능 추가 검토
4. **일괄 삭제 최적화**: 일괄 삭제 시 배치 처리로 성능 개선 검토

## 참고 자료

- Supabase JS 문서: 삭제 작업 모범 사례
- 외래 키 제약조건: CASCADE vs NO ACTION 처리 방법
- Next.js 15: Server Actions 패턴

