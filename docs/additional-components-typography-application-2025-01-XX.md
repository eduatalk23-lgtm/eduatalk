# 추가 컴포넌트 타이포그래피 시스템 적용

**작성 일시**: 2025-01-XX  
**목적**: 추가 UI 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

추가로 발견된 UI 컴포넌트 4개에 타이포그래피 시스템을 적용하여 일관된 텍스트 스타일을 확보했습니다.

---

## ✅ 변경 사항

### 1. FormCheckbox 컴포넌트 (`components/ui/FormCheckbox.tsx`)

#### 라벨 및 설명 텍스트
- **변경 전**: 
  - 라벨: `text-sm` (14px)
  - 설명: `text-xs` (12px)
  - 에러: `text-xs` (12px)
- **변경 후**: 
  - 라벨: `text-body-2` (17px)
  - 설명: `text-body-2` (17px)
  - 에러: `text-body-2` (17px)

```typescript
// 변경 전
<span className="text-sm text-[var(--text-secondary)]">{label}</span>
{description && (
  <span className="text-xs text-[var(--text-tertiary)]">{description}</span>
)}
{error && (
  <span className="text-xs text-error-600">{error}</span>
)}

// 변경 후
<span className="text-body-2 text-[var(--text-secondary)]">{label}</span>
{description && (
  <span className="text-body-2 text-[var(--text-tertiary)]">{description}</span>
)}
{error && (
  <span className="text-body-2 text-error-600">{error}</span>
)}
```

**설명**:
- 체크박스 라벨과 설명의 가독성 향상
- 에러 메시지도 동일한 크기로 통일

---

### 2. ProgressBar 컴포넌트 (`components/atoms/ProgressBar.tsx`)

#### 진행률 레이블
- **변경 전**: `text-xs` (12px)
- **변경 후**: `text-body-2` (17px)

```typescript
// 변경 전
{finalShowLabel && (
  <div className="text-right text-xs font-medium text-[var(--text-secondary)]">
    {Math.round(percentage)}%
  </div>
)}

// 변경 후
{finalShowLabel && (
  <div className="text-right text-body-2 font-medium text-[var(--text-secondary)]">
    {Math.round(percentage)}%
  </div>
)}
```

**설명**:
- 진행률 표시 텍스트의 가독성 향상
- 작은 텍스트 크기 개선 (12px → 17px)

---

### 3. LoadingOverlay 컴포넌트 (`components/organisms/LoadingOverlay.tsx`)

#### 로딩 메시지
- **변경 전**: `text-sm` (14px)
- **변경 후**: `text-body-2` (17px)

```typescript
// 변경 전
{message && (
  <p className="text-sm font-medium text-[var(--text-secondary)]">{message}</p>
)}

// 변경 후
{message && (
  <p className="text-body-2 font-medium text-[var(--text-secondary)]">{message}</p>
)}
```

**설명**:
- 로딩 오버레이 메시지의 가독성 향상
- 사용자에게 더 명확한 피드백 제공

---

### 4. Button 컴포넌트 (`components/atoms/Button.tsx`)

#### sizeClasses 업데이트
- **변경 전**:
  - `xs`: `text-xs` (12px)
  - `sm`: `text-sm` (14px)
  - `md`: `text-sm` (14px)
  - `lg`: `text-base` (16px)
- **변경 후**:
  - `xs`: `text-body-2` (17px)
  - `sm`: `text-body-2` (17px)
  - `md`: `text-body-2` (17px)
  - `lg`: `text-body-1` (19px)

```typescript
// 변경 전
const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

// 변경 후
const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-body-2",
  sm: "px-3 py-1.5 text-body-2",
  md: "px-4 py-2 text-body-2",
  lg: "px-6 py-3 text-body-1",
};
```

**설명**:
- 모든 버튼 크기에서 일관된 텍스트 크기 사용
- `xs`, `sm`, `md`는 `text-body-2`로 통일
- `lg`는 `text-body-1`로 설정하여 더 큰 텍스트 제공
- 패딩으로 크기 차이 표현 (텍스트 크기로는 구분하지 않음)

---

## 🎯 개선 효과

### 1. 일관성 확보
- 모든 UI 컴포넌트가 동일한 타이포그래피 시스템 사용
- 프로젝트 전반에서 일관된 텍스트 크기

### 2. 가독성 향상
- 작은 텍스트 크기 개선 (12px/14px → 17px)
- 특히 FormCheckbox, ProgressBar 같은 작은 컴포넌트에서 가독성 향상

### 3. 디자인 시스템 준수
- 하드코딩된 텍스트 크기 제거
- 의미 있는 타이포그래피 클래스 사용

### 4. 유지보수성 향상
- 타이포그래피 변경 시 `globals.css`만 수정하면 전체 적용
- 컴포넌트별 개별 수정 불필요

---

## 📊 영향 범위

### 직접 영향
- **FormCheckbox**: 모든 체크박스 라벨, 설명, 에러 메시지 스타일 변경
- **ProgressBar**: 진행률 레이블 텍스트 크기 변경
- **LoadingOverlay**: 로딩 메시지 텍스트 크기 변경
- **Button**: 모든 버튼 텍스트 크기 변경

### 사용 위치
- 체크박스가 사용되는 모든 폼
- 진행률 표시가 필요한 모든 페이지
- 로딩 오버레이가 표시되는 모든 페이지
- 버튼이 사용되는 모든 페이지

---

## ✅ 검증 사항

### 1. 타입 안전성
- ✅ TypeScript 타입 에러 없음
- ✅ 모든 props 타입 정상 작동
- ✅ CVA variants 정상 작동 (Button)

### 2. 스타일 일관성
- ✅ FormCheckbox: `text-body-2` 적용
- ✅ ProgressBar: `text-body-2` 적용
- ✅ LoadingOverlay: `text-body-2` 적용
- ✅ Button: 모든 size에서 타이포그래피 시스템 적용

### 3. 접근성
- ✅ FormCheckbox: `aria-invalid`, `aria-describedby` 유지
- ✅ ProgressBar: `role="progressbar"`, `aria-valuenow` 등 유지
- ✅ Button: 접근성 속성 유지

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-body-2`: 17px (기본 본문 텍스트)
- `text-body-1`: 19px (큰 본문 텍스트)

### 기존 텍스트 크기 매핑
- `text-xs` (12px) → `text-body-2` (17px)
- `text-sm` (14px) → `text-body-2` (17px)
- `text-base` (16px) → `text-body-1` (19px)

### Button 크기 전략
- 텍스트 크기는 `xs`, `sm`, `md`에서 `text-body-2`로 통일
- `lg`는 `text-body-1`로 설정하여 더 큰 텍스트 제공
- 패딩(`px`, `py`)으로 크기 차이 표현
- 시각적 크기 차이는 유지하면서 가독성 향상

---

## 🔄 다음 단계

### 완료된 작업
- ✅ FormCheckbox 컴포넌트 타이포그래피 적용
- ✅ ProgressBar 컴포넌트 타이포그래피 적용
- ✅ LoadingOverlay 컴포넌트 타이포그래피 적용
- ✅ Button 컴포넌트 sizeClasses 타이포그래피 시스템 적용

### 향후 작업
- 우선순위 낮은 컴포넌트 점진적 적용
- 새로운 컴포넌트 작성 시 필수 적용

---

**작성 일시**: 2025-01-XX

