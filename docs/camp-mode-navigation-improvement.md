# 캠프 모드 네비게이션 개선

## 작업 개요

캠프 모드 플랜 그룹 페이지와 일반 플랜 그룹 페이지의 혼동을 해결하기 위해 캠프 참여 메뉴에 하위 메뉴를 추가하고, 네비게이션 활성화 로직을 개선했습니다.

## 문제점

- 캠프 모드 플랜 그룹이 `/plan/group/[id]` 경로를 사용하여 일반 플랜 그룹과 동일한 경로를 공유
- 네비게이션에서 캠프 모드 플랜 그룹 상세 페이지에 있을 때 "플랜 관리"가 활성화되어 혼동 발생
- 캠프 모드 컨텍스트가 명확하지 않음

## 해결 방안

### 1. 캠프 참여 메뉴에 하위 메뉴 추가

`components/navigation/global/categoryConfig.ts`에서 "캠프 참여" 카테고리에 children 메뉴를 추가했습니다.

**변경 내용:**
- 메인 아이템: "캠프 참여" (`/camp`)
- 하위 메뉴: "캠프 목록" (`/camp`)

향후 "내 캠프 플랜" 등의 메뉴를 추가할 수 있도록 구조를 확장 가능하게 구성했습니다.

### 2. URL 쿼리 파라미터 활용

캠프 모드 플랜 그룹 상세 페이지 접근 시 `?camp=true` 쿼리 파라미터를 추가하여 네비게이션에서 캠프 모드를 감지할 수 있도록 했습니다.

**변경 파일:**
- `app/(student)/camp/page.tsx`: 플랜 그룹 상세로 이동할 때 `?camp=true` 쿼리 파라미터 추가

### 3. 네비게이션 활성화 로직 개선

네비게이션 컴포넌트에서 쿼리 파라미터를 확인하여 캠프 모드인 경우 "캠프 참여" 카테고리를 활성화하도록 수정했습니다.

**변경 파일:**
- `components/navigation/global/CategoryNav.tsx`: 쿼리 파라미터 기반 캠프 모드 감지 로직 추가
- `components/navigation/student/StudentCategoryNav.tsx`: 캠프 모드 감지 로직 추가

**로직:**
- `/plan/group/[id]` 경로이고 `camp=true` 쿼리 파라미터가 있는 경우
- "캠프 참여" 카테고리를 활성화하고 "플랜 관리"는 비활성화

## 구현 세부사항

### categoryConfig.ts

```typescript
{
  id: "camp",
  label: "캠프 참여",
  icon: "🏕️",
  items: [
    {
      id: "camp-main",
      label: "캠프 참여",
      href: "/camp",
      icon: "🏕️",
      children: [
        {
          id: "camp-list",
          label: "캠프 목록",
          href: "/camp",
          icon: "📋",
        },
      ],
    },
  ],
}
```

### CategoryNav.tsx

- `useSearchParams` 훅을 사용하여 쿼리 파라미터 확인
- 캠프 모드 감지: `pathname?.startsWith("/plan/group/") && searchParams?.get("camp") === "true"`
- 캠프 모드인 경우 "캠프 참여" 카테고리 강제 활성화

### camp/page.tsx

플랜 그룹 상세로 이동하는 링크에 쿼리 파라미터 추가:
```typescript
return `/plan/group/${invitation.planGroupId}?camp=true`;
```

## 사용자 경험 개선

1. **명확한 컨텍스트**: 캠프 모드 플랜 그룹 페이지에서 "캠프 참여" 메뉴가 활성화되어 사용자가 현재 캠프 컨텍스트에 있음을 명확히 인지
2. **일관된 네비게이션**: 캠프 관련 페이지에서 항상 "캠프 참여" 메뉴로 돌아갈 수 있음
3. **혼동 방지**: 일반 플랜 그룹과 캠프 모드 플랜 그룹을 명확히 구분

## 향후 개선 사항

- "내 캠프 플랜" 메뉴 추가 (캠프 모드 플랜 그룹만 필터링하여 보여주는 페이지)
- 캠프 모드 플랜 그룹 상세 페이지에서 직접 쿼리 파라미터 추가 (서버 사이드에서 처리)

## 작업 일시

2024년 11월

