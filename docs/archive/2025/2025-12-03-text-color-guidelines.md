# 텍스트 색상 가이드라인

**작업 일자**: 2025년 12월 3일  
**목적**: 네이티브 HTML 요소 및 텍스트 색상 미지정 문제 방지

## 📋 문제점

새로 만드는 페이지에서 다음과 같은 문제가 반복적으로 발생했습니다:

1. **input, textarea, select 등 네이티브 HTML 요소에 텍스트 색상 미지정**
   - 브라우저 기본 색상에 의존하여 다크모드에서 가독성 저하
   - 일관성 없는 텍스트 색상

2. **다크모드 대응 누락**
   - `dark:` 접두사가 없는 텍스트 색상 클래스
   - 라이트 모드에서만 정상 작동

3. **배경색과 텍스트 색상 불일치**
   - 배경색만 지정하고 텍스트 색상을 지정하지 않음
   - 다크모드에서 텍스트가 보이지 않는 경우 발생

## ✅ 해결 방법

### 1. 네이티브 HTML 입력 요소 텍스트 색상 필수 지정

모든 `input`, `textarea`, `select` 요소에는 반드시 텍스트 색상을 지정해야 합니다.

```tsx
// ❌ 나쁜 예: 텍스트 색상 미지정
<input
  type="text"
  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
/>

// ✅ 좋은 예: 텍스트 색상 명시
<input
  type="text"
  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
/>
```

### 2. 다크모드 대응 필수

모든 텍스트 색상 클래스에는 다크모드 버전을 함께 지정해야 합니다.

```tsx
// ❌ 나쁜 예: 다크모드 미지정
<h1 className="text-3xl font-bold text-gray-900">제목</h1>
<p className="text-sm text-gray-600">설명</p>

// ✅ 좋은 예: 다크모드 포함
<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">제목</h1>
<p className="text-sm text-gray-600 dark:text-gray-400">설명</p>
```

### 3. 배경색과 텍스트 색상 함께 지정

배경색을 지정할 때는 반드시 텍스트 색상도 함께 지정해야 합니다.

```tsx
// ❌ 나쁜 예: 배경색만 지정
<div className="rounded-lg bg-white dark:bg-gray-800 p-6">
  <p>내용</p>
</div>

// ✅ 좋은 예: 배경색과 텍스트 색상 함께 지정
<div className="rounded-lg bg-white dark:bg-gray-800 p-6">
  <p className="text-gray-900 dark:text-gray-100">내용</p>
</div>
```

## 🎨 텍스트 색상 표준 패턴

### 기본 텍스트 색상

| 용도 | 라이트 모드 | 다크 모드 | 클래스 |
|------|-----------|----------|--------|
| 제목 (H1, H2) | `text-gray-900` | `dark:text-gray-100` | `text-gray-900 dark:text-gray-100` |
| 부제목 (H3, H4) | `text-gray-800` | `dark:text-gray-200` | `text-gray-800 dark:text-gray-200` |
| 본문 텍스트 | `text-gray-700` | `dark:text-gray-300` | `text-gray-700 dark:text-gray-300` |
| 보조 텍스트 | `text-gray-600` | `dark:text-gray-400` | `text-gray-600 dark:text-gray-400` |
| 비활성 텍스트 | `text-gray-500` | `dark:text-gray-500` | `text-gray-500 dark:text-gray-500` |

### 입력 필드 텍스트 색상

| 요소 | 라이트 모드 | 다크 모드 | 클래스 |
|------|-----------|----------|--------|
| 입력 텍스트 | `text-gray-900` | `dark:text-gray-100` | `text-gray-900 dark:text-gray-100` |
| Placeholder | `placeholder:text-gray-500` | `dark:placeholder:text-gray-400` | `placeholder:text-gray-500 dark:placeholder:text-gray-400` |
| Label | `text-gray-700` | `dark:text-gray-300` | `text-gray-700 dark:text-gray-300` |

### 상태별 텍스트 색상

| 상태 | 라이트 모드 | 다크 모드 | 클래스 |
|------|-----------|----------|--------|
| 성공 메시지 | `text-green-800` | `dark:text-green-200` | `text-green-800 dark:text-green-200` |
| 에러 메시지 | `text-red-800` | `dark:text-red-200` | `text-red-800 dark:text-red-200` |
| 경고 메시지 | `text-yellow-800` | `dark:text-yellow-200` | `text-yellow-800 dark:text-yellow-200` |
| 정보 메시지 | `text-blue-800` | `dark:text-blue-200` | `text-blue-800 dark:text-blue-200` |

## 📝 체크리스트

새 페이지를 만들 때 다음 항목을 확인하세요:

### 필수 체크 항목

- [ ] 모든 `input`, `textarea`, `select` 요소에 `text-gray-900 dark:text-gray-100` 클래스 추가
- [ ] 모든 텍스트 요소에 다크모드 색상 클래스 추가 (`dark:text-*`)
- [ ] 배경색을 지정한 컨테이너 내부 텍스트에 색상 클래스 추가
- [ ] Placeholder 텍스트에 `placeholder:text-gray-500 dark:placeholder:text-gray-400` 추가
- [ ] Label 요소에 `text-gray-700 dark:text-gray-300` 추가

### 권장 체크 항목

- [ ] 제목(H1, H2)에 `text-gray-900 dark:text-gray-100` 사용
- [ ] 본문 텍스트에 `text-gray-700 dark:text-gray-300` 사용
- [ ] 보조 텍스트에 `text-gray-600 dark:text-gray-400` 사용
- [ ] 상태 메시지(성공/에러/경고)에 적절한 색상 클래스 사용

## 🔍 검증 방법

### 1. 브라우저 개발자 도구 확인

1. 페이지를 열고 개발자 도구(F12) 열기
2. Elements 탭에서 각 텍스트 요소 선택
3. Computed 탭에서 `color` 속성 확인
4. 다크모드 전환 후 다시 확인

### 2. 자동 검증 스크립트 (향후 추가 예정)

```bash
# 모든 .tsx 파일에서 텍스트 색상 미지정 패턴 검색
grep -r "className.*input\|textarea\|select" --include="*.tsx" | \
  grep -v "text-gray\|text-blue\|text-red\|text-green\|text-yellow"
```

## 📚 참고 예시

### 완전한 입력 필드 예시

```tsx
<div>
  <label 
    htmlFor="example" 
    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
  >
    예시 입력
  </label>
  <input
    type="text"
    id="example"
    name="example"
    placeholder="예시를 입력하세요"
    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
  />
</div>
```

### 완전한 카드 컴포넌트 예시

```tsx
<div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
  <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
    카드 제목
  </h2>
  <p className="text-sm text-gray-600 dark:text-gray-400">
    카드 설명 텍스트입니다.
  </p>
</div>
```

### 완전한 상태 메시지 예시

```tsx
{error && (
  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
    {error}
  </div>
)}

{success && (
  <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-green-800 dark:text-green-200">
    성공 메시지
  </div>
)}
```

## 🚨 주의사항

1. **인라인 스타일 금지**: `style={{ color: '...' }}` 사용 금지
2. **CSS 변수 사용 시**: `text-[var(--text-primary)]` 형태로 사용 가능하지만, 다크모드 대응 필요
3. **공통 컴포넌트 사용 권장**: `components/atoms/Input.tsx` 같은 공통 컴포넌트 사용 시 자동으로 색상이 적용됨

## 📖 관련 문서

- [입력 필드 텍스트 색상 개선](./입력-필드-텍스트-색상-개선.md)
- [캠프 템플릿 UI 텍스트 색상 개선](./camp-template-ui-text-color-improvement.md)
- [통합 개발 가이드라인](../.cursor/rules/project_rule.mdc)

## ✅ 적용 사례

### 수정된 파일

1. **curriculum-settings 페이지** (`app/(superadmin)/superadmin/curriculum-settings/`)
   - 모든 input 요소에 텍스트 색상 추가
   - 모든 텍스트에 다크모드 대응 추가
   - 배경색과 텍스트 색상 일관성 확보

---

**마지막 업데이트**: 2025년 12월 3일

