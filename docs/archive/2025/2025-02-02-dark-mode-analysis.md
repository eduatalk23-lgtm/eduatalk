# 다크모드 지원 현황 분석

**작업 일시**: 2025-02-02  
**목적**: 프로젝트의 다크모드 지원 현황 분석 및 개선 방안 제시

---

## 📋 현재 상태

### ✅ 정의된 항목

1. **CSS 변수 정의** (`app/globals.css`)
   - 라이트 모드 CSS 변수 정의됨
   - 다크 모드 CSS 변수 정의됨 (`@media (prefers-color-scheme: dark)`)
   - 하지만 실제로는 거의 사용되지 않음

2. **일부 컴포넌트에서 CSS 변수 사용**
   - `app/(student)/settings/page.tsx`
   - `app/(student)/settings/account/page.tsx`
   - `text-[var(--text-primary)]` 형태로 사용

### ❌ 문제점

1. **대부분의 컴포넌트가 하드코딩된 색상 사용**
   ```jsx
   // 현재 상태 (다크모드 미지원)
   <div className="bg-white text-gray-900">내용</div>
   ```

2. **다크모드 라이브러리 미설치**
   - `next-themes` 같은 테마 전환 라이브러리 없음
   - 사용자가 수동으로 다크모드를 선택할 수 없음

3. **Tailwind `dark:` 클래스 미사용**
   - Tailwind의 다크모드 기능을 활용하지 않음

---

## 🎯 개선 방안

### 옵션 1: Tailwind `dark:` 클래스 사용 (권장)

**장점**:
- Tailwind 네이티브 기능 활용
- 클래스 기반으로 명확하고 직관적
- 빌드 시 최적화됨

**구현 방법**:
```jsx
// 변경 전
<div className="bg-white text-gray-900">내용</div>

// 변경 후
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">내용</div>
```

**필요 작업**:
1. `tailwind.config.ts`에 `darkMode: 'class'` 설정
2. `next-themes` 설치 및 설정
3. 모든 컴포넌트에 `dark:` 클래스 추가

### 옵션 2: CSS 변수 활용

**장점**:
- 이미 정의된 CSS 변수 활용
- 중앙 집중식 색상 관리

**구현 방법**:
```jsx
// 변경 전
<div className="bg-white text-gray-900">내용</div>

// 변경 후
<div className="bg-[var(--background)] text-[var(--text-primary)]">내용</div>
```

**필요 작업**:
1. 모든 컴포넌트의 하드코딩된 색상을 CSS 변수로 변경
2. `next-themes` 설치 및 설정

### 옵션 3: 하이브리드 접근

**장점**:
- CSS 변수로 기본 색상 관리
- Tailwind `dark:` 클래스로 세밀한 제어

**구현 방법**:
```jsx
<div className="bg-white dark:bg-gray-900 text-[var(--text-primary)]">내용</div>
```

---

## 📊 영향 범위

프로젝트 전체에서 하드코딩된 색상 클래스를 사용하는 파일이 많습니다:

- 관리자 페이지: 약 50+ 파일
- 학생 페이지: 약 100+ 파일
- 공통 컴포넌트: 약 30+ 파일

**예상 작업량**: 대규모 리팩토링 필요

---

## 🚀 권장 구현 순서

### Phase 1: 인프라 설정
1. `next-themes` 설치
2. `ThemeProvider` 설정
3. `tailwind.config.ts`에 `darkMode: 'class'` 설정

### Phase 2: 공통 컴포넌트
1. `components/atoms/` 컴포넌트들
2. `components/molecules/` 컴포넌트들
3. `components/organisms/` 컴포넌트들

### Phase 3: 페이지별 적용
1. 관리자 페이지
2. 학생 페이지
3. 기타 페이지

### Phase 4: 테스트 및 검증
1. 다크모드 전환 테스트
2. 모든 페이지 시각적 검증
3. 접근성 검증

---

## 💡 즉시 적용 가능한 개선

### 1. 기본 배경색 개선

`app/layout.tsx`에 다크모드 배경색 추가:

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-900`}>
```

### 2. 공통 컴포넌트 우선 적용

가장 많이 사용되는 컴포넌트부터 다크모드 지원:
- `components/atoms/Button.tsx`
- `components/atoms/Input.tsx`
- `components/molecules/Card.tsx`
- `components/organisms/Dialog.tsx`

---

## 📝 체크리스트

다크모드 지원을 위해 확인해야 할 항목:

- [ ] `next-themes` 설치
- [ ] `ThemeProvider` 설정
- [ ] `tailwind.config.ts`에 `darkMode: 'class'` 설정
- [ ] 공통 컴포넌트에 `dark:` 클래스 추가
- [ ] 페이지별 컴포넌트에 `dark:` 클래스 추가
- [ ] 테마 전환 버튼 UI 추가
- [ ] 다크모드 테스트

---

**현재 상태**: ❌ 다크모드 미지원  
**권장 사항**: 옵션 1 (Tailwind `dark:` 클래스) 사용

