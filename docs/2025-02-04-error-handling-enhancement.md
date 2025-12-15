# 에러 핸들링 고도화 구현 완료

## 구현 날짜
2025-02-04

## 목표
1. Global Error Boundary 설정으로 전역 에러 처리
2. 플랜 생성 실패 시 구체적인 실패 원인을 사용자에게 제공하는 에러 메시지 매핑 시스템 구축

## 구현 내용

### Phase 1: Global Error Boundary 설정

#### 1.1 GlobalErrorBoundary 컴포넌트 생성
- **파일**: `components/errors/GlobalErrorBoundary.tsx`
- **기능**:
  - React Error Boundary 구현
  - 에러 로깅 통합 (`lib/errors/handler.ts`의 `logError` 사용)
  - 사용자 친화적인 에러 UI 표시
  - 개발 환경에서 상세 에러 정보 표시
- **통합**: `app/layout.tsx`의 `Providers` 내부에 추가

#### 1.2 ErrorPage 공통 컴포넌트 생성
- **파일**: `components/errors/ErrorPage.tsx`
- **기능**:
  - Next.js error.tsx에서 사용하는 공통 에러 페이지 컴포넌트
  - 역할별로 다른 대시보드 링크 제공
  - 에러 로깅 통합

#### 1.3 error.tsx 중복 제거
- `app/(student)/error.tsx`, `app/(admin)/error.tsx`, `app/(parent)/error.tsx`에서 공통 컴포넌트 사용
- 중복 코드 제거 및 일관성 향상

### Phase 2: 플랜 생성 실패 원인 분석 시스템

#### 2.1 플랜 생성 실패 원인 타입 정의
- **파일**: `lib/errors/planGenerationErrors.ts` (신규)
- **타입 정의**:
  - `insufficient_time`: 학습 시간 부족
  - `insufficient_slots`: 학습 슬롯 부족
  - `no_study_days`: 학습일 없음
  - `content_allocation_failed`: 콘텐츠 배정 실패
  - `range_division_failed`: 학습 범위 분할 실패
  - `no_plans_generated`: 플랜 생성 실패
  - `unknown`: 알 수 없는 오류

#### 2.2 에러 메시지 매핑 시스템
- `getPlanGenerationErrorMessage`: 실패 원인을 사용자 친화적인 메시지로 변환
- `combineFailureReasons`: 여러 실패 원인을 하나의 메시지로 통합
- `calculateWeekNumber`: 날짜를 주차로 변환
- `getDayOfWeekName`: 요일 번호를 한국어 요일로 변환

#### 2.3 SchedulerEngine 에러 분석 로직 추가
- **파일**: `lib/scheduler/SchedulerEngine.ts` 수정
- **기능**:
  - `generateStudyDayPlans`에서 시간 부족 감지 시 구체적인 정보 수집
  - `allocateContentDates`에서 콘텐츠 배정 실패 시 원인 분석
  - `divideContentRanges`에서 범위 분할 실패 시 원인 분석
  - 실패 원인을 `PlanGenerationFailureReason` 타입으로 수집
  - `getFailureReasons()` 메서드로 실패 원인 반환

### Phase 3: 에러 메시지 통합 및 전달

#### 3.1 PlanGroupError 확장
- **파일**: `lib/errors/planGroupErrors.ts` 수정
- **변경사항**:
  - `PlanGroupError`에 `failureReason?: PlanGenerationFailureReason | PlanGenerationFailureReason[]` 필드 추가
  - 실패 원인을 포함한 에러 생성 가능

#### 3.2 generatePlansFromGroup 에러 처리 개선
- **파일**: `lib/plan/scheduler.ts` 수정
- **변경사항**:
  - `generatePlansFromGroup`을 async 함수로 변경
  - `generate1730TimetablePlans`에서 실패 원인 반환
  - 플랜이 비어있을 때 실패 원인을 포함한 `PlanGroupError` throw
  - 학습 가능한 날짜가 없을 때 구체적인 에러 메시지 제공

#### 3.3 플랜 생성 함수 에러 처리 개선
- **파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts` 수정
- **변경사항**:
  - `generatePlansFromGroup` 호출 시 에러 발생 시 실패 원인 분석
  - `PlanGroupError`의 `failureReason`을 사용하여 구체적인 에러 메시지 전달
  - 사용자에게 구체적인 실패 원인 제공 (예: "3주차 화요일 학습 시간 부족")

### Phase 4: 중복 코드 최적화

#### 4.1 ErrorBoundary 통합
- **파일**: `components/errors/ErrorBoundary.tsx` (신규)
- **기능**:
  - 재사용 가능한 ErrorBoundary 컴포넌트
  - 에러 로깅 통합
  - 개발 환경에서 상세 에러 정보 표시
- **기존 사용처**: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`에서 공통 컴포넌트 사용
- **삭제**: `app/(student)/plan/group/[id]/_components/ErrorBoundary.tsx` 삭제

## 주요 변경 사항

### 신규 파일
1. `components/errors/GlobalErrorBoundary.tsx` - 전역 에러 바운더리
2. `components/errors/ErrorPage.tsx` - 공통 에러 페이지 컴포넌트
3. `components/errors/ErrorBoundary.tsx` - 재사용 가능한 에러 바운더리
4. `lib/errors/planGenerationErrors.ts` - 플랜 생성 실패 원인 타입 및 메시지 매핑

### 수정 파일
1. `app/layout.tsx` - GlobalErrorBoundary 추가
2. `app/(student)/error.tsx` - 공통 컴포넌트 사용
3. `app/(admin)/error.tsx` - 공통 컴포넌트 사용
4. `app/(parent)/error.tsx` - 공통 컴포넌트 사용
5. `lib/scheduler/SchedulerEngine.ts` - 에러 분석 로직 추가
6. `lib/errors/planGroupErrors.ts` - PlanGenerationFailureReason 통합
7. `lib/plan/scheduler.ts` - 에러 처리 개선
8. `app/(student)/actions/plan-groups/generatePlansRefactored.ts` - 에러 처리 개선
9. `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx` - 공통 ErrorBoundary 사용

### 삭제 파일
1. `app/(student)/plan/group/[id]/_components/ErrorBoundary.tsx` - 공통 컴포넌트로 대체

## 사용 예시

### 플랜 생성 실패 시 구체적인 에러 메시지

이전:
```
플랜 생성에 실패했습니다. 설정을 확인하고 다시 시도해주세요.
```

이후:
```
3주차 화요일(2025-01-15) 학습 시간이 부족합니다. 필요한 시간: 120분, 사용 가능한 시간: 90분 (부족: 30분)
```

또는 여러 원인이 있는 경우:
```
플랜 생성에 실패했습니다. 다음 문제가 발견되었습니다:

1. 3주차 화요일(2025-01-15) 학습 시간이 부족합니다. 필요한 시간: 120분, 사용 가능한 시간: 90분 (부족: 30분)
2. 콘텐츠 배정에 실패했습니다. 콘텐츠 ID: abc-123, 유형: book, 원인: 학습일이 배정되지 않았습니다
```

## 테스트 시나리오

1. **학습 시간 부족**: 학습 시간이 부족한 경우 구체적인 날짜와 부족한 시간 표시
2. **슬롯 부족**: 학습 슬롯이 부족한 경우 구체적인 날짜와 부족한 슬롯 수 표시
3. **학습일 없음**: 학습 가능한 날짜가 없는 경우 기간과 제외일 정보 표시
4. **콘텐츠 배정 실패**: 콘텐츠 배정에 실패한 경우 콘텐츠 ID와 원인 표시
5. **범위 분할 실패**: 학습 범위 분할에 실패한 경우 콘텐츠 정보와 배정된 날짜 수 표시

## 향후 개선 사항

1. 에러 트래킹 서비스 통합 (Sentry, LogRocket 등)
2. 에러 발생 시 자동 복구 로직 추가
3. 사용자 피드백 수집 시스템 구축
4. 에러 통계 대시보드 구축

