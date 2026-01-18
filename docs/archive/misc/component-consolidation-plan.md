# 컴포넌트 통합 계획

**작성 일시**: 2025-01-XX  
**목적**: 중복된 컴포넌트를 통합하여 코드베이스 일관성 향상

---

## 📊 현재 상황 분석

### 1. Button 컴포넌트

#### 사용 현황
- `components/ui/button.tsx`: **4개 파일**에서 사용
- `components/atoms/Button.tsx`: **29개 파일**에서 사용

#### 차이점 분석

| 항목 | ui/button.tsx | atoms/Button.tsx |
|------|--------------|------------------|
| 기능 | 기본 variant/size | isLoading, fullWidth 등 추가 기능 |
| 스타일링 | 간단한 variant | 디자인 시스템 컬러 완전 적용 |
| 다크모드 | 부분 지원 | 완전 지원 |
| 접근성 | 기본 | aria-label 자동 처리 |
| 상태 | 최근 수정됨 | 더 개선된 버전 |

**결론**: `atoms/Button.tsx`가 더 기능이 많고 개선된 버전입니다.

---

### 2. FormInput vs Input

#### 사용 현황
- `components/ui/FormInput.tsx`: **2개 파일**에서 사용
- `components/atoms/Input.tsx`: **8개 파일**에서 사용

#### 차이점 분석

| 항목 | ui/FormInput.tsx | atoms/Input.tsx |
|------|-----------------|-----------------|
| 용도 | 폼 전용 (label + error 포함) | 순수 input 컴포넌트 |
| Props | label, error 필수 | inputSize, hasError 옵션 |
| 구조 | label + input + error | input만 |
| 사용 패턴 | 단독 사용 | FormField와 함께 사용 |

**결론**: **용도가 다르므로 별도 유지**가 적절합니다.
- `FormInput`: 간단한 폼에서 label과 error를 함께 표시할 때
- `Input`: `FormField`와 함께 사용하거나 커스텀 레이아웃이 필요할 때

---

### 3. EmptyState 컴포넌트

#### 사용 현황
- `components/ui/EmptyState.tsx`: **17개 파일**에서 사용
- `components/molecules/EmptyState.tsx`: **13개 파일**에서 사용

#### 차이점 분석

| 항목 | ui/EmptyState.tsx | molecules/EmptyState.tsx |
|------|------------------|-------------------------|
| icon 타입 | string만 | ReactNode 지원 |
| action | actionHref만 | actionHref + onAction 지원 |
| variant | 없음 | default/compact 지원 |
| headingLevel | 고정 (h3) | h2/h3/h4/p 선택 가능 |
| 타이포그래피 | text-lg, text-sm | 타이포그래피 시스템 적용 |
| 스타일링 | 간단 | 더 세밀한 스타일링 |

**결론**: `molecules/EmptyState.tsx`가 더 기능이 많고 개선된 버전입니다.

---

## 🎯 통합 계획

### Phase 1: Button 컴포넌트 통합 (우선순위: 높음)

#### 작업 내용
1. `components/ui/button.tsx`에 deprecation 경고 추가
2. `components/ui/index.ts`에서 Button export에 deprecation 주석 추가
3. 사용 중인 4개 파일을 `atoms/Button`으로 마이그레이션
4. 마이그레이션 완료 후 `components/ui/button.tsx` 삭제

#### 마이그레이션 대상 파일
- `app/signup/page.tsx`
- `app/(student)/settings/_components/SettingsPageClient.tsx`
- `app/(superadmin)/superadmin/terms-management/_components/TermsContentForm.tsx`
- `app/(student)/contents/_components/ContentActionButtons.tsx`

#### 마이그레이션 가이드
```tsx
// Before
import { Button } from "@/components/ui/button";

// After
import Button from "@/components/atoms/Button";

// Props는 대부분 호환됨
// variant: "default" → "primary"
// size: "default" → "md"
```

---

### Phase 2: EmptyState 컴포넌트 통합 (우선순위: 중간)

#### 작업 내용
1. `components/ui/EmptyState.tsx`에 deprecation 경고 추가
2. `components/ui/index.ts`에서 EmptyState export에 deprecation 주석 추가
3. 사용 중인 17개 파일을 `molecules/EmptyState`로 마이그레이션
4. 마이그레이션 완료 후 `components/ui/EmptyState.tsx` 삭제

#### 마이그레이션 가이드
```tsx
// Before
import { EmptyState } from "@/components/ui/EmptyState";

<EmptyState
  title="제목"
  description="설명"
  actionLabel="액션"
  actionHref="/path"
  icon="📭"
/>

// After
import { EmptyState } from "@/components/molecules/EmptyState";

<EmptyState
  title="제목"
  description="설명"
  actionLabel="액션"
  actionHref="/path"
  icon="📭"  // ReactNode도 지원
/>
```

---

### Phase 3: FormInput 유지 (우선순위: 낮음)

#### 결정 사항
- `FormInput`과 `Input`은 **용도가 다르므로 별도 유지**
- `FormInput`: 간단한 폼에서 빠르게 사용
- `Input`: `FormField`와 함께 사용하거나 더 세밀한 제어가 필요할 때

#### 개선 사항 (선택)
- `FormInput`도 타이포그래피 시스템 적용 고려
- `FormInput`의 스타일을 `Input`과 일관되게 맞추기

---

## 📋 실행 계획

### Step 1: Button 컴포넌트 통합
- [ ] `components/ui/button.tsx`에 deprecation 경고 추가
- [ ] `components/ui/index.ts` 업데이트
- [ ] 4개 파일 마이그레이션
- [ ] 테스트 및 검증
- [ ] `components/ui/button.tsx` 삭제

### Step 2: EmptyState 컴포넌트 통합
- [ ] `components/ui/EmptyState.tsx`에 deprecation 경고 추가
- [ ] `components/ui/index.ts` 업데이트
- [ ] 17개 파일 마이그레이션
- [ ] 테스트 및 검증
- [ ] `components/ui/EmptyState.tsx` 삭제

### Step 3: 문서화
- [ ] 마이그레이션 가이드 문서 작성
- [ ] 컴포넌트 사용 가이드 업데이트

---

## ⚠️ 주의사항

### 1. 하위 호환성
- 기존 코드가 동작하도록 점진적으로 마이그레이션
- Deprecation 경고를 먼저 추가하여 개발자에게 알림

### 2. 테스트
- 마이그레이션 후 각 페이지에서 시각적 확인
- 기능 테스트 수행

### 3. 문서화
- 마이그레이션 가이드 제공
- 새로운 컴포넌트 사용법 문서화

---

## 📊 예상 효과

### Before
- ❌ 중복된 컴포넌트로 인한 혼란
- ❌ 일관성 없는 스타일링
- ❌ 유지보수 어려움

### After
- ✅ 단일 컴포넌트로 통일
- ✅ 일관된 스타일링 및 기능
- ✅ 유지보수 용이

---

## 📚 참고 자료

- Atomic Design 패턴: `components/atoms`, `components/molecules`
- 디자인 시스템: `app/globals.css`
- 타이포그래피 시스템: `docs/ui-typography-system-guide.md`

---

**마지막 업데이트**: 2025-01-XX

