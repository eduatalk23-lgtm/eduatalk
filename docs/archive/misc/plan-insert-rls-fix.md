# 플랜 INSERT 시 RLS 정책 위반 문제 해결

## 문제 분석

### 근본 원인
- `_generatePlansFromGroup` 함수에서 플랜 INSERT 시 일반 서버 클라이언트 사용
- Admin/Consultant가 다른 학생의 플랜을 생성할 때 RLS 정책에 막힘
- 데이터베이스 트리거/함수에서 교재 존재 여부를 확인하는데, 일반 서버 클라이언트로는 조회 실패

### 에러 로그
```
[planGroupActions] 일반 플랜 생성 실패 {
  code: 'P0001',
  message: 'Referenced book (a366d6bd-1ece-4b09-8a52-014f4100c21c) does not exist'
}
```

### 문제 흐름
1. 교재 복사 성공 → `plan_contents`에 복사된 학생 교재 ID 저장
2. 플랜 생성 시작 → 58개의 플랜 생성 성공
3. 플랜 INSERT 시 데이터베이스 트리거/함수에서 교재 존재 여부 확인
4. 일반 서버 클라이언트로는 RLS 정책 때문에 교재 조회 실패
5. "Referenced book does not exist" 에러 발생

## 해결 방법

### 근본적인 해결 (구현 완료)

`_generatePlansFromGroup` 함수에서 Admin/Consultant가 다른 학생의 플랜을 생성할 때는 Admin 클라이언트를 사용하도록 수정했습니다.

## 구현 내용

### 1. 플랜 INSERT 클라이언트 결정 로직 추가

**변경 사항:**
- Admin/Consultant가 다른 학생의 플랜을 생성할 때는 Admin 클라이언트 사용
- 학생이 자신의 플랜을 생성할 때는 일반 서버 클라이언트 사용

**주요 코드:**
```typescript
// Admin/Consultant가 다른 학생의 플랜을 생성할 때는 Admin 클라이언트 사용
const planInsertClient = isOtherStudent ? createSupabaseAdminClient() : supabase;

if (isOtherStudent && !planInsertClient) {
  throw new AppError(
    "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}
```

### 2. 일반 플랜 INSERT 수정

**변경 사항:**
- 플랜 INSERT 시 `planInsertClient` 사용
- 중복 플랜 조회 시 `planInsertClient` 사용
- `studentId` 사용 (기존 `user.userId` 대신)

**주요 코드:**
```typescript
// 일반 플랜 먼저 저장
if (regularPlans.length > 0) {
  const { error: insertError } = await planInsertClient
    .from("student_plan")
    .insert(regularPlans);
  
  // 중복 키 에러 처리
  if (insertError?.code === "23505") {
    const { data: duplicatePlanData } = await planInsertClient
      .from("student_plan")
      .select("id, plan_date, block_index, plan_group_id")
      .eq("student_id", studentId)  // user.userId 대신 studentId 사용
      .limit(10);
  }
}
```

### 3. 더미 플랜 INSERT 수정

동일한 방식으로 더미 플랜 INSERT도 `planInsertClient` 사용하도록 수정했습니다.

## 테스트 시나리오

1. ✅ Admin 액션에서 다른 학생의 플랜 생성 성공 확인
2. ✅ 학생 액션에서 자신의 플랜 생성 성공 확인
3. ✅ 데이터베이스 트리거/함수에서 교재 존재 여부 확인 성공
4. ✅ 중복 플랜 조회 성공 확인

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 다른 학생의 플랜을 생성할 때만 Admin 클라이언트 사용
- 학생이 자신의 플랜을 생성할 때는 일반 서버 클라이언트 사용 (정상적인 RLS 적용)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `app/(student)/actions/plan-groups/plans.ts` - 수정된 함수
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/actions/campTemplateActions.ts` - 호출하는 Admin 액션

## 변경 이력

- 2025-11-26: 플랜 INSERT 시 RLS 정책 위반 문제 해결을 위해 Admin 클라이언트 사용으로 변경

