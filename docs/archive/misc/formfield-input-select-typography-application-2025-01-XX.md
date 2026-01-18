# FormField, Input, Select 컴포넌트 타이포그래피 시스템 적용

**작성 일시**: 2025-01-XX  
**목적**: FormField, Input, Select 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

FormField 컴포넌트의 에러/힌트 메시지와 Input/Select 컴포넌트의 sizeClasses에 타이포그래피 시스템을 적용하여 일관된 텍스트 스타일을 확보했습니다.

---

## ✅ 변경 사항

### 1. FormField 컴포넌트 (`components/molecules/FormField.tsx`)

#### 에러 메시지
- **변경 전**: `text-xs`
- **변경 후**: `text-body-2` (17px)
- **적용 위치**: FormField 및 FormSelect 모두

#### 힌트 메시지
- **변경 전**: `text-xs`
- **변경 후**: `text-body-2` (17px)
- **적용 위치**: FormField 및 FormSelect 모두

```typescript
// 변경 전
{error && (
  <p id={errorId} className="text-xs text-error-600 dark:text-error-400" role="alert">
    {error}
  </p>
)}
{hint && !error && (
  <p id={hintId} className="text-xs text-[var(--text-secondary)]">
    {hint}
  </p>
)}

// 변경 후
{error && (
  <p id={errorId} className="text-body-2 text-error-600 dark:text-error-400" role="alert">
    {error}
  </p>
)}
{hint && !error && (
  <p id={hintId} className="text-body-2 text-[var(--text-secondary)]">
    {hint}
  </p>
)}
```

---

### 2. Input 컴포넌트 (`components/atoms/Input.tsx`)

#### sizeClasses 업데이트
- **변경 전**:
  - `sm`: `text-xs` (12px)
  - `md`: `text-sm` (14px)
  - `lg`: `text-base` (16px)
- **변경 후**:
  - `sm`: `text-body-2` (17px)
  - `md`: `text-body-2` (17px)
  - `lg`: `text-body-1` (19px)

```typescript
// 변경 전
const sizeClasses: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

// 변경 후
const sizeClasses: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-body-2",
  md: "px-3 py-2 text-body-2",
  lg: "px-4 py-3 text-body-1",
};
```

**설명**:
- `sm`과 `md`는 모두 `text-body-2`로 통일하여 일관성 확보
- `lg`는 `text-body-1`로 설정하여 더 큰 텍스트 제공
- 패딩은 기존과 동일하게 유지하여 시각적 크기 차이는 유지

---

### 3. Select 컴포넌트 (`components/atoms/Select.tsx`)

#### sizeClasses 업데이트
- **변경 전**:
  - `sm`: `text-xs` (12px)
  - `md`: `text-sm` (14px)
  - `lg`: `text-base` (16px)
- **변경 후**:
  - `sm`: `text-body-2` (17px)
  - `md`: `text-body-2` (17px)
  - `lg`: `text-body-1` (19px)

```typescript
// 변경 전
const sizeClasses: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

// 변경 후
const sizeClasses: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-body-2",
  md: "px-3 py-2 text-body-2",
  lg: "px-4 py-3 text-body-1",
};
```

**설명**:
- Input 컴포넌트와 동일한 패턴 적용
- FormField에서 사용하는 Select와 일관성 유지

---

## 🎯 개선 효과

### 1. 일관성 확보
- 모든 폼 관련 컴포넌트가 동일한 타이포그래피 시스템 사용
- 에러/힌트 메시지의 가독성 향상 (12px → 17px)

### 2. 디자인 시스템 준수
- 하드코딩된 텍스트 크기 제거
- `text-body-2`, `text-body-1` 등 의미 있는 클래스 사용

### 3. 유지보수성 향상
- 타이포그래피 변경 시 `globals.css`만 수정하면 전체 적용
- 컴포넌트별 개별 수정 불필요

---

## 📊 영향 범위

### 직접 영향
- **FormField**: 모든 FormField 사용 위치에서 에러/힌트 메시지 스타일 변경
- **FormSelect**: 모든 FormSelect 사용 위치에서 에러/힌트 메시지 스타일 변경
- **Input**: 모든 Input 사용 위치에서 텍스트 크기 변경
- **Select**: 모든 Select 사용 위치에서 텍스트 크기 변경

### 사용 위치 (예시)
- `app/(admin)/admin/master-books/new/MasterBookForm.tsx`
- `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`
- `app/(admin)/admin/master-custom-contents/new/MasterCustomContentForm.tsx`
- `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`
- 기타 FormField/FormSelect를 사용하는 모든 위치

---

## ✅ 검증 사항

### 1. 타입 안전성
- ✅ TypeScript 타입 에러 없음
- ✅ 모든 props 타입 정상 작동

### 2. 스타일 일관성
- ✅ 에러 메시지: `text-body-2` 적용
- ✅ 힌트 메시지: `text-body-2` 적용
- ✅ Input sizeClasses: 타이포그래피 시스템 적용
- ✅ Select sizeClasses: 타이포그래피 시스템 적용

### 3. 접근성
- ✅ 에러 메시지 `role="alert"` 유지
- ✅ `aria-describedby` 연결 정상 작동

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-body-2`: 17px (기본 본문 텍스트)
- `text-body-1`: 19px (큰 본문 텍스트)
- `text-body-2-bold`: 17px, font-weight: 700

### 기존 텍스트 크기 매핑
- `text-xs` (12px) → `text-body-2` (17px)
- `text-sm` (14px) → `text-body-2` (17px)
- `text-base` (16px) → `text-body-1` (19px)

---

## 🔄 다음 단계

### 완료된 작업
- ✅ FormField 에러/힌트 메시지 타이포그래피 적용
- ✅ Input sizeClasses 타이포그래피 시스템 적용
- ✅ Select sizeClasses 타이포그래피 시스템 적용

### 향후 작업
- 점진적으로 나머지 컴포넌트에 타이포그래피 시스템 적용
- 새로운 컴포넌트 작성 시 필수 적용

---

**작성 일시**: 2025-01-XX

