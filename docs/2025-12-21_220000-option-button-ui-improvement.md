# 옵션 버튼 UI 개선

## 📋 작업 개요

Step6FinalReview의 "교과별 일괄 설정" 옵션 버튼 UI를 검토하고 개선했습니다. 프로젝트 디자인 시스템과의 일관성, 접근성, 시각적 피드백을 향상시켰습니다.

## 🎯 개선 목표

1. 프로젝트 디자인 시스템과의 일관성 확보
2. 접근성 속성 추가 (ARIA)
3. 활성화 상태 시각적 피드백 개선
4. 사용자 경험 향상

## 🔧 변경 사항

### 파일
`app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

### 개선 내용

#### 1. 디자인 시스템 일관성

**변경 전:**
```tsx
className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
```

**변경 후:**
```tsx
className={`
  inline-flex items-center justify-center gap-1.5
  rounded-lg border border-transparent
  px-3 py-1.5
  text-xs font-semibold
  transition-all duration-200
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
  disabled:cursor-not-allowed disabled:opacity-50
  ${
    batchSettingSubjectGroup === subjectGroup
      ? "bg-primary-700 text-white shadow-sm hover:bg-primary-800 active:scale-[0.98]"
      : "bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:shadow-md active:scale-[0.98]"
  }
`}
```

**개선 사항:**
- `rounded-md` → `rounded-lg` (프로젝트 표준)
- `bg-blue-600` → `bg-primary-600` (디자인 시스템 색상)
- `font-medium` → `font-semibold` (가독성 향상)
- `transition` → `transition-all duration-200` (부드러운 애니메이션)
- `active:scale-[0.98]` 추가 (클릭 피드백)
- `shadow-sm`, `hover:shadow-md` 추가 (깊이감)
- `focus-visible:ring-2` 추가 (접근성)

#### 2. 접근성 개선

**추가된 속성:**
```tsx
aria-label={
  batchSettingSubjectGroup === subjectGroup
    ? `${subjectGroup} 일괄 설정 취소`
    : `${subjectGroup} 교과별 일괄 설정`
}
aria-expanded={batchSettingSubjectGroup === subjectGroup}
```

**개선 효과:**
- 스크린 리더 사용자를 위한 명확한 설명
- 버튼 상태를 `aria-expanded`로 명시
- 교과명을 포함한 구체적인 설명

#### 3. 활성화 상태 시각적 피드백

**개선 사항:**
- 활성화 상태: `bg-primary-700` (더 진한 색상)
- 비활성화 상태: `bg-primary-600` (기본 색상)
- 호버 효과: `hover:bg-primary-800` / `hover:bg-primary-700`
- 클릭 효과: `active:scale-[0.98]` (눌림 효과)

## 📊 UI 비교

### Before
- 단순한 파란색 버튼
- 접근성 속성 부족
- 활성화 상태 구분이 약함
- 프로젝트 디자인 시스템과 불일치

### After
- 프로젝트 디자인 시스템 준수 (primary 색상)
- 접근성 속성 완비 (ARIA)
- 명확한 활성화/비활성화 상태 구분
- 부드러운 애니메이션 및 피드백
- 일관된 스타일링

## ✅ 체크리스트

- [x] 프로젝트 디자인 시스템 색상 사용 (primary)
- [x] 접근성 속성 추가 (aria-label, aria-expanded)
- [x] 활성화 상태 시각적 피드백 개선
- [x] 포커스 스타일 추가 (focus-visible)
- [x] 클릭 피드백 추가 (active:scale)
- [x] 호버 효과 개선
- [x] 린터 오류 없음

## 🚀 향후 개선 사항

1. **아이콘 추가**: 버튼에 아이콘을 추가하여 시각적 명확성 향상
   - 일괄 설정: `Settings` 또는 `Layers` 아이콘
   - 취소: `X` 또는 `Minus` 아이콘

2. **반응형 텍스트**: 작은 화면에서 텍스트 단축
   - "교과별 일괄 설정" → "일괄 설정" (모바일)

3. **툴팁 추가**: 버튼 기능에 대한 추가 설명

## 📝 참고 사항

- 프로젝트의 Button 컴포넌트(`components/atoms/Button.tsx`)를 사용하는 것도 고려 가능
- 현재는 인라인 스타일로 구현하여 더 세밀한 제어 가능
- 디자인 시스템의 primary 색상을 사용하여 일관성 유지

