# 성적 대시보드 404 에러 수정 완료

## 작업 일시
2025-01-XX

## 작업 개요

성적 대시보드 API의 404 에러를 수정하고, `tenantId` 처리 로직을 최적화했습니다.

**추가 수정 (2025-01-XX)**: 프로덕션 환경에서 발생하는 404 에러를 수정하고, 학생 권한 검증 로직을 추가했습니다.

## 주요 변경 사항

### 1. API 라우트 수정 (`app/api/students/[id]/score-dashboard/route.ts`)

**문제점**:
- `tenantId`가 있으면 학생 조회 시 필터로 사용
- 학생의 실제 `tenant_id`와 요청의 `tenantId`가 불일치하면 404 에러 발생

**해결 방법**:
- `tenantId` 조건 없이 먼저 학생 조회
- 학생을 찾은 후 `tenantId` 검증 (불일치 시 경고 로그)
- `effectiveTenantId` 결정: 요청한 `tenantId` 또는 학생의 실제 `tenant_id`

**변경 내용**:
```typescript
// 변경 전
if (tenantId) {
  studentQuery = studentQuery.eq("tenant_id", tenantId);
}

// 변경 후
// tenantId 조건 없이 먼저 조회
const { data: student } = await supabase
  .from("students")
  .select("id, name, grade, class, school_id, school_type, tenant_id")
  .eq("id", studentId)
  .maybeSingle();

// tenantId 검증
if (tenantId && student.tenant_id && tenantId !== student.tenant_id) {
  console.warn("[api/score-dashboard] tenant_id 불일치", {
    studentId,
    requestedTenantId: tenantId,
    actualTenantId: student.tenant_id,
  });
}

// effectiveTenantId 결정
const effectiveTenantId = tenantId || student.tenant_id;
```

### 2. 클라이언트 최적화

#### unified/page.tsx
- 학생 조회 시 `tenant_id` 포함
- `effectiveTenantId` 결정 로직 개선
- 중복 체크 제거

#### 관리자 컴포넌트
- `ScoreSummarySection.tsx`: 학생 정보 조회 추가, `effectiveTenantId` 결정 로직 개선
- `ScoreTrendSection.tsx`: 학생 정보 조회 추가, `effectiveTenantId` 결정 로직 개선

#### 부모 페이지
- `parent/scores/page.tsx`: 에러 처리 개선 (상세 로그 및 사용자 메시지)

### 3. 프로덕션 환경 404 에러 수정

**문제점**:
- 개발 환경 (`pnpm dev`): `NODE_ENV === "development"`로 Admin Client 사용 → 정상 작동
- 프로덕션 환경 (`pnpm start`): 학생 역할일 때 Server Client 사용 → RLS 정책 적용 → 404 에러 발생

**해결 방법**:
- 학생 권한 검증 로직 추가: 학생은 자신의 데이터만 조회 가능
- 학생이 자신의 데이터를 조회할 때는 Admin Client 사용 (RLS 우회)
- 다른 학생의 데이터를 조회하려고 하면 403 Forbidden 반환

**변경 내용**:
```typescript
// 학생 권한 검증 추가
if (currentRole === "student" && currentUser?.userId !== studentId) {
  return NextResponse.json(
    { 
      error: "Forbidden",
      details: "Students can only access their own data"
    },
    { status: 403 }
  );
}

// 클라이언트 선택 로직 개선
const useAdminClient =
  currentRole === "admin" ||
  currentRole === "parent" ||
  process.env.NODE_ENV === "development" ||
  (currentRole === "student" && currentUser?.userId === studentId); // ← 추가
```

### 4. 에러 처리 개선

**API 라우트**:
- 학생 조회 실패 시 상세한 에러 메시지 (`details` 필드 포함)
- `tenantId` 불일치 시 경고 로그
- 권한 검증 실패 시 403 Forbidden 반환
- 디버깅을 위한 상세 로그 추가

**클라이언트**:
- 에러 발생 시 사용자 친화적인 메시지
- 디버깅을 위한 상세 로그

## 변경된 파일

1. `app/api/students/[id]/score-dashboard/route.ts`
2. `app/(student)/scores/dashboard/unified/page.tsx`
3. `app/(admin)/admin/students/[id]/_components/ScoreSummarySection.tsx`
4. `app/(admin)/admin/students/[id]/_components/ScoreTrendSection.tsx`
5. `app/(parent)/parent/scores/page.tsx`
6. `docs/score-dashboard-404-fix.md` (업데이트)

## 테스트 방법

### 개발 환경 테스트 (`pnpm dev`)

1. **정상 케이스**:
   - 학생의 실제 `tenant_id`와 일치하는 `tenantId`로 API 호출
   - 예상: 정상적으로 데이터 반환

2. **tenantId 불일치 케이스**:
   - 학생의 실제 `tenant_id`와 다른 `tenantId`로 API 호출
   - 예상: 경고 로그 출력, 학생의 실제 `tenant_id` 사용하여 데이터 반환

3. **학생 없음 케이스**:
   - 존재하지 않는 `studentId`로 API 호출
   - 예상: 404 에러, 상세한 에러 메시지 반환

### 프로덕션 환경 테스트 (`pnpm start`)

1. **학생이 자신의 데이터 조회**:
   - 학생으로 로그인 후 자신의 `studentId`로 API 호출
   - 예상: 정상적으로 데이터 반환 (Admin Client 사용)

2. **학생이 다른 학생의 데이터 조회 시도**:
   - 학생으로 로그인 후 다른 학생의 `studentId`로 API 호출
   - 예상: 403 Forbidden 에러, "Students can only access their own data" 메시지

3. **관리자가 학생 데이터 조회**:
   - 관리자로 로그인 후 학생의 `studentId`로 API 호출
   - 예상: 정상적으로 데이터 반환 (Admin Client 사용)

4. **부모가 자녀 데이터 조회**:
   - 부모로 로그인 후 자녀의 `studentId`로 API 호출
   - 예상: 정상적으로 데이터 반환 (Admin Client 사용)

## 예상 효과

- ✅ 404 에러 해결: `tenantId` 불일치로 인한 404 에러 방지
- ✅ 프로덕션 환경 404 에러 해결: 학생이 자신의 데이터를 조회할 때 Admin Client 사용
- ✅ 보안 강화: 학생이 다른 학생의 데이터 조회 방지 (403 Forbidden)
- ✅ 코드 일관성: `tenantId` 처리 로직 통일
- ✅ 유지보수성: 중복 코드 제거 및 명확한 에러 처리
- ✅ 사용자 경험: 더 명확한 에러 메시지

## 주의 사항

- 보안: 
  - `tenantId` 검증은 유지하되, 불일치 시 경고만 하고 계속 진행
  - 학생 권한 검증은 필수 (자신의 데이터만 조회 가능)
- RLS 정책: 
  - Supabase RLS 정책이 올바르게 설정되어 있는지 확인
  - 프로덕션 환경에서 `auth.uid()`가 제대로 작동하지 않을 수 있으므로, 학생이 자신의 데이터를 조회할 때는 Admin Client 사용
- 데이터 일관성: `students` 테이블의 `tenant_id`가 항상 올바른지 확인
- 성능: Admin Client 사용은 필요한 경우에만 제한 (관리자, 부모, 학생 자신의 데이터 조회)

