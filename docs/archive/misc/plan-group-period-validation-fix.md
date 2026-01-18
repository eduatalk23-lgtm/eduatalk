# 플랜 그룹 기간 설정 검증 오류 수정

## 작업 일시
2024년 12월

## 문제 상황

플랜 그룹 생성 시 `period_start` 또는 `period_end`가 비어있을 때 저장을 시도하면 다음과 같은 에러가 발생했습니다:

```
데이터 유효성 검증 실패: 기간 설정이 필요합니다.
```

### 문제점

1. **캠프 모드에서 기간 검증 예외 처리 부재**: 캠프 모드에서는 템플릿에서 기간이 설정될 수 있지만, 현재 검증 로직이 이를 고려하지 않음
2. **중복된 검증 로직**: `usePlanPayloadBuilder`, `useWizardValidation`, `PlanValidator`에서 각각 기간 검증을 수행
3. **사용자 경험 개선 필요**: 저장 버튼이 비활성화되지 않아 사용자가 에러를 만난 후에야 문제를 알 수 있음

## 수정 내용

### 1. usePlanPayloadBuilder에 캠프 모드 지원 추가

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`

- `UsePlanPayloadBuilderOptions`에 `isCampMode?: boolean` 추가
- 기간 검증 로직 수정: 캠프 모드가 아닐 때만 기간 검증 수행
- 템플릿 모드에서 학생 입력 허용 여부 확인 로직 추가
- 기간 검증 메시지 개선: "기간 설정이 필요합니다. Step 1에서 학습 기간을 입력해주세요."

**검증 우선순위**:
1. 캠프 모드 → 기간 검증 건너뛰기
2. 템플릿 모드 + 학생 입력 허용 → 기간 검증 건너뛰기
3. 그 외 → 기간 필수 검증

### 2. usePlanSubmission에서 isCampMode 전달

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`

- `usePlanPayloadBuilder` 호출 시 `isCampMode` 옵션 전달
- `executeSave` 함수에서 기간 검증 추가 (이중 안전장치)
- `handleSubmit` 함수에서도 기간 검증 추가
- dependency array에 `wizardData` 추가

### 3. 저장 버튼 비활성화 로직 추가

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

- 저장 버튼의 `disabled` 조건에 기간 검증 추가
- 캠프 모드가 아닐 때만 기간 검증 수행

```typescript
disabled={
  isSubmitting || 
  !wizardData.name || 
  (!isCampMode && (!wizardData.period_start || !wizardData.period_end))
}
```

### 4. 에러 메시지 개선

- 기간 검증 실패 시 더 명확한 메시지 제공
- Step 1로 이동하도록 안내하는 메시지 추가: "기간 설정이 필요합니다. Step 1에서 학습 기간을 입력해주세요."

## 수정된 파일 목록

1. `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`
2. `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`
3. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

## 테스트 시나리오

1. **일반 모드**: 기간 없이 저장 시도 → 에러 메시지 표시 및 저장 버튼 비활성화
2. **캠프 모드**: 기간 없이 저장 시도 → 저장 성공 (템플릿에서 기간 설정)
3. **템플릿 모드 + 학생 입력 허용**: 기간 없이 저장 시도 → 저장 성공
4. **템플릿 모드 + 학생 입력 비허용**: 기간 없이 저장 시도 → 에러 메시지 표시

## 데이터베이스 스키마 확인

`plan_groups` 테이블의 `period_start`와 `period_end`는 `date` 타입이며 NOT NULL 제약이 있습니다. 따라서 저장 전에 반드시 검증해야 합니다.

## 최적화 포인트

1. **조건부 검증**: 캠프 모드와 템플릿 모드에 따른 조건부 검증 로직 명확화
2. **타입 안전성**: `isCampMode`를 명시적으로 전달하여 타입 안전성 향상
3. **사용자 경험**: 저장 버튼 비활성화로 사전에 문제를 방지

## 참고 사항

- 캠프 모드에서는 템플릿에서 기간이 설정되므로 기간 검증을 건너뛰어야 함
- 템플릿 모드에서 학생 입력 허용이 체크되어 있으면 기간 검증을 건너뛰어야 함
- 이중 안전장치로 `usePlanPayloadBuilder`와 `usePlanSubmission` 모두에서 검증 수행

