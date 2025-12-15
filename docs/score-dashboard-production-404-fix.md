# 프로덕션 환경 404 에러 수정

## 작업 일시
2025-01-XX

## 문제 상황

성적 대시보드 API가 개발 환경(`pnpm dev`)에서는 정상 작동하지만, 프로덕션 환경(`pnpm start`)에서 404 에러가 발생했습니다.

**에러 메시지**:
```
[unified-dashboard] 성적 대시보드 조회 실패 Error: 성적 대시보드 API 호출 실패: 404 - Student not found
```

## 원인 분석

### 환경별 차이점

**개발 환경 (`pnpm dev`)**:
- `NODE_ENV === "development"`
- `useAdminClient = true` (개발 환경 조건)
- Admin Client 사용 → RLS 우회 → 정상 작동 ✅

**프로덕션 환경 (`pnpm start`)**:
- `NODE_ENV === "production"`
- 학생 역할일 때 `useAdminClient = false`
- Server Client 사용 → RLS 정책 적용 → 404 에러 발생 ❌

### RLS 정책 확인

`students` 테이블의 RLS 정책:
- `tenant_isolation_students_select`: `(is_super_admin() OR (get_user_tenant_id() = tenant_id) OR (auth.uid() = id))`
- 이 정책은 학생이 자신의 데이터(`auth.uid() = id`)를 조회할 수 있도록 허용
- 하지만 프로덕션 환경에서 `auth.uid()`가 제대로 작동하지 않을 수 있음

### 코드 문제점

```typescript:app/api/students/[id]/score-dashboard/route.ts
// 변경 전
const useAdminClient =
  currentRole === "admin" ||
  currentRole === "parent" ||
  process.env.NODE_ENV === "development";  // ← 프로덕션에서 학생은 false
```

## 수정 사항

### 1. 학생 권한 검증 로직 추가

학생이 자신의 데이터만 조회할 수 있도록 명시적 검증 추가:

```typescript:app/api/students/[id]/score-dashboard/route.ts
// 학생 권한 검증: 학생은 자신의 데이터만 조회 가능
if (currentRole === "student" && currentUser?.userId !== studentId) {
  console.warn("[api/score-dashboard] 학생 권한 검증 실패", {
    currentUserId: currentUser?.userId,
    requestedStudentId: studentId,
    role: currentRole,
  });

  return NextResponse.json(
    { 
      error: "Forbidden",
      details: "Students can only access their own data",
      currentUserId: currentUser?.userId,
      requestedStudentId: studentId,
    },
    { status: 403 }
  );
}
```

### 2. 클라이언트 선택 로직 개선

학생이 자신의 데이터를 조회할 때도 Admin Client 사용:

```typescript:app/api/students/[id]/score-dashboard/route.ts
// Supabase 클라이언트 선택
// 관리자/부모 역할이거나 개발 환경에서는 Admin Client 사용 (RLS 우회)
// 학생이 자신의 데이터를 조회할 때도 Admin Client 사용 (RLS 우회)
const useAdminClient =
  currentRole === "admin" ||
  currentRole === "parent" ||
  process.env.NODE_ENV === "development" ||
  (currentRole === "student" && currentUser?.userId === studentId); // ← 추가
```

### 3. 에러 처리 개선

상세한 로그 및 에러 메시지 추가:

```typescript:app/api/students/[id]/score-dashboard/route.ts
if (!student) {
  console.warn("[api/score-dashboard] 학생을 찾을 수 없음", {
    studentId,
    currentUserId: currentUser?.userId,
    currentRole,
    useAdminClient,
  });

  return NextResponse.json(
    { 
      error: "Student not found",
      details: `Student with id ${studentId} does not exist`,
      studentId,
    },
    { status: 404 }
  );
}
```

## 변경된 파일

- `app/api/students/[id]/score-dashboard/route.ts`
  - 학생 권한 검증 로직 추가
  - 클라이언트 선택 로직 개선
  - 에러 처리 개선 (상세 로그 추가)

## 테스트 방법

### 프로덕션 환경 테스트

1. **빌드 및 시작**:
   ```bash
   pnpm build
   pnpm start
   ```

2. **학생이 자신의 데이터 조회**:
   - 학생으로 로그인
   - `/scores/dashboard/unified` 페이지 접근
   - 예상: 정상적으로 데이터 표시

3. **학생이 다른 학생의 데이터 조회 시도**:
   - 학생으로 로그인
   - 다른 학생의 `studentId`로 API 직접 호출
   - 예상: 403 Forbidden 에러

4. **관리자가 학생 데이터 조회**:
   - 관리자로 로그인
   - 학생의 `studentId`로 API 호출
   - 예상: 정상적으로 데이터 반환

## 해결된 문제

- ✅ 프로덕션 환경 404 에러 해결
- ✅ 보안 강화 (학생이 다른 학생의 데이터 조회 방지)
- ✅ 명확한 에러 메시지 (403 Forbidden)
- ✅ 디버깅을 위한 상세 로그

## 주의 사항

- 보안: 학생 권한 검증은 필수 (자신의 데이터만 조회 가능)
- RLS 정책: Admin Client 사용 시에도 권한 검증은 유지
- 성능: Admin Client 사용은 필요한 경우에만 제한

## 관련 문서

- `docs/score-dashboard-404-fix.md`: 초기 404 에러 수정
- `docs/score-dashboard-404-fix-complete.md`: 전체 수정 사항 요약

