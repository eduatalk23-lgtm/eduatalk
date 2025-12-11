# parent_student_links 쿼리 에러 수정

**작성 일자**: 2025-02-01  
**관련 이슈**: `column parent_student_links_2.name does not exist` 에러

---

## 문제 분석

### 에러 내용
```
column parent_student_links_2.name does not exist
```

### 원인
`app/(admin)/actions/parentStudentLinkActions.ts`의 `getPendingLinkRequests` 함수에서 중첩 조인 쿼리가 실패했습니다.

**문제 쿼리**:
```typescript
parent_users:parent_id(
  id,
  users:id(
    id,
    name,
    email
  )
)
```

### 데이터베이스 스키마 확인 결과

Supabase MCP를 사용하여 실제 데이터베이스 스키마를 확인한 결과:

1. **`parent_users` 테이블 구조**:
   - `id` (uuid, PK) - `auth.users.id`와 동일
   - `name` (text) - ✅ 존재
   - `created_at` (timestamptz)
   - `tenant_id` (uuid)
   - ❌ `email` 컬럼 없음

2. **외래키 관계**:
   - `parent_users.id` → `auth.users.id` (PRIMARY KEY이면서 FOREIGN KEY)
   - `parent_student_links.parent_id` → `parent_users.id`

3. **중요한 발견**:
   - `public.users` 테이블이 존재하지 않음
   - `parent_users.id`는 `auth.users.id`를 참조 (auth 스키마)
   - Supabase PostgREST는 `auth.users`를 직접 조인할 수 없음
   - 중첩 조인 `parent_student_links` → `parent_users` → `users`에서 두 번째 단계 조인이 실패

---

## 해결 방법

### 수정 내용

1. **쿼리 수정**: `parent_users`에서 `name`을 직접 가져오도록 변경
   ```typescript
   parent_users:parent_id(
     id,
     name  // users 테이블을 거치지 않고 직접 조회
   )
   ```

2. **타입 정의 수정**: `ParentStudentLinkWithStudentRow` 타입에서 중첩 구조 제거
   ```typescript
   parent_users: {
     id: string;
     name: string | null;
   } | null;
   ```

3. **데이터 변환 로직 수정**: `parent_users.name`을 직접 사용
   ```typescript
   parentName: parentUser.name,
   parentEmail: null, // TODO: email 조회 로직 추가 필요
   ```

### 수정된 코드

```typescript:app/(admin)/actions/parentStudentLinkActions.ts
const selectLinks = () => {
  let query = supabase
    .from("parent_student_links")
    .select(`
      id,
      student_id,
      parent_id,
      relation,
      created_at,
      students:student_id(
        id,
        name,
        grade,
        class
      ),
      parent_users:parent_id(
        id,
        name
      )
    `)
    .or("is_approved.is.null,is_approved.eq.false")
    .order("created_at", { ascending: false });
  // ...
};
```

---

## 향후 개선 사항

### `email` 조회 문제

현재 `email`은 `null`로 처리되고 있습니다. `email`이 필요한 경우 다음 방법 중 하나를 선택할 수 있습니다:

1. **`parent_users` 테이블에 `email` 컬럼 추가** (권장)
   - 마이그레이션으로 `email` 컬럼 추가
   - 회원가입/업데이트 시 `email` 동기화

2. **Supabase Admin API 사용**
   - `auth.admin.getUserById()` 사용하여 `email` 조회
   - N+1 쿼리 문제 발생 가능

3. **별도 API 엔드포인트 생성**
   - `parent_users.id` 목록을 받아 `email` 반환하는 API
   - 배치 조회로 N+1 문제 해결

---

## 테스트

수정 후 다음을 확인해야 합니다:

1. ✅ `getPendingLinkRequests` 함수가 에러 없이 실행되는지
2. ✅ `parentName`이 올바르게 조회되는지
3. ⚠️ `parentEmail`이 `null`인지 (현재는 의도된 동작)

---

## 참고 사항

- Supabase PostgREST는 `auth.users`를 직접 조인할 수 없습니다
- `parent_users.id = auth.users.id` 관계는 PRIMARY KEY이면서 FOREIGN KEY입니다
- 중첩 조인에서 `auth.users`를 참조하려고 하면 에러가 발생합니다
- `parent_users` 테이블에 필요한 정보를 직접 저장하는 것이 가장 안전합니다

---

**수정 완료**: 2025-02-01

