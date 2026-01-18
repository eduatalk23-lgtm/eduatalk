# Figma 디자인 시스템 참고 UI 개선 검토 보고서

**작업 일자**: 2025년 12월 17일  
**참고 디자인 시스템**:

- [Untitled UI - FREE Figma UI kit and design system v2.0](https://www.figma.com/design/IH12EvD9GQIhlYfOuVXnUV/%E2%9D%96-Untitled-UI-%E2%80%93-FREE-Figma-UI-kit-and-design-system-v2.0--Community-?m=auto&t=R6cSY288SktOejsP-6)
- [Material-UI for Figma - and MUI X](https://www.figma.com/design/Yglsq9Y6KXdirARMjbSsua/Material-UI-for-Figma--and-MUI-X---Community-?m=auto&t=R6cSY288SktOejsP-6)

---

## 📋 검토 개요

두 디자인 시스템의 모범 사례를 참고하여 현재 프로젝트의 UI 컴포넌트를 분석하고 개선 방안을 도출했습니다.

---

## 🔍 현재 프로젝트 상태 분석

### 디자인 시스템 구조

**강점**:

- ✅ CSS 변수 기반 색상 시스템 구축 완료
- ✅ 다크모드 자동 지원
- ✅ Semantic Color Palette (Primary, Secondary, Success, Warning, Error, Info)
- ✅ Atomic Design 패턴 적용 (atoms/molecules/organisms)
- ✅ Tailwind CSS 4 사용

**개선 가능 영역**:

- ⚠️ 컴포넌트 variant 및 size 시스템 일관성
- ⚠️ Shadow/Elevation 시스템 미구현
- ⚠️ Transition/Animation 시스템 표준화 필요
- ⚠️ Focus 상태 스타일 통일 필요

---

## 🎨 Untitled UI & Material-UI 참고 개선 방안

### 1. Button 컴포넌트 개선

#### 현재 상태

```tsx
// components/atoms/Button.tsx
- Variants: primary, secondary, destructive, outline, ghost, link
- Sizes: xs, sm, md, lg
- 로딩 상태 지원 ✅
- 접근성 속성 지원 ✅
```

#### 개선 방안 (Untitled UI / Material-UI 참고)

**1.1 Shadow/Elevation 추가**

```tsx
// Primary 버튼에 subtle shadow 추가
primary: "bg-primary-600 ... shadow-sm hover:shadow-md";
```

**1.2 Transition 개선**

```tsx
// 현재: transition-colors
// 개선: transition-all (shadow도 포함)
"transition-all duration-200 ease-in-out";
```

**1.3 Focus Ring 개선**

```tsx
// 현재: focus:ring-2 focus:ring-offset-2
// 개선: 더 명확한 focus 스타일
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";
```

**1.4 Active 상태 추가**

```tsx
// 버튼 클릭 시 피드백 강화
"active:scale-[0.98] active:shadow-sm";
```

---

### 2. Input 컴포넌트 개선

#### 현재 상태

```tsx
// components/atoms/Input.tsx
- Error 상태 지원 ✅
- Disabled 상태 지원 ✅
- CSS 변수 기반 색상 ✅
```

#### 개선 방안

**2.1 Input 상태별 스타일 강화**

```tsx
// Material-UI 스타일 참고
// - Floating label (선택적)
// - Helper text 영역
// - 아이콘 지원 (prefix/suffix)
```

**2.2 Focus 상태 개선**

```tsx
// 현재보다 더 부드러운 transition
"transition-all duration-200";
```

**2.3 Error 상태 시각적 피드백 강화**

```tsx
// Error 아이콘 표시 옵션
// Error 메시지와 연결된 스타일
```

---

### 3. Card 컴포넌트 개선

#### 현재 상태

```tsx
// components/molecules/Card.tsx
- Variants: default, interactive, error
- Padding: none, sm, md, lg
- 다크모드 지원 ✅
```

#### 개선 방안

**3.1 Elevation/Shadow 시스템 추가**

```tsx
// Material-UI Elevation 참고
// 0-24 레벨 elevation
elevation: {
  0: "shadow-none",
  1: "shadow-sm",
  2: "shadow",
  4: "shadow-md",
  8: "shadow-lg",
  16: "shadow-xl",
  24: "shadow-2xl"
}
```

**3.2 Hover 효과 개선**

```tsx
// Interactive variant에 더 명확한 hover 효과
"hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200";
```

---

### 4. Badge 컴포넌트 개선

#### 현재 상태

```tsx
// components/atoms/Badge.tsx
- Variants: default, primary, success, warning, error, info, gray
- Sizes: xs, sm, md, lg
```

#### 개선 방안 (Untitled UI 스타일)

**4.1 Dot Badge 지원**

```tsx
// 알림용 작은 점 배지
<Badge variant="primary" dot />
```

**4.2 Outline Variant 추가**

```tsx
// 테두리만 있는 배지 스타일
outline: "border border-current bg-transparent";
```

---

### 5. 전역 스타일 시스템 개선

#### 5.1 Shadow/Elevation 시스템 구축

**추가 제안**: `app/globals.css`에 Elevation 시스템 추가

```css
/* Elevation System */
--elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);
--elevation-1: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--elevation-2: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--elevation-4: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--elevation-8: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--elevation-16: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--elevation-24: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

#### 5.2 Transition 표준화

**추가 제안**: 공통 transition 유틸리티 클래스

```css
/* Transition System */
.transition-base {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.transition-fast {
  transition: all 100ms cubic-bezier(0.4, 0, 0.2, 1);
}
.transition-slow {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 📊 우선순위별 개선 계획

### Phase 1: 핵심 컴포넌트 개선 (1주)

**목표**: 가장 많이 사용되는 컴포넌트의 UX 개선

1. **Button 컴포넌트**

   - [ ] Shadow/Elevation 추가
   - [ ] Transition 개선
   - [ ] Active 상태 추가
   - [ ] Focus-visible 스타일 개선

2. **Input 컴포넌트**
   - [ ] Focus 상태 transition 개선
   - [ ] Helper text 영역 구조 개선

### Phase 2: 시각적 피드백 강화 (1주)

**목표**: 인터랙션 피드백 개선

1. **Card 컴포넌트**

   - [ ] Elevation 시스템 적용
   - [ ] Hover 효과 개선

2. **Badge 컴포넌트**
   - [ ] Outline variant 추가
   - [ ] Dot badge 지원 (선택적)

### Phase 3: 전역 시스템 구축 (1주)

**목표**: 재사용 가능한 스타일 시스템 구축

1. **Shadow/Elevation 시스템**

   - [ ] CSS 변수 추가
   - [ ] Tailwind 클래스 매핑

2. **Transition 시스템**
   - [ ] 표준 transition 유틸리티 추가

---

## 🎯 구체적인 개선 예시

### Button 컴포넌트 개선 예시

```tsx
// Before
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 ... hover:bg-primary-700 ...",
};

// After (Untitled UI / Material-UI 스타일 참고)
const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-primary-600 dark:bg-primary-500",
    "text-white",
    "shadow-sm hover:shadow-md",
    "hover:bg-primary-700 dark:hover:bg-primary-600",
    "active:scale-[0.98] active:shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
    "transition-all duration-200 ease-in-out",
    "border-transparent"
  ),
};
```

### Card 컴포넌트 개선 예시

```tsx
// Elevation prop 추가
export type CardElevation = 0 | 1 | 2 | 4 | 8 | 16 | 24;

const elevationClasses: Record<CardElevation, string> = {
  0: "shadow-none",
  1: "shadow-sm",
  2: "shadow",
  4: "shadow-md",
  8: "shadow-lg",
  16: "shadow-xl",
  24: "shadow-2xl",
};

// Interactive variant에 hover 효과 강화
interactive: cn(
  "border-secondary-200 dark:border-secondary-800",
  "bg-white dark:bg-secondary-900",
  "shadow-md",
  "transition-all duration-200",
  "hover:shadow-lg hover:-translate-y-0.5",
  "cursor-pointer"
),
```

---

## 📝 참고 자료

### Untitled UI 특징

- 깔끔하고 모던한 디자인
- 일관된 spacing 시스템
- 명확한 elevation/shadow 시스템
- 부드러운 transition 효과

### Material-UI 특징

- Material Design 원칙 준수
- 8dp Grid 시스템
- 명확한 Elevation 시스템 (0-24dp)
- Ripple 효과 및 Animation

### 프로젝트 적용 방향

- **Untitled UI**: 깔끔하고 모던한 스타일 채택
- **Material-UI**: Elevation 시스템 및 Grid 시스템 참고
- **프로젝트 정책 준수**: Spacing-First, 디자인 시스템 색상 사용

---

## ✅ 다음 단계

1. **우선순위 결정**: Phase 1 작업 시작 여부 확인
2. **구현 시작**: Button 컴포넌트부터 개선 작업 시작
3. **테스트 및 검증**: 각 컴포넌트 개선 후 시각적 검증
4. **문서화**: 개선된 컴포넌트 사용법 문서화

---

**작성자**: AI Assistant  
**작업 완료일**: 2025년 12월 17일
