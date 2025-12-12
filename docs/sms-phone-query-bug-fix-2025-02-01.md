# SMS 전화번호 조회 버그 수정 및 코드 최적화

**작업 일자**: 2025-02-01  
**작업 내용**: students 테이블에 없는 컬럼 조회 버그 수정 및 중복 코드 제거

## 문제 분석

### 핵심 문제
- `app/actions/smsActions.ts`의 `sendAttendanceSMSInternal` 함수가 `students` 테이블에서 `mother_phone`, `father_phone`을 조회하려고 시도
- 실제 데이터베이스 스키마: `students` 테이블에는 해당 컬럼이 없고, `student_profiles` 테이블에만 존재
- 에러: `column students.mother_phone does not exist`

### 데이터베이스 스키마 확인 결과
- `students` 테이블: `mother_phone`, `father_phone`, `phone` 컬럼 없음
- `student_profiles` 테이블: `mother_phone`, `father_phone`, `phone` 컬럼 존재

### 중복 코드 발견
1. `sendAttendanceSMSInternal` (102-106줄): 잘못된 테이블 조회
2. `sendBulkAttendanceSMS` (248-280줄): 올바른 구현 (student_profiles 조회 포함)
3. `sendBulkGeneralSMS` (444-507줄): 올바른 구현 (student_profiles 조회 포함)

## 수정 내용

### 1. 공통 헬퍼 함수 생성
**파일**: `lib/utils/studentPhoneUtils.ts` (신규 생성)

학생 전화번호 조회 로직을 공통 함수로 추출:
- `getStudentPhones(studentId: string)`: 단일 학생 전화번호 조회
- `getStudentPhonesBatch(studentIds: string[])`: 여러 학생 전화번호 일괄 조회

**구현 패턴**:
- `students` 테이블에서 기본 정보(`id`, `name`) 조회
- `student_profiles` 테이블에서 전화번호 정보 조회
- 두 결과를 병합하여 반환 (student_profiles 우선, 없으면 null)

### 2. sendAttendanceSMSInternal 함수 수정
**변경 사항**:
- 기존: `students` 테이블에서 `mother_phone`, `father_phone` 직접 조회
- 수정: 공통 헬퍼 함수 `getStudentPhones` 사용
- `students` 테이블에서는 `id`, `name`만 조회
- `student_profiles` 테이블에서 전화번호 조회 후 병합

### 3. 중복 코드 제거 및 최적화
**변경 사항**:
- `sendBulkAttendanceSMS`: 공통 헬퍼 함수 `getStudentPhonesBatch` 사용
- `sendBulkGeneralSMS`: 공통 헬퍼 함수 `getStudentPhonesBatch` 사용
- 중복된 전화번호 조회 로직 제거 (약 60줄 코드 제거)

## 수정된 파일

1. **lib/utils/studentPhoneUtils.ts** (신규)
   - `getStudentPhones`: 단일 학생 전화번호 조회 함수
   - `getStudentPhonesBatch`: 여러 학생 전화번호 일괄 조회 함수

2. **app/actions/smsActions.ts**
   - `sendAttendanceSMSInternal`: 공통 헬퍼 함수 사용으로 수정
   - `sendBulkAttendanceSMS`: 중복 코드 제거 및 공통 헬퍼 함수 사용
   - `sendBulkGeneralSMS`: 중복 코드 제거 및 공통 헬퍼 함수 사용

## 개선 효과

1. **버그 수정**: `students` 테이블에 없는 컬럼 조회 오류 해결
2. **코드 중복 제거**: 약 60줄의 중복 코드 제거
3. **유지보수성 향상**: 전화번호 조회 로직이 한 곳에 집중되어 수정이 용이
4. **일관성 향상**: 모든 SMS 발송 함수가 동일한 방식으로 전화번호 조회

## 테스트

- 린터 오류 없음 확인
- TypeScript 타입 체크 통과
- 기존 API 인터페이스 유지 (하위 호환성 보장)

## 참고 사항

- `lib/data/studentProfiles.ts`의 `getStudentProfileById` 함수는 이미 존재하지만, 전화번호만 필요한 경우에는 새로운 헬퍼 함수가 더 효율적
- `sendBulkAttendanceSMS`와 `sendBulkGeneralSMS`의 전화번호 조회 로직이 거의 동일하므로 공통화 완료

