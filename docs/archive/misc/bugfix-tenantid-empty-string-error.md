# 버그 수정: tenantId 빈 문자열로 인한 UUID 검증 에러

## 📋 문제 상황

### 에러 로그
```
[data/scoreDetails] 내신 성적 조회 실패 쿼리 에러: 
{ message: 'invalid input syntax for type uuid: ""', code: '22P02' }

[data/scoreDetails] 내신 성적 조회 상세 정보 {
  studentId: '6d1cff5e-fa9f-4811-8d7f-44f75850b62b',
  tenantId: '',  // ❌ 빈 문자열
  grade: undefined,
  semester: undefined,
  errorMessage: 'invalid input syntax for type uuid: ""',
  errorCode: '22P02'
}
```

### 원인 분석
1. `getCurrentUserRole()`에서 `student`를 조회할 때 `tenant_id` 필드를 가져오지 않음
2. 결과적으로 `tenantId`가 `null`로 반환됨
3. `page.tsx`에서 `currentUser.tenantId || ""`로 빈 문자열로 변환
4. 빈 문자열이 UUID 타입 컬럼에 전달되어 PostgreSQL 에러 발생

## 🔧 수정 내용

### 1. `lib/auth/getCurrentUserRole.ts` 수정

**Before:**
```typescript
// 3. students 테이블에서 조회
const selectStudent = () =>
  supabase.from("students").select("id").eq("id", user.id).maybeSingle();

// students에 레코드가 있으면 student 반환
if (student) {
  return {
    userId: user.id,
    role: "student",
    tenantId: null,  // ❌ 항상 null 반환
  };
}
```

**After:**
```typescript
// 3. students 테이블에서 조회 (tenant_id 포함)
const selectStudent = () =>
  supabase.from("students").select("id,tenant_id").eq("id", user.id).maybeSingle();

// students에 레코드가 있으면 student 반환
if (student) {
  return {
    userId: user.id,
    role: "student",
    tenantId: student.tenant_id ?? null,  // ✅ 실제 tenant_id 반환
  };
}
```

### 2. `app/(student)/scores/analysis/page.tsx` 수정

**Before:**
```typescript
const studentId = currentUser.userId;
const tenantId = currentUser.tenantId || "";  // ❌ 빈 문자열로 변환

// 내신 성적 조회 (전체)
const internalScores = await getInternalScoresByTerm(studentId, tenantId);
```

**After:**
```typescript
const studentId = currentUser.userId;
const tenantId = currentUser.tenantId;

// tenantId가 없으면 학생 설정 페이지로 리다이렉트
if (!tenantId) {
  redirect("/student-setup");
}

// 내신 성적 조회 (전체)
const internalScores = await getInternalScoresByTerm(studentId, tenantId);
```

## ✅ 해결된 문제

1. **UUID 검증 에러 해결**: `tenantId`가 실제 UUID 값으로 전달됨
2. **데이터 무결성 보장**: 학생이 tenant에 속하지 않은 경우 적절히 처리
3. **타입 안전성 향상**: `null` 처리를 명시적으로 수행

## 🧪 테스트 시나리오

### Case 1: 정상적인 학생 로그인
- `students` 테이블에 `tenant_id`가 있는 학생
- ✅ 성적 조회 페이지가 정상적으로 렌더링됨
- ✅ 내신/모의고사 성적이 정상적으로 조회됨

### Case 2: tenant_id가 없는 학생
- `students` 테이블에 `tenant_id`가 `null`인 학생
- ✅ `/student-setup` 페이지로 리다이렉트됨
- ✅ 학생 설정을 완료하도록 유도

### Case 3: 인증되지 않은 사용자
- 로그인하지 않은 사용자
- ✅ `/login` 페이지로 리다이렉트됨

## 📝 관련 파일

- `lib/auth/getCurrentUserRole.ts` - 사용자 역할 조회 로직
- `lib/auth/getCurrentUser.ts` - 현재 사용자 정보 조회
- `app/(student)/scores/analysis/page.tsx` - 성적 분석 페이지
- `lib/data/scoreDetails.ts` - 성적 상세 데이터 페칭

## 🔍 추가 고려사항

### 다른 페이지에서도 동일한 패턴 적용 필요
다음 페이지들도 `tenantId` 검증 로직이 필요할 수 있음:
- `/scores/*` - 성적 관련 페이지
- `/plan/*` - 학습 계획 페이지
- `/dashboard` - 대시보드 페이지

### getCurrentUser 타입 개선
```typescript
export type CurrentUser = {
  userId: string;
  role: NonNullable<CurrentUserRole["role"]>;
  tenantId: string | null;  // ✅ null 허용
  email?: string | null;
};
```

### 권장 패턴
```typescript
// ✅ 좋은 예: tenantId가 필수인 경우
const tenantId = currentUser.tenantId;
if (!tenantId) {
  redirect("/student-setup");
}

// ❌ 나쁜 예: 빈 문자열로 변환
const tenantId = currentUser.tenantId || "";
```

## 🎯 결론

이번 수정으로 학생의 `tenant_id`가 올바르게 조회되고, UUID 타입 검증 에러가 해결되었습니다. 
향후 유사한 문제를 방지하기 위해 다음을 권장합니다:

1. **데이터베이스 조회 시 필요한 모든 필드를 명시적으로 선택**
2. **null 값을 빈 문자열로 변환하지 않기**
3. **필수 값이 없을 경우 적절한 페이지로 리다이렉트**
4. **타입 시스템을 활용한 null 체크**

---

**작업 일시**: 2025-11-30  
**수정자**: AI Assistant  
**커밋 메시지**: `fix: getCurrentUserRole에서 student의 tenant_id 조회 추가 및 빈 문자열 UUID 에러 수정`

