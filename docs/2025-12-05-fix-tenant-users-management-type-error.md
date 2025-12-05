# 테넌트 사용자 관리 컴포넌트 타입 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:
```
./app/(admin)/admin/tenant/users/_components/TenantUsersManagement.tsx:72:62
Type error: Property 'grade' does not exist on type 'never'.
```

## 원인 분석
`Extract<TenantUser, { type: "student" }>`를 사용하여 타입을 좁히려고 했지만, TypeScript가 제대로 타입을 추론하지 못했습니다. `user.type === "student"` 체크 후에도 TypeScript가 타입을 좁히지 못하는 상황이었습니다.

## 수정 내용

### 파일
- `app/(admin)/admin/tenant/users/_components/TenantUsersManagement.tsx`

### 변경 사항
`Extract`를 사용하는 대신, 변수에 타입 가드 결과를 저장하고 직접 `user.grade`에 접근하도록 수정했습니다.

```typescript
// 수정 전
if (searchQuery) {
  const query = searchQuery.toLowerCase();
  return (
    user.name?.toLowerCase().includes(query) ||
    user.email?.toLowerCase().includes(query) ||
    (user.type === "student" &&
      (user as Extract<TenantUser, { type: "student" }>).grade
        ?.toLowerCase()
        .includes(query))
  );
}

// 수정 후
if (searchQuery) {
  const query = searchQuery.toLowerCase();
  const isStudent = user.type === "student";
  return (
    user.name?.toLowerCase().includes(query) ||
    user.email?.toLowerCase().includes(query) ||
    (isStudent && user.grade?.toLowerCase().includes(query))
  );
}
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `TenantUser` 타입은 `type: "student" | "parent"`로 정의되어 있고, `grade`는 optional 필드입니다.
- TypeScript의 타입 좁히기(type narrowing)는 변수에 할당할 때 더 잘 작동합니다.
- `user.type === "student"` 체크 후 `user.grade`에 직접 접근하면 TypeScript가 타입을 올바르게 추론합니다.

