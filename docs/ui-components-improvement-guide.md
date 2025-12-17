# UI 컴포넌트 개선 가이드

**작업 완료일**: 2025년 12월 17일  
**참고 디자인 시스템**: Untitled UI, Material-UI  
**적용 트렌드**: 2025년 웹 디자인 트렌드

---

## 📋 개요

이 문서는 Figma 디자인 시스템을 참고하여 개선된 UI 컴포넌트의 사용법과 구현 세부사항을 설명합니다.

---

## 🎨 전역 스타일 시스템

### Elevation 시스템

Material Design의 Elevation 시스템(0-24dp)을 참고하여 구현했습니다. `app/globals.css`에 CSS 변수로 정의되어 있습니다.

#### 사용 가능한 Elevation 레벨

```css
--elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);
--elevation-1: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--elevation-2: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--elevation-4: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--elevation-8: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--elevation-16: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--elevation-24: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

#### Tailwind CSS에서 사용하기

```tsx
// CSS 변수 직접 사용
<div className="shadow-[var(--elevation-2)]">...</div>

// 또는 Card 컴포넌트의 elevation prop 사용
<Card elevation={2}>...</Card>
```

### Transition 시스템

2025년 웹 트렌드를 반영한 짧은 지속시간(100-300ms)의 transition 시스템입니다.

#### 사용 가능한 Transition 클래스

```css
.transition-base  /* 150ms cubic-bezier(0.4, 0, 0.2, 1) */
.transition-fast  /* 100ms cubic-bezier(0.4, 0, 0.2, 1) */
.transition-slow  /* 300ms cubic-bezier(0.4, 0, 0.2, 1) */
```

#### 접근성 지원

`prefers-reduced-motion` 미디어 쿼리를 통해 애니메이션을 선호하지 않는 사용자를 위해 transition이 자동으로 비활성화됩니다.

```css
@media (prefers-reduced-motion: reduce) {
  .transition-base,
  .transition-fast,
  .transition-slow {
    transition: none;
  }
}
```

---

## 🧩 컴포넌트 개선 사항

### 1. Button 컴포넌트

#### 개선 사항

- ✅ **Elevation 시스템 통합**: Primary/Destructive 버튼에 shadow 적용
- ✅ **Transition 개선**: `transition-base` 클래스 사용
- ✅ **Active 상태**: 클릭 시 `active:scale-[0.98]` 피드백
- ✅ **Focus-visible 스타일**: 명확한 키보드 포커스 표시

#### 사용 예시

```tsx
import Button from "@/components/atoms/Button";

// Primary 버튼 (Elevation 적용)
<Button variant="primary">저장</Button>

// Secondary 버튼 (Elevation 없음)
<Button variant="secondary">취소</Button>

// Destructive 버튼 (Elevation 적용)
<Button variant="destructive">삭제</Button>

// 로딩 상태
<Button variant="primary" isLoading>처리 중...</Button>
```

#### Variant별 Elevation

- **Primary**: `elevation-2` → `elevation-4` (hover)
- **Destructive**: `elevation-2` → `elevation-4` (hover)
- **Secondary/Outline/Ghost/Link**: Elevation 없음

---

### 2. Input 컴포넌트

#### 개선 사항

- ✅ **Transition 개선**: `transition-base` 클래스 사용 (이전: `transition-colors`)
- ✅ **Focus 상태**: 부드러운 transition으로 border/ring 색상 변경
- ✅ **Error 상태**: 시각적 피드백 강화

#### 사용 예시

```tsx
import Input from "@/components/atoms/Input";

// 기본 Input
<Input placeholder="이름을 입력하세요" />

// Error 상태
<Input 
  hasError 
  aria-describedby="error-message"
  placeholder="이메일을 입력하세요"
/>
<span id="error-message" className="text-error-600">
  올바른 이메일 형식이 아닙니다
</span>

// 크기 조절
<Input inputSize="sm" placeholder="작은 Input" />
<Input inputSize="lg" placeholder="큰 Input" />
```

---

### 3. Card 컴포넌트

#### 개선 사항

- ✅ **Elevation prop 추가**: Material Design Elevation 시스템 지원 (0, 1, 2, 4, 8, 16, 24)
- ✅ **Hover 효과 개선**: Interactive variant에서 hover 시 elevation 증가 및 translate 효과
- ✅ **CVA 기반**: 타입 안전한 variant 시스템

#### 사용 예시

```tsx
import Card, { CardHeader, CardContent, CardFooter } from "@/components/molecules/Card";

// 기본 Card (elevation 2)
<Card>
  <CardHeader title="제목" description="설명" />
  <CardContent>
    <p>내용</p>
  </CardContent>
</Card>

// Elevation 조절
<Card elevation={4}>
  <CardHeader title="높은 Elevation" />
  <CardContent>더 강한 그림자 효과</CardContent>
</Card>

// Interactive Card (hover 효과)
<Card variant="interactive" elevation={2}>
  <CardHeader title="클릭 가능한 Card" />
  <CardContent>hover 시 elevation 증가</CardContent>
</Card>

// Padding 조절
<Card padding="sm">작은 패딩</Card>
<Card padding="lg">큰 패딩</Card>
<Card padding="none">패딩 없음</Card>
```

#### Elevation 레벨 가이드

- **0**: 그림자 없음 (평면)
- **1-2**: 카드, 버튼 (기본)
- **4**: 호버 상태, 드롭다운
- **8**: 모달, 다이얼로그
- **16**: 드로어, 사이드바
- **24**: 최상위 레이어 (팝오버)

---

### 4. Badge 컴포넌트

#### 개선 사항

- ✅ **Outline variant 추가**: 테두리만 있는 배지 스타일
- ✅ **CVA 기반**: 타입 안전한 variant 시스템
- ✅ **Semantic Colors**: 다크모드 자동 대응

#### 사용 예시

```tsx
import Badge from "@/components/atoms/Badge";

// 기본 Badge
<Badge>기본</Badge>

// Semantic Colors
<Badge variant="primary">Primary</Badge>
<Badge variant="success">성공</Badge>
<Badge variant="warning">경고</Badge>
<Badge variant="error">오류</Badge>
<Badge variant="info">정보</Badge>

// Outline variant (신규)
<Badge variant="outline">테두리만</Badge>

// 크기 조절
<Badge size="xs">XS</Badge>
<Badge size="sm">SM</Badge>
<Badge size="md">MD</Badge>
<Badge size="lg">LG</Badge>
```

---

## 🎯 모범 사례

### Elevation 사용 가이드

1. **일관성 유지**: 같은 계층의 요소는 동일한 elevation 사용
2. **계층 구조**: 상위 레이어일수록 높은 elevation
3. **인터랙션 피드백**: hover/active 시 elevation 증가로 피드백 제공

### Transition 사용 가이드

1. **표준 사용**: 대부분의 경우 `transition-base` 사용
2. **빠른 피드백**: 버튼 클릭 등 즉각적인 피드백은 `transition-fast`
3. **부드러운 전환**: 모달 열기/닫기 등은 `transition-slow`

### 접근성 고려사항

1. **키보드 네비게이션**: 모든 인터랙티브 요소는 `focus-visible` 스타일 적용
2. **애니메이션 감소**: `prefers-reduced-motion` 지원으로 자동 비활성화
3. **색상 대비**: WCAG 2.1 AA 기준 준수

---

## 📊 개선 전후 비교

### Button 컴포넌트

**Before**:
```tsx
primary: "bg-primary-600 hover:bg-primary-700 transition-colors"
```

**After**:
```tsx
primary: cn(
  "bg-primary-600 dark:bg-primary-500 text-white",
  "shadow-[var(--elevation-2)] hover:shadow-[var(--elevation-4)]",
  "hover:bg-primary-700 dark:hover:bg-primary-600",
  "active:scale-[0.98] active:shadow-[var(--elevation-1)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
  "transition-base",
  "border-transparent"
)
```

### Card 컴포넌트

**Before**:
```tsx
<Card>...</Card> // 고정된 shadow
```

**After**:
```tsx
<Card elevation={2}>...</Card> // Elevation prop으로 조절 가능
<Card variant="interactive" elevation={4}>...</Card> // Hover 효과 개선
```

---

## 🔗 참고 자료

- [Untitled UI Figma](https://www.figma.com/design/IH12EvD9GQIhlYfOuVXnUV/...)
- [Material-UI Figma](https://www.figma.com/design/Yglsq9Y6KXdirARMjbSsua/...)
- [shadcn/ui Button Docs](https://ui.shadcn.com/docs/components/button)
- [Tailwind CSS Shadow Docs](https://tailwindcss.com/docs/box-shadow)
- [Material Design Elevation](https://m3.material.io/styles/elevation/overview)

---

## ✅ 체크리스트

개선 작업 완료 항목:

- [x] `app/globals.css`에 Elevation 시스템 추가
- [x] `app/globals.css`에 Transition 시스템 추가
- [x] Button 컴포넌트 Elevation 적용
- [x] Button 컴포넌트 Transition 개선
- [x] Input 컴포넌트 Transition 개선
- [x] Card 컴포넌트 Elevation prop 추가
- [x] Badge 컴포넌트 Outline variant 추가
- [x] `prefers-reduced-motion` 지원
- [x] 컴포넌트 사용법 문서화

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025년 12월 17일

