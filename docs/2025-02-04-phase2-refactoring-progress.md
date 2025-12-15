# Phase 2: 핵심 로직 리팩토링 진행 상황

## 완료된 작업

### 2-1. SchedulerEngine 클래스화 (1730 로직 캡슐화) ✅

#### 생성된 파일
- `lib/scheduler/SchedulerEngine.ts` - 1730 타임테이블 스케줄링 엔진 클래스

#### 주요 구현 내용
- **SchedulerContext 타입 정의**: 스케줄링에 필요한 모든 컨텍스트 정보를 포함
- **SchedulerEngine 클래스**: 
  - `calculateCycle()`: 학습일/복습일 주기 계산
  - `allocateContentDates()`: 콘텐츠별 날짜 배정 (전략/취약 과목 로직 포함)
  - `divideContentRanges()`: 학습 범위 분할
  - `assignTimeSlots()`: 시간 슬롯 배정 (Bin Packing 알고리즘 유사)
  - `generate()`: 최종 실행 메서드
- **캐싱 메커니즘**: 계산 결과를 메모이제이션하여 성능 최적화
- **에러 처리**: 각 단계별 검증 및 경고 로깅

#### 마이그레이션 완료
- `lib/plan/scheduler.ts`의 `generate1730TimetablePlans` 함수를 SchedulerEngine 사용으로 변경
- 기존 함수는 하위 호환성을 위해 유지하되, 내부적으로 SchedulerEngine 사용
- `@deprecated` 주석 추가하여 향후 제거 예정임을 명시

#### 개선 사항
- 800+ 줄의 거대한 함수를 클래스 메서드로 분해하여 가독성 향상
- 중복 코드 제거 (시간 변환 함수, 콘텐츠 소요시간 계산 등)
- 단일 책임 원칙 적용: 각 메서드가 명확한 책임을 가짐

### 2-2. Plan Wizard Context 도입 (진행 중)

#### 생성된 파일
- `app/(student)/plan/new-group/_components/PlanWizardContext.tsx` - Context 및 Provider

#### 주요 구현 내용
- **WizardState 타입**: 위저드 상태를 중앙화
  - `wizardData`: 위저드 데이터
  - `currentStep`: 현재 단계
  - `validationErrors`: 검증 오류 목록
  - `validationWarnings`: 검증 경고 목록
  - `fieldErrors`: 필드별 오류 맵
  - `draftGroupId`: 임시 저장 그룹 ID
  - `isSubmitting`: 제출 중 여부
- **WizardAction 타입**: 상태 변경 액션 정의
  - `UPDATE_DATA`: 데이터 업데이트
  - `UPDATE_DATA_FN`: 함수형 데이터 업데이트
  - `NEXT_STEP`, `PREV_STEP`, `SET_STEP`: 단계 이동
  - `SET_ERRORS`, `SET_WARNINGS`: 검증 오류/경고 설정
  - `SET_FIELD_ERROR`, `CLEAR_FIELD_ERROR`: 필드별 오류 관리
  - `CLEAR_VALIDATION`: 검증 초기화
  - `SET_DRAFT_ID`: 임시 저장 ID 설정
  - `SET_SUBMITTING`: 제출 상태 설정
- **wizardReducer**: useReducer를 사용한 상태 관리
- **PlanWizardProvider**: Context Provider 컴포넌트
- **usePlanWizard**: Context 사용을 위한 커스텀 훅

#### 다음 단계
- PlanGroupWizard를 PlanWizardProvider로 래핑
- Step 컴포넌트들을 usePlanWizard 훅 사용으로 마이그레이션

## 진행 예정 작업

### 2-2. Plan Wizard Context 도입 (계속)
- [ ] PlanGroupWizard를 PlanWizardProvider로 래핑
- [ ] Step 컴포넌트들을 usePlanWizard 훅 사용으로 마이그레이션 (Step1~Step6)

### 2-3. Hook 분리 (단일 책임 원칙)
- [ ] `usePlanValidator` 훅 생성 (Step별 유효성 검사)
- [ ] `usePlanDraft` 훅 생성 (임시 저장 로직)
- [ ] `usePlanGenerator` 훅 생성 (Payload 생성 및 플랜 생성)
- [ ] `useWizardNavigation` 훅 생성 (단계 이동 및 URL 동기화)
- [ ] `usePlanSubmission`을 분리된 훅들을 조합하여 리팩토링

### 코드 정리
- [ ] 중복 코드 제거 및 기존 함수 deprecation 처리
- [ ] 타입 안전성 검증
- [ ] 성능 최적화 (불필요한 리렌더링 방지)

## 기술적 개선 사항

### 코드 품질
- ✅ TypeScript strict mode 준수
- ✅ 단일 책임 원칙 적용
- ✅ 캡슐화를 통한 응집도 향상
- ✅ 중복 코드 제거

### 성능 최적화
- ✅ SchedulerEngine의 메모이제이션 (캐싱)
- ✅ Context API를 통한 불필요한 리렌더링 방지 (예정)

### 유지보수성
- ✅ 클래스 기반 구조로 로직 응집도 향상
- ✅ Context API로 Props Drilling 제거 (예정)
- ✅ Hook 분리로 단일 책임 원칙 적용 (예정)

## 참고 사항

- 기존 코드와의 호환성 유지 (점진적 마이그레이션)
- 모든 변경사항은 기존 기능을 유지하면서 리팩토링
- 타입 안전성 보장을 위해 TypeScript strict mode 사용

