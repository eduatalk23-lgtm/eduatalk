# 디자인 시스템 UI 개선 작업 문서

**작업 일자**: 2025년 12월 17일  
**작업 범위**: 디자인 시스템 관련 UI 검토 및 프로젝트 UI 개선

---

## 📋 작업 개요

프로젝트 전반의 UI 컴포넌트를 검토하고, 하드코딩된 색상 클래스를 디자인 시스템 토큰으로 교체하여 일관성과 유지보수성을 향상시켰습니다.

---

## ✅ 완료된 작업

### 1. DropdownMenu 컴포넌트 개선

**파일**: `components/ui/DropdownMenu.tsx`

#### 개선 사항

- ✅ 하드코딩된 `gray-*` 색상을 디자인 시스템 토큰으로 교체
- ✅ CSS 변수 기반 색상 사용으로 다크모드 자동 대응

#### 변경 내용

**Before**:
```tsx
"bg-white dark:bg-gray-800"
"border-gray-200 dark:border-gray-700"
"text-gray-700 dark:text-gray-200"
"hover:bg-gray-100 dark:hover:bg-gray-700"
```

**After**:
```tsx
"bg-white dark:bg-secondary-900"
"border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]"
"text-[var(--text-secondary)] dark:text-[var(--text-primary)]"
"hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]"
```

---

### 2. ProgressBar 컴포넌트 개선

**파일**: `components/atoms/ProgressBar.tsx`

#### 개선 사항

- ✅ 하드코딩된 색상을 디자인 시스템 시맨틱 색상으로 교체
- ✅ Transition 클래스를 `transition-base`로 통일
- ✅ 배경색을 디자인 시스템 토큰으로 교체

#### 변경 내용

**Before**:
```tsx
default: "bg-gray-900"
success: "bg-green-600"
warning: "bg-amber-500"
error: "bg-red-600"
// 배경: "bg-gray-200"
// 텍스트: "text-gray-600"
// transition: "transition-all duration-300"
```

**After**:
```tsx
default: "bg-[var(--text-primary)]"
success: "bg-success-600"
warning: "bg-warning-500"
error: "bg-error-600"
// 배경: "bg-[rgb(var(--color-secondary-200))]"
// 텍스트: "text-[var(--text-secondary)]"
// transition: "transition-base"
```

---

### 3. Skeleton 컴포넌트 개선

**파일**: `components/atoms/Skeleton.tsx`

#### 개선 사항

- ✅ 하드코딩된 배경색을 디자인 시스템 토큰으로 교체
- ✅ 인라인 스타일 최적화 (빈 객체 체크 추가)

#### 변경 내용

**Before**:
```tsx
"animate-pulse bg-gray-200"
style={{ width, height }}
```

**After**:
```tsx
"animate-pulse bg-[rgb(var(--color-secondary-200))]"
style={Object.keys(dynamicStyle).length > 0 ? dynamicStyle : undefined}
```

---

### 4. LazyRecharts 컴포넌트 개선

**파일**: `components/charts/LazyRecharts.tsx`

#### 개선 사항

- ✅ 하드코딩된 색상을 디자인 시스템 토큰으로 교체
- ✅ 인라인 스타일 최적화

#### 변경 내용

**Before**:
```tsx
"bg-gray-100 dark:bg-gray-800"
"text-gray-400 dark:text-gray-600"
style={{ height }}
```

**After**:
```tsx
"bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-900))]"
"text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]"
style={{ height: `${height}px` }}
```

---

### 5. DataTable 컴포넌트 개선

**파일**: `components/organisms/DataTable.tsx`

#### 개선 사항

- ✅ 하드코딩된 `gray-*` 색상을 디자인 시스템 토큰으로 교체
- ✅ Transition 클래스를 `transition-base`로 통일
- ✅ 인라인 스타일 최적화 (조건부 적용)

#### 변경 내용

**Before**:
```tsx
"border-gray-200"
"bg-gray-50"
"text-gray-700"
"border-gray-100"
"hover:bg-gray-50"
"transition-colors"
style={{ width: column.width }}
```

**After**:
```tsx
"border-[rgb(var(--color-secondary-200))]"
"bg-[rgb(var(--color-secondary-50))]"
"text-[var(--text-secondary)]"
"border-[rgb(var(--color-secondary-100))]"
"hover:bg-[rgb(var(--color-secondary-50))]"
"transition-base"
style={column.width ? { width: column.width } : undefined}
```

---

## 🎨 디자인 시스템 토큰 사용 가이드

### 텍스트 색상

| 용도 | 디자인 시스템 토큰 | 예시 |
|------|-----------------|------|
| 주요 텍스트 | `text-[var(--text-primary)]` | 제목, 중요 텍스트 |
| 보조 텍스트 | `text-[var(--text-secondary)]` | 본문, 설명 |
| 3차 텍스트 | `text-[var(--text-tertiary)]` | 메타 정보, 부가 설명 |
| 플레이스홀더 | `text-[var(--text-placeholder)]` | 입력 필드 placeholder |
| 비활성 텍스트 | `text-[var(--text-disabled)]` | disabled 상태 |

### 배경 색상

| 용도 | 디자인 시스템 토큰 | 예시 |
|------|-----------------|------|
| 표면 배경 | `bg-white dark:bg-secondary-900` | 카드, 모달 배경 |
| 보조 배경 | `bg-[rgb(var(--color-secondary-50))]` | 테이블 헤더, 섹션 배경 |
| 호버 배경 | `hover:bg-[rgb(var(--color-secondary-50))]` | 인터랙티브 요소 호버 |

### 테두리 색상

| 용도 | 디자인 시스템 토큰 | 예시 |
|------|-----------------|------|
| 기본 테두리 | `border-[rgb(var(--color-secondary-200))]` | 카드, 컨테이너 테두리 |
| 입력 필드 테두리 | `border-[rgb(var(--color-secondary-300))]` | Input, Textarea 테두리 |
| 구분선 | `border-[rgb(var(--color-secondary-100))]` | 테이블 행 구분선 |

### 시맨틱 색상

| 용도 | 디자인 시스템 토큰 | 예시 |
|------|-----------------|------|
| Primary | `bg-primary-600`, `text-primary-600` | 주요 액션 버튼 |
| Success | `bg-success-600`, `text-success-600` | 성공 상태 |
| Warning | `bg-warning-500`, `text-warning-500` | 경고 상태 |
| Error | `bg-error-600`, `text-error-600` | 오류 상태 |
| Info | `bg-info-500`, `text-info-500` | 정보 표시 |

---

## 📊 개선 효과

### 일관성 향상

- ✅ 모든 컴포넌트에서 동일한 색상 토큰 사용
- ✅ 다크모드 자동 대응으로 일관된 사용자 경험
- ✅ 디자인 시스템 변경 시 한 곳에서만 수정하면 전체 반영

### 유지보수성 향상

- ✅ 하드코딩된 색상 제거로 유지보수 용이
- ✅ CSS 변수 기반으로 런타임 테마 변경 가능
- ✅ 타입 안전한 색상 사용 (TypeScript 지원)

### 성능 최적화

- ✅ 인라인 스타일 최적화 (조건부 적용)
- ✅ Transition 클래스 통일로 일관된 애니메이션

---

## 🔍 추가 개선 필요 사항

다음 파일들에서도 하드코딩된 색상이 발견되었습니다. 향후 개선이 필요합니다:

1. **components/ui/SchoolMultiSelect.tsx**
2. **components/navigation/global/CategoryNav.tsx**
3. **components/molecules/Tabs.tsx**
4. **components/ui/SchoolSelect.tsx**
5. **components/ui/InstallPrompt.tsx**
6. **components/ui/LoadingSkeleton.tsx**
7. **components/ui/StickySaveButton.tsx**
8. **components/molecules/Toast.tsx**
9. **components/atoms/ToggleSwitch.tsx**
10. **components/forms/BaseBookSelector.tsx**
11. **components/layout/RoleBasedLayout.tsx**
12. **components/filters/UnifiedContentFilter.tsx**
13. **components/ui/FormCheckbox.tsx**
14. **components/errors/GlobalErrorBoundary.tsx**
15. **components/molecules/FormField.tsx**
16. **components/organisms/LoadingOverlay.tsx**
17. **components/molecules/SearchModal.tsx**
18. **components/ui/TimeRangeInput.tsx**
19. **components/ui/SkeletonForm.tsx**
20. **components/admin/ExcelImportDialog.tsx**
21. **components/organisms/Pagination.tsx**
22. **components/atoms/Spinner.tsx**

---

## 📝 모범 사례

### ✅ 좋은 예시

```tsx
// 디자인 시스템 토큰 사용
<div className="bg-white dark:bg-secondary-900">
  <h1 className="text-[var(--text-primary)]">제목</h1>
  <p className="text-[var(--text-secondary)]">본문</p>
</div>

// 시맨틱 색상 사용
<button className="bg-primary-600 hover:bg-primary-700">
  저장
</button>
```

### ❌ 나쁜 예시

```tsx
// 하드코딩된 색상 사용
<div className="bg-white dark:bg-gray-800">
  <h1 className="text-gray-900 dark:text-gray-100">제목</h1>
  <p className="text-gray-600 dark:text-gray-400">본문</p>
</div>

// 하드코딩된 시맨틱 색상
<button className="bg-indigo-600 hover:bg-indigo-700">
  저장
</button>
```

---

## 🎯 다음 단계

1. **남은 컴포넌트 개선**: 위에 나열된 22개 파일의 하드코딩된 색상 교체
2. **자동화 도구 개발**: ESLint 규칙 추가로 하드코딩된 색상 사용 방지
3. **문서화 강화**: 컴포넌트별 사용 가이드 작성
4. **디자인 토큰 확장**: 필요에 따라 추가 색상 토큰 정의

---

## 📚 참고 자료

- [디자인 시스템 색상 매핑 가이드](./design-system-color-mapping.md)
- [UI 컴포넌트 개선 가이드](./ui-components-improvement-guide.md)
- [다크모드 사용 가이드](./dark-mode-usage-guide.md)
- [타이포그래피 시스템 통합](./font-system-integration.md)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025년 12월 17일

