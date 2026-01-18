# 학생 대시보드 다크모드 개선

**작업 일시**: 2025-02-06  
**목적**: 학생 대시보드 및 네비게이션의 다크모드 지원 개선

---

## 📋 작업 내용

### 1. 학생 대시보드 인디고 색상 개선

**파일**: `app/(student)/dashboard/page.tsx`

**변경 사항**:
- 하드코딩된 인디고 색상 (`text-indigo-600 dark:text-indigo-400`)을 유틸리티 함수로 변경
- `getIndigoTextClasses("heading")` 사용으로 일관성 향상

**변경 전**:
```tsx
<span className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-400">
  {todayProgress}%
</span>
```

**변경 후**:
```tsx
<span className={cn("text-4xl md:text-5xl font-bold", getIndigoTextClasses("heading"))}>
  {todayProgress}%
</span>
```

### 2. ActiveLearningWidget 버튼 다크모드 지원

**파일**: `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`

**변경 사항**:
- "상세보기" 버튼에 다크모드 색상 추가
- `bg-gray-600` → `bg-gray-600 dark:bg-gray-500`
- `hover:bg-gray-700` → `hover:bg-gray-700 dark:hover:bg-gray-600`

**변경 전**:
```tsx
className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition-base hover:bg-gray-700"
```

**변경 후**:
```tsx
className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 dark:bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-base hover:bg-gray-700 dark:hover:bg-gray-600"
```

### 3. QuickActionCard 텍스트 색상 명시

**파일**: `app/(student)/dashboard/page.tsx`

**변경 사항**:
- `getGradientCardClasses()`가 이미 텍스트 색상을 포함하고 있음을 주석으로 명시
- 텍스트 요소는 그라디언트 카드 클래스의 색상을 상속받음

**추가된 주석**:
```tsx
{/* 텍스트 색상은 getGradientCardClasses에서 이미 포함됨 (예: text-indigo-900 dark:text-indigo-200) */}
```

---

## ✅ 검증 사항

- [x] 린터 오류 없음
- [x] 다크모드 전환 시 색상이 올바르게 표시됨
- [x] 유틸리티 함수 사용으로 일관성 향상
- [x] 기존 기능 유지

---

## 📝 참고 사항

### 다크모드 유틸리티 활용

프로젝트의 `lib/utils/darkMode.ts`에는 다양한 다크모드 유틸리티가 제공됩니다:

- **CSS 변수 기반 (권장)**: `textPrimaryVar`, `bgSurfaceVar`, `borderDefaultVar`
- **함수 기반**: `getIndigoTextClasses()`, `getGradientCardClasses()`, `getStatusBadgeColorClasses()`
- **레거시 (deprecated)**: `textPrimary`, `bgSurface`, `borderDefault`

### 네비게이션 다크모드 상태

네비게이션 시스템은 이미 다크모드를 완벽하게 지원하고 있습니다:

- `components/navigation/global/navStyles.ts`: 다크모드 색상 토큰 정의
- `CategoryNav`: 다크모드 스타일 적용
- `RoleBasedLayout`: 배경색 다크모드 지원
- `ThemeToggle`: 사이드바 푸터에 포함되어 테마 전환 가능

---

## 🔄 향후 개선 사항

1. **다른 학생 페이지 컴포넌트 검토**: 일관된 다크모드 패턴 적용 여부 확인
2. **하드코딩된 색상 제거**: 프로젝트 전반에서 하드코딩된 색상을 유틸리티 함수로 교체
3. **CSS 변수 기반 유틸리티 확대**: 새로운 코드에서는 CSS 변수 기반 유틸리티 우선 사용

---

**관련 파일**:
- `app/(student)/dashboard/page.tsx`
- `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`
- `lib/utils/darkMode.ts`
- `components/navigation/global/navStyles.ts`

