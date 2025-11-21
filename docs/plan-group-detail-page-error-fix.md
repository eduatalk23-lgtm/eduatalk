# 플랜 그룹 상세 페이지 에러 로깅 개선

## 작업 일시
2025-01-XX

## 문제점
`getPlanGroupById` 함수에서 에러가 발생했을 때 에러 객체가 빈 객체 `{}`로 표시되어 실제 에러 내용을 확인할 수 없었습니다.

또한 `PlanGroupDetailPage`에서 `getPlanGroupWithDetails`를 호출할 때 `tenantId`를 전달하지 않아 에러가 발생할 수 있었습니다.

## 수정 내용

### 1. 에러 로깅 개선
**파일**: `lib/data/planGroups.ts`

**이전**:
```typescript
if (error && error.code !== "PGRST116") {
  console.error("[data/planGroups] 플랜 그룹 조회 실패", error);
  return null;
}
```

**개선**:
```typescript
if (error && error.code !== "PGRST116") {
  console.error("[data/planGroups] 플랜 그룹 조회 실패", {
    error: {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    },
    groupId,
    studentId,
    tenantId,
  });
  return null;
}
```

### 2. tenantId 전달 추가
**파일**: `app/(student)/plan/group/[id]/page.tsx`

**이전**:
```typescript
const { group, contents, exclusions, academySchedules } = await getPlanGroupWithDetails(
  id,
  user.id
);
```

**개선**:
```typescript
// tenantId 조회
const tenantContext = await getTenantContext();

// 플랜 그룹 및 관련 데이터 조회
const { group, contents, exclusions, academySchedules } = await getPlanGroupWithDetails(
  id,
  user.id,
  tenantContext?.tenantId || null
);
```

## 개선 사항

1. **에러 정보 가시성 향상**: 에러 객체의 주요 속성(message, code, details, hint)을 명시적으로 로깅하여 디버깅이 용이해짐
2. **컨텍스트 정보 추가**: 에러 발생 시 `groupId`, `studentId`, `tenantId` 정보도 함께 로깅하여 문제 추적이 쉬워짐
3. **tenantId 전달**: 다른 페이지들과 동일하게 `tenantId`를 전달하여 일관성 유지 및 에러 방지

## 참고

- Supabase 에러 객체는 직렬화되지 않을 수 있어, 주요 속성을 명시적으로 추출하여 로깅
- `getTenantContext`를 사용하여 `tenantId`를 가져오는 패턴은 다른 페이지들과 일관성 유지

