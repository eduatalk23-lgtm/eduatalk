# 다크모드 지원 구현

**작업 일시**: 2025-02-02  
**목적**: 프로젝트에 다크모드 지원 추가

---

## 📋 구현 내용

### 1. 인프라 설정

#### next-themes 설치
```bash
npm install next-themes
```

#### ThemeProvider 생성
**파일**: `lib/providers/ThemeProvider.tsx`

- `next-themes`의 `ThemeProvider` 래핑
- `attribute="class"`: HTML 클래스 기반 테마 전환
- `defaultTheme="light"`: 기본 라이트 모드
- `enableSystem={true}`: 시스템 설정 감지

#### Providers에 추가
**파일**: `app/providers.tsx`

```tsx
<ThemeProvider>
  <QueryProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </QueryProvider>
</ThemeProvider>
```

#### 레이아웃 설정
**파일**: `app/layout.tsx`

- `suppressHydrationWarning` 추가 (next-themes hydration 이슈 방지)
- 기본 배경색 및 텍스트 색상 추가

---

### 2. 공통 컴포넌트 다크모드 지원

#### Button 컴포넌트
**파일**: `components/atoms/Button.tsx`

모든 variant에 `dark:` 클래스 추가:
- `primary`: `dark:bg-gray-100 dark:text-gray-900`
- `secondary`: `dark:bg-gray-800 dark:text-gray-100`
- `outline`: `dark:bg-gray-800 dark:border-gray-700`
- `ghost`: `dark:hover:bg-gray-800`
- `link`: `dark:text-gray-100`

#### Input 컴포넌트
**파일**: `components/atoms/Input.tsx`

- 배경: `dark:bg-gray-800`
- 텍스트: `dark:text-gray-100`
- placeholder: `dark:placeholder:text-gray-400`
- 테두리: `dark:border-gray-700`
- 포커스: `dark:focus:border-gray-100`

#### Card 컴포넌트
**파일**: `components/molecules/Card.tsx`

- 배경: `dark:bg-gray-800`
- 테두리: `dark:border-gray-800`
- 제목: `dark:text-gray-100`
- 설명: `dark:text-gray-400`
- Footer 구분선: `dark:border-gray-700`

#### Dialog 컴포넌트
**파일**: `components/organisms/Dialog.tsx`

- 배경: `dark:bg-gray-800`
- 테두리: `dark:border-gray-800`
- 제목: `dark:text-gray-100`
- 설명: `dark:text-gray-300`
- 닫기 버튼: `dark:text-gray-400 dark:hover:bg-gray-700`

---

### 3. 페이지 다크모드 지원

#### 관리자 설정 페이지
**파일**: `app/(admin)/admin/settings/page.tsx`

모든 카드 및 텍스트에 `dark:` 클래스 추가:
- 카드 배경: `dark:bg-gray-800`
- 카드 테두리: `dark:border-gray-800`
- 제목: `dark:text-gray-100`
- 본문: `dark:text-gray-400`
- 링크: `dark:hover:bg-gray-700`

#### 스케줄러 설정 페이지
**파일**: 
- `app/(admin)/admin/settings/scheduler/page.tsx`
- `app/(admin)/admin/settings/scheduler/_components/SchedulerSettingsForm.tsx`

모든 입력 필드 및 섹션에 `dark:` 클래스 추가:
- 섹션 배경: `dark:bg-gray-800`
- 섹션 테두리: `dark:border-gray-700`
- 라벨: `dark:text-gray-200`
- 입력 필드: `dark:bg-gray-900 dark:text-gray-100`
- 보조 텍스트: `dark:text-gray-400`

---

### 4. 테마 전환 버튼

#### ThemeToggle 컴포넌트
**파일**: `components/ui/ThemeToggle.tsx`

**기능**:
- 라이트/다크 모드 전환
- 시스템 설정 감지
- Hydration mismatch 방지
- 아이콘 표시 (Sun/Moon)

**사용 방법**:
```tsx
import { ThemeToggle } from "@/components/ui/ThemeToggle";

<ThemeToggle />
```

---

## 🎨 색상 매핑

### 텍스트 색상

| 용도 | 라이트 모드 | 다크 모드 |
|------|-----------|---------|
| 제목, 주요 텍스트 | `text-gray-900` | `dark:text-gray-100` |
| 부제목, 라벨 | `text-gray-800` | `dark:text-gray-200` |
| 본문, 설명 | `text-gray-600` | `dark:text-gray-400` |
| 보조 텍스트 | `text-gray-500` | `dark:text-gray-400` |

### 배경 색상

| 용도 | 라이트 모드 | 다크 모드 |
|------|-----------|---------|
| 페이지 배경 | `bg-white` | `dark:bg-gray-900` |
| 카드 배경 | `bg-white` | `dark:bg-gray-800` |
| 입력 필드 | `bg-white` | `dark:bg-gray-900` |

### 테두리 색상

| 용도 | 라이트 모드 | 다크 모드 |
|------|-----------|---------|
| 일반 테두리 | `border-gray-300` | `dark:border-gray-700` |
| 카드 테두리 | `border-gray-200` | `dark:border-gray-800` |
| 구분선 | `border-gray-100` | `dark:border-gray-700` |

---

## 📝 사용 가이드

### 새 컴포넌트 작성 시

```tsx
// ✅ 좋은 예
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <h2 className="text-h2 text-gray-900 dark:text-gray-100">제목</h2>
  <p className="text-body-2 text-gray-600 dark:text-gray-400">본문</p>
</div>

// ❌ 나쁜 예 (다크모드 미지원)
<div className="bg-white text-gray-900">
  <h2 className="text-h2 text-gray-900">제목</h2>
</div>
```

### 테마 전환 버튼 추가

네비게이션 바나 헤더에 추가:

```tsx
import { ThemeToggle } from "@/components/ui/ThemeToggle";

<nav>
  {/* ... 다른 메뉴 항목들 ... */}
  <ThemeToggle />
</nav>
```

---

## ✅ 체크리스트

다크모드 지원을 위해 확인해야 할 항목:

- [x] `next-themes` 설치
- [x] `ThemeProvider` 설정
- [x] 레이아웃에 기본 다크모드 스타일 추가
- [x] 공통 컴포넌트에 `dark:` 클래스 추가
- [x] 주요 페이지에 `dark:` 클래스 추가
- [ ] 테마 전환 버튼 UI 추가 (컴포넌트는 생성됨)
- [ ] 모든 페이지에 다크모드 적용 (점진적 진행)

---

## 🔜 향후 작업

### Phase 1: 추가 페이지 지원
- [ ] 학생 페이지
- [ ] 부모 페이지
- [ ] Super Admin 페이지

### Phase 2: 고급 기능
- [ ] 테마 전환 애니메이션
- [ ] 테마 설정 저장 (localStorage)
- [ ] 접근성 개선

---

## 📚 참고 자료

- [next-themes 문서](https://github.com/pacocoursey/next-themes)
- [Tailwind CSS 다크모드](https://tailwindcss.com/docs/dark-mode)

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: 다크모드 지원 추가`

