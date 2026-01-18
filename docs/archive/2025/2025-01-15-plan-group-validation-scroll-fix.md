# 플랜 그룹 검증 스크롤 문제 수정

## 작업 일자
2025-01-15

## 문제 상황

플랜 그룹 생성 시 검증 기능의 페이지 이동 문제가 발생했습니다:
- 검증 실패 후 오류 필드로 스크롤한 후 다시 원래 위치(상단)로 돌아가는 현상
- 다시 진행하면 정상 작동

### 원인 분석

1. **스크롤 충돌**: 두 개의 `useEffect`가 서로 스크롤을 덮어쓰는 문제
   - `currentStep` 변경 시 상단으로 스크롤 (479-482번 줄)
   - `fieldErrors` 변경 시 오류 필드로 스크롤 (533-539번 줄)
   - 검증 실패 시 오류 필드로 이동한 후 다시 상단으로 돌아감

2. **중복 코드**: 스크롤 로직이 컴포넌트 내부에 분산되어 있음
   - `scrollToFirstError` 함수가 컴포넌트 내부에 정의됨
   - 스크롤 관련 ref와 로직이 여러 곳에 분산

3. **타이밍 이슈**: `requestAnimationFrame` 중첩 사용으로 인한 불필요한 복잡성

## 해결 방안

### 1. 스크롤 관리 커스텀 훅 생성

**파일**: `app/(student)/plan/new-group/_components/hooks/useWizardScroll.ts` (신규 생성)

React Hook Form의 모범 사례를 참고하여 스크롤 관리를 통합하는 커스텀 훅을 생성했습니다.

**주요 기능**:
- 스크롤 우선순위 관리 (검증 실패 > 단계 변경)
- 단계 변경 추적을 통한 불필요한 스크롤 방지
- 통합 `useEffect`로 스크롤 동작 일관성 보장

### 2. PlanGroupWizard.tsx 리팩토링

**변경 사항**:
- `useWizardScroll` 훅 import 및 사용
- 기존 스크롤 로직 제거:
  - `scrollToFirstError` 함수 제거 (513-528번 줄)
  - `shouldScrollToErrorRef` ref 제거 (531번 줄)
  - 단계 변경 시 스크롤 `useEffect` 제거 (479-482번 줄)
  - `fieldErrors` 변경 시 스크롤 `useEffect` 제거 (533-539번 줄)
- `handleNext`에서 `handleValidationFailed` 사용
- 불필요한 import 제거 (`scrollToTop`, `scrollToField`, `getFirstErrorFieldId`)

### 3. 스크롤 유틸리티 최적화

**파일**: `lib/utils/scroll.ts`

**개선 사항**:
- `requestAnimationFrame` 중첩 제거 (성능 최적화)
- 에러 핸들링 유지 (개발 환경에서만 경고 출력)

## 구현 세부 사항

### useWizardScroll 훅 구조

```typescript
export function useWizardScroll({
  currentStep,
  fieldErrors,
}: UseWizardScrollProps): UseWizardScrollReturn {
  // 스크롤 우선순위 관리
  const scrollPriorityRef = useRef<'error' | null>(null);
  const prevStepRef = useRef<WizardStep>(currentStep);

  // 통합 스크롤 효과
  useEffect(() => {
    // 검증 실패 시 오류 필드로 스크롤 (최우선)
    if (scrollPriorityRef.current === 'error' && fieldErrors.size > 0) {
      scrollToFirstError(fieldErrors, currentStep);
      scrollPriorityRef.current = null;
      prevStepRef.current = currentStep;
      return;
    }

    // 단계 변경 시 상단으로 스크롤 (검증 실패가 아닐 때만)
    if (prevStepRef.current !== currentStep && scrollPriorityRef.current !== 'error') {
      scrollToTop();
      prevStepRef.current = currentStep;
    }
  }, [currentStep, fieldErrors]);

  return { handleValidationFailed };
}
```

### 스크롤 우선순위 로직

1. **검증 실패 시**: `handleValidationFailed()` 호출 → `scrollPriorityRef.current = 'error'` → `fieldErrors` 업데이트 감지 → 오류 필드로 스크롤
2. **단계 변경 시**: `currentStep` 변경 감지 → 검증 실패가 아닌 경우에만 상단으로 스크롤

## 수정된 파일

1. **신규 생성**
   - `app/(student)/plan/new-group/_components/hooks/useWizardScroll.ts`

2. **수정**
   - `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - `lib/utils/scroll.ts`

## 테스트 시나리오

### ✅ 검증 실패 시 오류 필드 스크롤
1. 필수 필드를 비워두고 "다음" 버튼 클릭
2. 검증 실패 → 오류 필드로 스크롤되어야 함
3. 상단으로 돌아가지 않아야 함

### ✅ 단계 변경 시 상단 스크롤
1. 검증을 통과하여 다음 단계로 이동
2. 페이지 상단으로 스크롤되어야 함

### ✅ 충돌 방지
1. 검증 실패 후 오류 필드로 스크롤
2. 이후 단계 변경이 발생해도 오류 필드 위치 유지
3. 검증 통과 후 다음 단계로 이동 시에만 상단으로 스크롤

## 예상 효과

1. **문제 해결**: 검증 실패 후 스크롤이 원래 위치로 돌아가지 않음
2. **코드 품질**: 중복 제거 및 관심사 분리로 유지보수성 향상
3. **성능**: 불필요한 `requestAnimationFrame` 중첩 제거
4. **재사용성**: 다른 위저드 컴포넌트에서도 사용 가능한 훅 제공

## 참고 자료

- React Hook Form: `shouldFocus` 옵션을 통한 포커스/스크롤 제어 패턴
- React 공식 문서: useEffect 의존성 배열 관리
- 웹 검색 결과: 2025년 React 폼 검증 모범 사례

