# 네비게이션 카테고리 JSX 파싱 에러 수정

**작업 일시**: 2025-02-05  
**작업자**: Auto

## 문제 상황

Next.js 빌드 시 다음 파일들에서 JSX 파싱 에러가 발생했습니다:

```
Expected '>', got 'className'
```

에러가 발생한 파일들:
- `components/navigation/global/configs/adminCategories.ts`
- `components/navigation/global/configs/parentCategories.ts`
- `components/navigation/global/configs/studentCategories.ts`
- `components/navigation/global/configs/superadminCategories.ts`

## 원인 분석

이 파일들은 모두 `.ts` 확장자를 사용하고 있었지만, JSX 구문을 포함하고 있었습니다:

```tsx
icon: <BarChart3 className="w-4 h-4" />,
```

TypeScript에서 JSX를 사용하려면 `.tsx` 확장자를 사용해야 합니다. `.ts` 파일에서는 JSX 구문을 파싱할 수 없어 에러가 발생했습니다.

## 해결 방법

4개의 카테고리 설정 파일의 확장자를 `.ts`에서 `.tsx`로 변경했습니다:

1. `adminCategories.ts` → `adminCategories.tsx`
2. `parentCategories.ts` → `parentCategories.tsx`
3. `studentCategories.ts` → `studentCategories.tsx`
4. `superadminCategories.ts` → `superadminCategories.tsx`

## 변경 사항

### 파일 변경
- ✅ `components/navigation/global/configs/adminCategories.tsx` (신규 생성)
- ✅ `components/navigation/global/configs/parentCategories.tsx` (신규 생성)
- ✅ `components/navigation/global/configs/studentCategories.tsx` (신규 생성)
- ✅ `components/navigation/global/configs/superadminCategories.tsx` (신규 생성)
- ✅ 기존 `.ts` 파일 삭제

### Import 경로
`categoryConfig.ts`의 import 경로는 변경하지 않았습니다. TypeScript/Next.js는 확장자 없이 import할 수 있으므로, `.ts`에서 `.tsx`로 변경해도 기존 import 경로가 그대로 작동합니다.

## 검증

- ✅ 린터 오류 없음
- ✅ JSX 구문 파싱 정상 작동
- ✅ 빌드 에러 해결

## 추가 수정 사항

### `dashboardUtils.ts` 수정

서버 컴포넌트에서 클라이언트 컴포넌트 함수를 직접 호출하는 문제를 해결하기 위해 `getDashboardCategories` 함수를 수정했습니다:

- `getCategoriesForRole` 의존성 제거
- `href` 기반 직접 매핑 방식으로 변경
- 서버 컴포넌트에서 안전하게 사용 가능하도록 수정

### `categoryConfig.ts` 클라이언트 컴포넌트로 변경

`categoryConfig.ts`에 `"use client"` 지시어를 추가하여 클라이언트 컴포넌트로 변경했습니다. 이는 JSX 요소를 포함하는 카테고리 설정 파일들을 import하기 위해 필요합니다.

## 참고 사항

- Next.js와 TypeScript에서 JSX를 사용하는 파일은 반드시 `.tsx` 확장자를 사용해야 합니다.
- `.ts` 파일에서는 JSX 구문을 사용할 수 없습니다.
- Import 경로는 확장자 없이 작성하면 자동으로 `.ts`와 `.tsx` 모두를 인식합니다.
- 서버 컴포넌트에서 클라이언트 컴포넌트의 함수를 직접 호출하는 것은 제한될 수 있습니다. 가능한 한 서버 컴포넌트에서는 직접 데이터를 매핑하는 방식을 사용하는 것이 좋습니다.

