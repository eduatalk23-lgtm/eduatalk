# 작업 일지: student_history 테이블 tenant_id NOT NULL 제약조건 에러 수정

## 날짜
2025-01-13

## 문제 상황
터미널에서 다음 에러가 발생했습니다:
```
[history] study_session 기록 실패: {
  code: '23502',
  details: null,
  hint: null,
  message: 'null value in column "tenant_id" of relation "student_history" violates not-null constraint'
}
```

## 원인 분석
1. `lib/history/record.ts`의 `recordHistory` 함수에서 `student_history` 테이블에 데이터를 삽입할 때 `tenant_id`를 포함하지 않았습니다.
2. 데이터베이스 마이그레이션 파일을 확인한 결과, `student_history` 테이블의 `tenant_id` 컬럼은 NOT NULL 제약조건이 있습니다.
3. 따라서 `tenant_id`를 반드시 포함해야 합니다.

## 해결 방법

### 1. `recordHistory` 함수 수정
- `tenantId`를 옵셔널 파라미터로 추가했습니다.
- `tenantId`가 제공되지 않은 경우, `studentId`를 통해 `students` 테이블에서 `tenant_id`를 자동으로 조회합니다.
- 이렇게 하면 기존 호출부를 모두 수정하지 않아도 동작합니다.

### 2. 주요 호출부 수정
성능 향상을 위해 이미 `tenantContext`를 가지고 있는 주요 호출부에서 `tenantId`를 전달하도록 수정했습니다:

- `app/(student)/actions/studySessionActions.ts`: `endStudySession` 함수
- `app/(student)/actions/goalActions.ts`: `createGoalAction`, `recordGoalProgressAction` 함수
- `app/(student)/actions/scoreActions.ts`: `addSchoolScore`, `addMockScore` 함수

## 수정된 파일
1. `lib/history/record.ts`: `recordHistory` 함수에 `tenantId` 파라미터 추가 및 자동 조회 로직 추가
2. `app/(student)/actions/studySessionActions.ts`: `recordHistory` 호출 시 `tenantId` 전달
3. `app/(student)/actions/goalActions.ts`: `recordHistory` 호출 시 `tenantId` 전달
4. `app/(student)/actions/scoreActions.ts`: `recordHistory` 호출 시 `tenantId` 전달

## 참고사항
- `app/actions` 폴더의 파일들(`scores.ts`, `progress.ts`, `autoSchedule.ts`)은 수정하지 않았습니다. 이 파일들은 `recordHistory` 함수 내부에서 자동으로 `tenant_id`를 조회하므로 정상 동작합니다.
- `lib/risk/engine.ts`의 `getStudentRiskScore` 함수도 마찬가지로 자동 조회를 사용합니다.

## 커밋
- 커밋 해시: (최신 커밋)
- 커밋 메시지: `fix: student_history 테이블에 tenant_id 필수값 추가`

