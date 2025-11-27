# 캠프 모드 메뉴 및 활성화 로직 개선

## 작업 개요

캠프 모드와 일반 모드를 독립적으로 관리할 수 있도록 메뉴 구조를 개선하고, 활성화 로직을 수정하여 각 모드별로 1개씩 활성화 가능하도록 변경했습니다.

## 구현 내용

### 1. 메뉴 구조 수정

**파일**: `components/navigation/global/categoryConfig.ts`

- 중복된 "캠프 관리" 메인 아이템 제거
- 카테고리 헤더는 유지하고, 하위 메뉴를 직접 아이템으로 변경
- 변경 전: "캠프 관리" > "캠프 관리" > 하위 메뉴들
- 변경 후: "캠프 관리" > 하위 메뉴들 (캠프 목록, 캠프 플랜 캘린더, 캠프 학습관리)

### 2. 캠프 학습관리에서 활성 상태 확인

**파일**: `app/(student)/camp/today/page.tsx`

- 활성화된 캠프 플랜 그룹만 필터링하여 표시
- 활성 플랜 그룹이 없을 때 안내 메시지 표시
- 캠프 플랜 캘린더와 동일한 로직 적용

### 3. 일반 학습관리에서 활성 상태 확인

**파일**: `app/(student)/today/page.tsx`

- 활성화된 일반 플랜 그룹만 필터링하여 표시
- 활성 플랜 그룹이 없을 때 안내 메시지 표시
- 캠프 모드 플랜 그룹 제외 로직 적용

### 4. 플랜 그룹 활성화 로직 수정

**파일**: `app/(student)/actions/plan-groups/status.ts`

- 기존: 모든 활성 플랜 그룹을 비활성화
- 변경: 같은 모드(일반/캠프)의 활성 플랜 그룹만 비활성화
- 일반 모드 활성화 시: 일반 모드 활성 플랜 그룹만 비활성화
- 캠프 모드 활성화 시: 캠프 모드 활성 플랜 그룹만 비활성화

**핵심 로직**:
```typescript
// 현재 활성화하려는 그룹이 캠프 모드인지 확인
const isCampMode =
  group.plan_type === "camp" ||
  group.camp_template_id !== null ||
  group.camp_invitation_id !== null;

// 같은 모드의 활성 플랜 그룹만 필터링
const sameModeGroups = allActiveGroups.filter((g) => {
  const gIsCampMode =
    g.plan_type === "camp" ||
    g.camp_template_id !== null ||
    g.camp_invitation_id !== null;
  return isCampMode === gIsCampMode;
});
```

### 5. 관리자 캠프 플랜 그룹 활성화 로직 수정

**파일**: `app/(admin)/actions/campTemplateActions.ts`

- 동일한 로직 적용: 캠프 모드 활성 플랜 그룹만 비활성화
- 일반 모드 플랜 그룹은 영향 없음

### 6. API 엔드포인트 수정

**파일**: `app/api/today/plans/route.ts`

- 활성 플랜 그룹만 조회하도록 수정
- 캠프 모드인 경우: 캠프 활성 플랜 그룹만
- 일반 모드인 경우: 일반 활성 플랜 그룹만

## 필터링 조건

### 캠프 모드 플랜 그룹
- `plan_type === "camp"`
- `camp_template_id !== null`
- `camp_invitation_id !== null`

### 일반 모드 플랜 그룹
- `plan_type !== "camp"`
- `camp_template_id === null`
- `camp_invitation_id === null`

## 활성화 동작

### 기존 동작
- 플랜 그룹 활성화 시 모든 활성 플랜 그룹 비활성화
- 일반 모드와 캠프 모드가 서로 영향을 받음

### 변경된 동작
- 일반 모드 활성화: 일반 모드 활성 플랜 그룹만 비활성화
- 캠프 모드 활성화: 캠프 모드 활성 플랜 그룹만 비활성화
- 일반 모드와 캠프 모드는 서로 독립적으로 활성화 가능
- 각 모드별로 최대 1개씩만 활성화 가능

## 사용자 경험 개선

1. **독립적인 관리**: 일반 플랜과 캠프 플랜을 각각 독립적으로 활성화 가능
2. **명확한 안내**: 활성 플랜 그룹이 없을 때 적절한 안내 메시지 표시
3. **일관된 동작**: 모든 페이지에서 동일한 필터링 로직 적용

## 작업 일시

2024년 11월

