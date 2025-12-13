# 필드별 오류 표시 및 자동 스크롤 구현

## 작업 일자
2025-02-01

## 작업 개요
플랜 그룹 생성 위저드(`/plan/new-group`)에서 "다음" 버튼 클릭 시 검증 오류가 발생하면:
1. 전체 오류 목록 UI 제거
2. 각 필드 아래에 해당 오류 메시지 표시
3. 오류가 있는 필드에 빨간 테두리 적용
4. 첫 번째 오류 필드로 자동 스크롤 이동

## 구현 내용

### 1. useWizardValidation 훅 확장

**파일**: `app/(student)/plan/new-group/_components/hooks/useWizardValidation.ts`

**변경 사항**:
- 오류 메시지와 필드 ID를 매핑하는 `VALIDATION_FIELD_MAP` 상수 추가
- `FieldErrors` 타입 정의 (`Map<string, string>`)
- `fieldErrors` 상태 추가 및 `validateStep` 함수에서 필드별 오류 맵 생성
- 반환 타입에 `fieldErrors` 추가

**주요 코드**:
```typescript
const VALIDATION_FIELD_MAP: Record<string, string> = {
  "플랜 이름을 입력해주세요.": "plan_name",
  "플랜 목적을 선택해주세요.": "plan_purpose",
  "스케줄러 유형을 선택해주세요.": "scheduler_type",
  "학습 기간을 설정해주세요.": "period_start",
  "최소 1개 이상의 콘텐츠를 선택해주세요.": "content_selection",
};

export type FieldErrors = Map<string, string>;
```

### 2. 스크롤 유틸리티 함수 추가

**파일**: `lib/utils/scroll.ts`

**추가 함수**:
- `scrollToField(fieldId: string): void` - 특정 필드로 스크롤 이동
- `data-field-id` 속성을 가진 요소 검색
- 부드러운 스크롤 애니메이션 (`behavior: 'smooth'`)
- 포커스 가능한 요소는 300ms 후 포커스 설정

### 3. 공통 컴포넌트 생성

#### FieldError 컴포넌트
**파일**: `app/(student)/plan/new-group/_components/_shared/FieldError.tsx`

- 필드 오류 메시지 표시를 위한 재사용 가능한 컴포넌트
- 접근성 속성 포함 (`role="alert"`, `aria-live="polite"`)

#### fieldErrorUtils 헬퍼
**파일**: `app/(student)/plan/new-group/_components/_shared/fieldErrorUtils.ts`

- 필드에 오류 스타일을 적용하는 헬퍼 함수
- 조건부 클래스명 병합 (`cn` 유틸리티 사용)

### 4. PlanGroupWizard 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**주요 변경 사항**:
1. 전체 오류 목록 UI 제거 (773-785줄)
2. `fieldErrors` 훅에서 가져오기
3. `scrollToFirstError` 함수 추가 (`useCallback`으로 메모이제이션)
4. `handleNext` 함수에서 검증 실패 시 스크롤 실행
5. Step 컴포넌트에 `fieldErrors` prop 전달

### 5. Step1BasicInfo 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/Step1BasicInfo.tsx`

**변경 사항**:
- `fieldErrors?: FieldErrors` prop 추가
- 각 필드에 오류 표시 및 스타일 적용:
  - 플랜 이름: `data-field-id="plan_name"`, 오류 메시지, 빨간 테두리
  - 플랜 목적: `data-field-id="plan_purpose"`, 오류 메시지, 빨간 테두리
  - 스케줄러 유형: `data-field-id="scheduler_type"`, 오류 메시지, 빨간 테두리
- PeriodSection에 `fieldErrors` 전달

### 6. PeriodSection 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/PeriodSection.tsx`

**변경 사항**:
- `fieldErrors?: FieldErrors` prop 추가
- 각 DateInput 래퍼에 `data-field-id` 추가 및 오류 표시:
  - D-day 입력: `data-field-id="period_start"`
  - 주 단위 입력: `data-field-id="period_start"`
  - 직접 입력: 시작일 `data-field-id="period_start"`, 종료일 `data-field-id="period_end"`

### 7. Step3ContentSelection 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

**변경 사항**:
- `fieldErrors?: FieldErrors` prop 추가
- 최상위 컨테이너에 `data-field-id="content_selection"` 추가
- 탭 UI 아래에 오류 메시지 표시 영역 추가

### 8. DateInput 컴포넌트 확장

**파일**: `app/(student)/plan/new-group/_components/_shared/DateInput.tsx`

**변경 사항**:
- `error?: string` prop 추가
- `dataFieldId?: string` prop 추가
- 래퍼 div에 `data-field-id` 속성 동적 추가
- 오류 시 빨간 테두리 적용
- 오류 메시지 표시

## 최적화 사항

### 1. 중복 코드 제거
- 오류 메시지 표시를 `FieldError` 컴포넌트로 통합
- 오류 스타일 적용을 `getFieldErrorClasses` 헬퍼 함수로 통합
- 오류 메시지를 상수로 분리하여 재사용성 향상

### 2. 타입 안전성
- `FieldErrors` 타입 정의로 타입 안전성 보장
- 필드 ID 매핑을 중앙화하여 일관성 유지

### 3. 접근성 개선
- 모든 오류 메시지에 `role="alert"` 추가
- `aria-invalid`, `aria-describedby` 속성 추가
- 키보드 네비게이션 지원

## 테스트 시나리오

1. **Step 1 검증 실패**:
   - 플랜 이름 미입력 → `plan_name` 필드에 빨간 테두리 + 오류 메시지 표시 + 스크롤
   - 플랜 목적 미선택 → `plan_purpose` 필드에 오류 메시지 표시 + 스크롤
   - 스케줄러 유형 미선택 → `scheduler_type` 필드에 오류 메시지 표시 + 스크롤
   - 학습 기간 미설정 → `period_start` 필드에 빨간 테두리 + 오류 메시지 표시 + 스크롤

2. **Step 4 검증 실패**:
   - 콘텐츠 미선택 → `content_selection` 영역에 오류 메시지 표시 + 스크롤

3. **다중 오류 시**:
   - 각 필드에 해당하는 오류 메시지 표시
   - 첫 번째 오류 필드로만 스크롤
   - 전체 오류 목록은 표시하지 않음

4. **오류 해결 시**:
   - 필드 입력 시 해당 필드의 오류 메시지 자동 제거
   - 빨간 테두리 제거

## 변경된 파일 목록

1. `app/(student)/plan/new-group/_components/hooks/useWizardValidation.ts` - fieldErrors 반환 추가
2. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 전체 오류 목록 제거, fieldErrors 전달, 스크롤 로직 추가
3. `lib/utils/scroll.ts` - scrollToField 함수 추가
4. `app/(student)/plan/new-group/_components/Step1BasicInfo/Step1BasicInfo.tsx` - fieldErrors prop 추가, 각 필드에 오류 표시
5. `app/(student)/plan/new-group/_components/Step1BasicInfo/PeriodSection.tsx` - fieldErrors prop 추가, 각 DateInput에 오류 표시
6. `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx` - fieldErrors prop 추가, 오류 표시
7. `app/(student)/plan/new-group/_components/_shared/DateInput.tsx` - error, dataFieldId prop 추가
8. `app/(student)/plan/new-group/_components/_shared/FieldError.tsx` - 신규 생성 (공통 오류 메시지 컴포넌트)
9. `app/(student)/plan/new-group/_components/_shared/fieldErrorUtils.ts` - 신규 생성 (오류 스타일 헬퍼)

## 기술적 세부사항

### 오류 표시 방식
- 텍스트 입력 필드: 필드 아래에 오류 메시지 표시, 빨간 테두리 적용
- 라디오 버튼 그룹: 그룹 컨테이너 아래에 오류 메시지 표시, 선택되지 않은 항목에 빨간 테두리
- 날짜 입력 필드: DateInput 래퍼 아래에 오류 메시지 표시, 빨간 테두리 적용
- 콘텐츠 선택 영역: 영역 상단에 오류 메시지 표시

### 스크롤 동작
- `behavior: 'smooth'` - 부드러운 스크롤 애니메이션
- `block: 'center'` - 요소를 뷰포트 중앙에 배치
- 포커스 가능한 요소는 300ms 후 포커스 설정

### 접근성
- `aria-invalid="true"` - 오류가 있는 필드 표시
- `aria-describedby` - 오류 메시지와 필드 연결
- `role="alert"` - 오류 메시지에 추가하여 즉시 인지
- `aria-live="polite"` - 동적 오류 메시지 업데이트 알림

## 주의사항

1. **기존 코드와의 호환성**:
   - `validationErrors` 배열은 내부적으로 유지 (다른 곳에서 사용 가능)
   - `fieldErrors`는 UI 표시용으로만 사용

2. **성능 고려**:
   - `useCallback`으로 스크롤 함수 메모이제이션
   - `Map` 사용으로 필드별 오류 조회 성능 최적화
   - DOM 쿼리는 필요할 때만 실행

3. **반응형 디자인**:
   - 모바일 환경에서도 오류 메시지가 잘 보이도록 확인
   - 작은 화면에서 필드가 잘리지 않도록 `block: 'center'` 사용

