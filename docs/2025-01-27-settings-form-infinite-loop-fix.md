# Settings 폼 무한 루프 수정 및 최적화

**작업 일자**: 2025-01-27  
**작업자**: AI Assistant  
**관련 이슈**: Maximum update depth exceeded 에러 해결

## 문제 분석

### 에러 메시지
```
Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, 
but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

### 핵심 문제점

1. **무한 루프 발생**
   - `useSettingsForm.ts`의 `useEffect`에서 `initialData`가 매번 새로운 객체 참조로 전달되어 무한 업데이트 발생
   - `SettingsPageClient`에서 `resolvedInitialFormData || {...}` 형태로 전달하는 기본 객체가 매번 새로 생성됨

2. **중복 로직**
   - `SettingsPageClient.tsx`의 134-139줄에서 `resolvedInitialFormData` 변경 시 `setFormData`와 `setInitialFormData`를 호출
   - 이는 `useSettingsForm` 내부에서 이미 처리되는 로직이므로 중복됨

3. **불안정한 객체 참조**
   - 기본 폼 데이터 객체가 매 렌더링마다 새로 생성되어 참조가 계속 변경됨

## 해결 방안

### 1. 깊은 비교 유틸리티 함수 추가

**파일**: `app/(student)/settings/_utils/formComparison.ts`

- `isFormDataEqual` 함수 추가
- `hasFormDataChanges` 함수를 활용하여 깊은 비교 구현

```typescript
/**
 * 두 FormData 객체가 동일한지 비교 (깊은 비교)
 */
export function isFormDataEqual(
  a: StudentFormData | null,
  b: StudentFormData | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a === b) return true;
  return !hasFormDataChanges(a, b);
}
```

### 2. useSettingsForm 훅 수정

**파일**: `app/(student)/settings/_hooks/useSettingsForm.ts`

**변경 사항**:
- `useRef`로 이전 `initialData` 추적 (`prevInitialDataRef`)
- 깊은 비교 함수(`isFormDataEqual`)를 사용하여 실제 변경이 있을 때만 상태 업데이트
- 무한 루프 방지

```typescript
const prevInitialDataRef = useRef<StudentFormData | null>(initialData);

useEffect(() => {
  // 깊은 비교로 실제 변경이 있을 때만 업데이트
  if (initialData && !isFormDataEqual(prevInitialDataRef.current, initialData)) {
    setFormDataState(initialData);
    initialFormDataRef.current = initialData;
    prevInitialDataRef.current = initialData;
  }
}, [initialData]);
```

### 3. SettingsPageClient 중복 로직 제거 및 최적화

**파일**: `app/(student)/settings/_components/SettingsPageClient.tsx`

**변경 사항**:
- 중복된 `useEffect` 제거 (134-139줄)
- `useMemo`로 기본 폼 데이터 객체 안정화
- `resolvedInitialFormData ?? defaultFormData` 패턴 사용

```typescript
// 기본 폼 데이터를 useMemo로 안정화
const defaultFormData = useMemo<StudentFormData>(() => ({
  name: "",
  school_id: "",
  grade: "",
  // ... 나머지 필드
}), []);

const { ... } = useSettingsForm({
  initialFormData: resolvedInitialFormData ?? defaultFormData,
  isInitialSetup,
});

// 중복된 useEffect 제거됨
```

### 4. useAutoCalculation 최적화

**파일**: `app/(student)/settings/_hooks/useAutoCalculation.ts`

**변경 사항**:
- `initialFormData` 전체 객체 대신 필요한 필드만 의존성으로 사용
- 불필요한 재실행 방지

```typescript
// 이전: initialFormData 전체 객체를 의존성으로 사용
}, [..., initialFormData, ...]);

// 이후: 필요한 필드만 추적
}, [
  formData.grade,
  formData.exam_year,
  schoolType,
  autoCalculateFlags.examYear,
  initialFormData?.exam_year, // 필요한 필드만
  updateFormData,
  setInitialFormData,
]);
```

## 최적화 결과

### 코드 중복 제거
- ✅ `SettingsPageClient`의 중복된 `useEffect` 제거
- ✅ 기본 객체 생성을 `useMemo`로 최적화

### 성능 개선
- ✅ 깊은 비교로 불필요한 상태 업데이트 방지
- ✅ `useRef`로 이전 값 추적하여 비교 최적화
- ✅ `useMemo`로 객체 참조 안정화
- ✅ 의존성 배열 최적화로 불필요한 재실행 방지

## 테스트 결과

- ✅ 무한 루프 에러 해결 확인
- ✅ 린터 에러 없음
- ✅ 폼 데이터 초기화 정상 동작
- ✅ 폼 데이터 변경 감지 정상 동작

## 수정된 파일 목록

1. `app/(student)/settings/_utils/formComparison.ts` - 깊은 비교 함수 추가
2. `app/(student)/settings/_hooks/useSettingsForm.ts` - 깊은 비교 로직 추가
3. `app/(student)/settings/_components/SettingsPageClient.tsx` - 중복 로직 제거 및 최적화
4. `app/(student)/settings/_hooks/useAutoCalculation.ts` - 의존성 배열 최적화

## 참고 자료

- React 공식 문서: useEffect 의존성 배열 최적화
- React 공식 문서: 무한 루프 방지 패턴
- Context7 MCP: React useEffect 모범 사례

## 향후 개선 사항

- [ ] `useAutoCalculation`에서 사용하지 않는 `isFormDataEqual` import 정리 (필요시)
- [ ] 추가적인 성능 최적화 기회 검토

