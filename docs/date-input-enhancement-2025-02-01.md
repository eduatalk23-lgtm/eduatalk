# DateInput 컴포넌트 고도화 및 확장 작업

**작업 일자**: 2025-02-01  
**작업 범위**: DateInput 컴포넌트 기능성, 접근성, 타입 안전성 개선 및 ExclusionsPanel.tsx 통합

## 작업 목표

1. **기능성 개선**: showPicker() 호출 타이밍 문제 해결 및 이벤트 전파 최적화
2. **접근성 향상**: ARIA 속성 추가 및 키보드 네비게이션 지원
3. **타입 안전성 강화**: showPicker 타입 가드 및 에러 처리 개선
4. **코드 일관성**: ExclusionsPanel.tsx의 date input을 DateInput으로 통합
5. **코드 품질**: 불필요한 속성 제거 및 최적화

## 구현 내용

### 1. DateInput 컴포넌트 핵심 기능 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/DateInput.tsx`

#### 1.1 showPicker() 호출 타이밍 개선
- `setTimeout`을 사용하여 포커스 후 showPicker 호출 타이밍 문제 해결
- `document.activeElement` 체크를 비동기로 처리하여 브라우저 호환성 향상

#### 1.2 이벤트 전파 최적화
- `e.stopPropagation()` 추가하여 이벤트 버블링 방지
- wrapper와 input 클릭 핸들러를 `openDatePicker` 함수로 통합

#### 1.3 타입 안전성 강화
- `hasShowPicker` 타입 가드 함수 생성
- TypeScript 타입 단언 최소화

#### 1.4 에러 처리 개선
- `console.debug`를 개발 환경에서만 출력 (`process.env.NODE_ENV === "development"`)
- 에러 발생 시 기본 동작(포커스) 유지

### 2. 접근성 속성 추가

#### 2.1 ARIA 속성
- `aria-label`: label을 기본값으로 사용하되 `ariaLabel` prop으로 커스터마이징 가능
- `aria-describedby`: 추가 설명이 있는 경우 연결 (`ariaDescribedBy` prop)
- `aria-required`: required prop과 연동

#### 2.2 키보드 접근성
- `onKeyDown` 핸들러 추가
- Enter 키로 달력 열기 지원
- 포커스된 상태에서만 동작하도록 체크

### 3. 불필요한 속성 제거

- `placeholder` prop 제거 (type="date"에서는 작동하지 않음)
- Props 타입에서 제거하여 타입 안전성 향상

### 4. ExclusionsPanel.tsx 리팩토링

**파일**: `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`

#### 4.1 DateInput 컴포넌트 import
- `DateInput` 컴포넌트 import 추가

#### 4.2 단일 날짜 입력 교체
- `exclusionInputType === "single"` 섹션의 date input을 DateInput으로 교체
- `labelClassName="text-xs"` 사용하여 기존 스타일 유지

#### 4.3 범위 날짜 입력 교체
- `exclusionInputType === "range"` 섹션의 시작일/종료일 input을 DateInput으로 교체
- grid 레이아웃 유지

#### 4.4 중복 코드 제거
- 약 50줄의 중복 코드 제거
- 일관된 사용자 경험 제공

## 변경된 파일

1. **수정된 파일**:
   - `app/(student)/plan/new-group/_components/_shared/DateInput.tsx` - 핵심 기능 개선 및 접근성 추가
   - `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx` - DateInput으로 교체

## 주요 개선 사항

### 기능성
- ✅ showPicker() 호출 안정성 향상 (setTimeout 사용)
- ✅ 이벤트 전파 방지 (stopPropagation)
- ✅ 중복 호출 방지 로직

### 접근성
- ✅ ARIA 속성 추가 (aria-label, aria-describedby, aria-required)
- ✅ 키보드 접근성 (Enter 키로 달력 열기)
- ✅ 스크린 리더 호환성 향상

### 타입 안전성
- ✅ showPicker 타입 가드 함수 (`hasShowPicker`)
- ✅ TypeScript 타입 단언 최소화
- ✅ 불필요한 placeholder prop 제거

### 코드 품질
- ✅ 중복 코드 약 50줄 제거
- ✅ 일관된 컴포넌트 사용
- ✅ 에러 처리 개선 (개발 환경에서만 디버그 로그)

## 기술적 세부 사항

### showPicker 타입 가드 함수

```typescript
function hasShowPicker(
  input: HTMLInputElement
): input is HTMLInputElement & { showPicker: () => void } {
  return (
    input.type === "date" &&
    typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function"
  );
}
```

### openDatePicker 함수

```typescript
const openDatePicker = () => {
  if (disabled || !inputRef.current) return;
  const input = inputRef.current;
  input.focus();
  
  setTimeout(() => {
    if (input === document.activeElement && hasShowPicker(input)) {
      try {
        input.showPicker();
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[DateInput] showPicker not supported or failed:", error);
        }
      }
    }
  }, 0);
};
```

## 예상 효과

1. **기능성**: showPicker() 호출 안정성 향상으로 모든 브라우저에서 일관된 동작
2. **접근성**: WCAG 2.1 AA 수준 준수로 스크린 리더 및 키보드 사용자 지원
3. **코드 품질**: 중복 코드 제거로 유지보수성 향상
4. **일관성**: 모든 date input이 동일한 컴포넌트 사용으로 일관된 UX
5. **타입 안전성**: 타입 가드 함수로 런타임 에러 방지

## 테스트 항목

- [x] showPicker() 호출 타이밍 테스트
- [x] 이벤트 전파 방지 확인
- [x] 키보드 접근성 (Enter 키) 테스트
- [x] ExclusionsPanel.tsx의 모든 date input 동작 확인
- [x] TypeScript 타입 검증
- [x] ESLint 검증

## 브라우저 호환성

- **Chrome 99+**: showPicker() 지원
- **Edge 99+**: showPicker() 지원
- **Safari**: 기본 date picker 동작
- **Firefox**: 기본 date picker 동작 (showPicker 미지원)

## 참고 사항

- `showPicker()` 메서드는 Chrome 99+, Edge 99+에서 지원
- 미지원 브라우저에서는 기본 포커스 동작 수행
- 모든 브라우저에서 전체 영역 클릭 가능
- 키보드 접근성으로 Enter 키 지원

