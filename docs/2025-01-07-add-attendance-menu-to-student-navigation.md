# 학생 페이지 출석 메뉴 UI 추가

## 작업 일시
2025-01-07

## 문제 상황
학생 페이지의 사이드바 네비게이션에 출석 관련 메뉴가 표시되지 않았습니다.

## 원인 분석
- `components/navigation/student/studentCategories.ts`에는 출석 체크 메뉴가 이미 정의되어 있었습니다
- 하지만 `RoleBasedLayout`은 글로벌 네비게이션(`CategoryNav`)을 사용하며, 이는 `components/navigation/global/categoryConfig.ts`의 `studentCategories` 배열을 참조합니다
- `categoryConfig.ts`의 `studentCategories` 배열에는 출석 관련 카테고리가 누락되어 있었습니다

## 해결 방법
`components/navigation/global/categoryConfig.ts`의 `studentCategories` 배열에 출석 관리 카테고리를 추가했습니다.

### 변경 내용

```typescript
{
  id: "attendance",
  label: "출석 관리",
  icon: "✅",
  items: [
    {
      id: "attendance-check-in",
      label: "출석 체크",
      href: "/attendance/check-in",
      icon: "✅",
    },
  ],
},
```

출석 카테고리는 "학습 리포트" 카테고리 앞에 배치했습니다.

## 관련 파일
- `components/navigation/global/categoryConfig.ts` - 학생 카테고리 설정에 출석 관리 추가

## 확인 사항
- [x] 린터 오류 없음
- [x] 출석 체크 페이지 경로 확인 (`/attendance/check-in`)
- [x] 네비게이션 구조 확인

## 참고
- `components/navigation/student/studentCategories.ts`는 `StudentCategoryNav` 컴포넌트에서만 사용되며, 실제 사이드바 네비게이션은 `CategoryNav`를 통해 `categoryConfig.ts`를 사용합니다.

