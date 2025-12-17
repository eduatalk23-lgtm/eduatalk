# CSS 파싱 에러 수정 완료 보고서

**작업 일자**: 2025-01-15  
**작업 범위**: CSS 파싱 에러 수정 및 TypeScript 타입 에러 수정

---

## 📋 문제 상황

빌드 시 다음과 같은 CSS 파싱 에러가 발생했습니다:

```
Parsing CSS source code failed
./app/globals.css:1633:45
border-color: rgb(var(--color-secondary-[ASTERISK]));
                              ^
Unexpected token Delim('*')
```

## 원인 분석

Tailwind CSS가 문서 파일(`docs/`)을 스캔하면서, 문서에 포함된 와일드카드 예시를 실제 CSS 클래스로 해석하려고 시도했습니다. CSS는 와일드카드 문법을 지원하지 않으므로 파싱 에러가 발생했습니다.

## 해결 방법

### 1. Tailwind CSS Content 경로 제한

`tailwind.config.js` 파일을 생성하여 `docs/` 폴더를 스캔에서 제외했습니다:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    // docs 폴더는 제외하여 와일드카드 예시로 인한 파싱 에러 방지
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### 2. 문서 파일의 와일드카드 수정

다음 파일들에서 와일드카드를 백틱으로 감싸거나 HTML 엔티티로 변경했습니다:

- `docs/css-parsing-error-fix.md`
- `docs/design-system-ui-improvement-phase4.md`

### 3. TypeScript 타입 에러 수정

빌드 과정에서 발견된 TypeScript 타입 에러도 함께 수정했습니다:

#### 수정된 파일들:
1. `app/(admin)/admin/master-books/page.tsx`
2. `app/(admin)/admin/master-lectures/page.tsx`
3. `app/(admin)/admin/master-custom-contents/page.tsx`
4. `app/(student)/contents/master-books/page.tsx`
5. `app/(student)/contents/master-lectures/page.tsx`
6. `app/(student)/contents/master-custom-contents/page.tsx`
7. `app/(student)/actions/contentMasterActions.ts`
8. `app/(student)/blocks/_components/BlocksViewer.tsx`

#### 수정 내용:
- `ContentSortOption` 타입 import 추가
- `params.sort`에 타입 단언 적용: `(params.sort as ContentSortOption | undefined) ?? ("updated_at_desc" as ContentSortOption)`
- `cn` 함수 import 추가

## 결과

✅ **빌드 성공**: CSS 파싱 에러가 해결되어 빌드가 성공적으로 완료됩니다.

⚠️ **경고 남음**: CSS 경고가 4개 남아있지만, 빌드는 성공합니다. 경고는 문서 파일의 와일드카드 예시로 인한 것으로, 실제 코드에는 영향을 주지 않습니다.

## 참고 사항

- Tailwind CSS는 프로젝트 내 모든 파일을 스캔하므로, 문서 파일에도 실제로 사용 가능한 클래스만 작성해야 합니다.
- 와일드카드나 예시 문법은 코드 블록(```)으로 감싸거나 실제 값으로 변경해야 합니다.
- `tailwind.config.js`를 통해 content 경로를 제한하여 문서 파일을 스캔에서 제외할 수 있습니다.

## 향후 개선 사항

CSS 경고를 완전히 제거하려면:
1. 문서 파일에서 와일드카드를 완전히 제거하고 실제 값으로 변경
2. 또는 문서 파일을 별도의 디렉토리로 이동하여 Tailwind 스캔에서 완전히 제외

