# Score Dashboard API 404 에러 수정

## 작업 일시
2025-12-01

## 문제 상황

`GET /api/students/:id/score-dashboard` API 호출 시 404 에러 발생:

- **URL**: `http://localhost:3000/api/students/f7b6e709-c50b-4586-84a6-8e5a5d51b9b1/score-dashboard?tenantId=84b71a5d-5681-4da3-88d2-91e75ef89015&termId=cda33d0a-9559-4e47-a01f-3fe955bbe3e6`
- **응답**: `{ "error": "Student not found" }`
- **Status**: 404

Supabase SQL에서 확인한 결과, 해당 학생과 학기 데이터는 실제로 존재함:
- `students` 테이블에 `id = 'f7b6e709-c50b-4586-84a6-8e5a5d51b9b1'`인 학생 존재
- `student_terms` 테이블에 `id = 'cda33d0a-9559-4e47-a01f-3fe955bbe3e6'`인 학기 정보 존재

## 원인 분석

### 1. 학생 조회 쿼리 WHERE 조건

```70:75:app/api/students/[id]/score-dashboard/route.ts
    // 1) 학생 기본 정보 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, grade, school_type")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
```

**문제점**:
- 쿼리에서 `.eq("tenant_id", tenantId)` 조건이 필수로 적용됨
- 실제 DB의 `students` 테이블에 해당 학생이 존재하더라도, `tenant_id` 값이 요청 파라미터의 `tenantId`와 일치하지 않으면 0건 반환
- 이로 인해 `student`가 `null`이 되어 404 에러 발생

### 2. DB 연결 설정 확인

**Dev 서버** (`lib/supabase/server.ts`):
- `createSupabaseServerClient()` 사용
- `env.NEXT_PUBLIC_SUPABASE_URL`과 `env.NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용
- RLS (Row Level Security) 적용

**Seed 스크립트** (`scripts/seedScoreDashboardDummy.ts`):
- `createClient()` 직접 사용
- `process.env.NEXT_PUBLIC_SUPABASE_URL`과 `process.env.SUPABASE_SERVICE_ROLE_KEY` 사용
- RLS 우회 (Service Role Key 사용)

**결론**: 둘 다 같은 `.env.local` 파일의 `NEXT_PUBLIC_SUPABASE_URL`을 사용하므로 **같은 Supabase 프로젝트**에 연결됨. DB 연결 문제는 아님.

### 3. 실제 원인

가장 가능성 높은 원인:
1. **tenant_id 불일치**: `students` 테이블의 `tenant_id` 값이 요청 파라미터의 `tenantId`와 일치하지 않음
2. **데이터 불일치**: SQL에서 확인한 데이터와 실제 API에서 조회하는 데이터가 다를 수 있음 (RLS 정책, 쿠키 인증 등)

## 수정 사항

### 1. 디버깅 로그 추가

학생 조회 전에 `tenant_id` 조건 없이 먼저 조회하여 실제 `tenant_id` 값을 확인:

```75:95:app/api/students/[id]/score-dashboard/route.ts
    // 디버깅: tenant_id 조건 없이 조회
    const { data: studentWithoutTenant, error: checkError } = await supabase
      .from("students")
      .select("id, name, grade, school_type, tenant_id")
      .eq("id", studentId)
      .maybeSingle();

    if (checkError) {
      console.error("[api/score-dashboard] 학생 조회 실패 (tenant_id 조건 없음)", checkError);
    } else if (studentWithoutTenant) {
      console.log("[api/score-dashboard] 학생 조회 결과 (tenant_id 조건 없음):", {
        found: true,
        studentId: studentWithoutTenant.id,
        name: studentWithoutTenant.name,
        actualTenantId: studentWithoutTenant.tenant_id,
        requestedTenantId: tenantId,
        tenantIdMatch: studentWithoutTenant.tenant_id === tenantId,
      });
    } else {
      console.log("[api/score-dashboard] 학생 조회 결과 (tenant_id 조건 없음): 학생을 찾을 수 없음");
    }
```

### 2. 에러 메시지 개선

`tenant_id` 불일치 시 더 자세한 에러 메시지 제공:

```113:136:app/api/students/[id]/score-dashboard/route.ts
    if (!student) {
      // 더 자세한 에러 메시지 제공
      const errorMessage = studentWithoutTenant
        ? `Student found but tenant_id mismatch. Student tenant_id: ${studentWithoutTenant.tenant_id}, Requested tenant_id: ${tenantId}`
        : "Student not found";
      
      console.error("[api/score-dashboard] 학생 조회 실패:", {
        studentId,
        tenantId,
        errorMessage,
        studentExists: !!studentWithoutTenant,
        actualTenantId: studentWithoutTenant?.tenant_id,
      });

      return NextResponse.json(
        { 
          error: "Student not found",
          details: studentWithoutTenant
            ? `Student exists but tenant_id mismatch. Expected: ${tenantId}, Actual: ${studentWithoutTenant.tenant_id}`
            : "Student does not exist",
        },
        { status: 404 }
      );
    }
```

## 해결 방법

### 즉시 확인 방법

1. **API 호출 후 서버 로그 확인**:
   - 디버깅 로그에서 실제 `tenant_id` 값 확인
   - 요청한 `tenantId`와 실제 DB의 `tenant_id` 비교

2. **Supabase에서 직접 확인**:
   ```sql
   SELECT id, tenant_id, name, grade, school_type
   FROM public.students
   WHERE id = 'f7b6e709-c50b-4586-84a6-8e5a5d51b9b1';
   ```

3. **올바른 tenantId로 재요청**:
   - 로그에서 확인한 실제 `tenant_id` 값을 사용하여 API 재호출

### 근본 해결 방법

1. **데이터 일관성 확인**:
   - `students` 테이블과 `student_terms` 테이블의 `tenant_id` 값이 일치하는지 확인
   - 필요시 데이터 마이그레이션 또는 수정

2. **API 호출 시 올바른 tenantId 사용**:
   - 클라이언트에서 API 호출 시 실제 학생의 `tenant_id` 값을 사용하도록 수정

3. **RLS 정책 확인**:
   - Supabase RLS 정책이 `tenant_id` 기반으로 제대로 설정되어 있는지 확인
   - 필요시 RLS 정책 수정

## 변경된 파일

- `app/api/students/[id]/score-dashboard/route.ts`
  - 디버깅 로그 추가
  - 에러 메시지 개선
  - `tenant_id` 불일치 시 상세 정보 제공

## 테스트 방법

1. **API 호출**:
   ```bash
   curl "http://localhost:3000/api/students/f7b6e709-c50b-4586-84a6-8e5a5d51b9b1/score-dashboard?tenantId=84b71a5d-5681-4da3-88d2-91e75ef89015&termId=cda33d0a-9559-4e47-a01f-3fe955bbe3e6"
   ```

2. **서버 로그 확인**:
   - 콘솔에서 `[api/score-dashboard]`로 시작하는 로그 확인
   - 실제 `tenant_id` 값과 요청한 `tenantId` 비교

3. **에러 응답 확인**:
   - 404 응답 시 `details` 필드에서 상세 정보 확인
   - `tenant_id` 불일치인지, 학생이 존재하지 않는지 구분 가능

## 추가 조사 필요 사항

### RLS (Row Level Security) 정책 확인

터미널 로그를 보면:
- `testScoreDashboard.ts` 스크립트는 `SERVICE_ROLE_KEY`를 사용하여 RLS를 우회하고 학생을 조회할 수 있음
- 하지만 API는 `ANON_KEY`를 사용하므로 RLS 정책이 적용됨
- 응답: `"details": "Student does not exist"` - `tenant_id` 조건 없이 조회해도 학생을 찾을 수 없음
- **SQL 쿼리로는 데이터가 존재함을 확인했지만, API에서는 조회 불가**

**확인된 원인**:
1. **RLS 정책이 활성화되어 있음**: `students` 테이블에 RLS가 활성화되어 있고, 현재 인증된 사용자가 해당 학생을 조회할 수 없도록 설정되어 있음
2. **인증 쿠키 없음**: `testScoreDashboard.ts`는 HTTP 요청만 보내므로 인증 쿠키가 없어 익명 사용자로 처리되고, RLS 정책에 의해 조회가 차단됨
3. **데이터는 존재하지만 RLS 정책이 조회를 차단**: SQL 쿼리로는 데이터가 존재하지만, API에서는 RLS 정책 때문에 조회 불가

**확인 방법**:
1. **서버 로그 확인**: 개발 서버 콘솔에서 `[api/score-dashboard]`로 시작하는 로그 확인
   - 현재 사용자 정보
   - 학생 조회 결과 (tenant_id 조건 없음)
   - 실제 tenant_id 값
2. **Supabase에서 RLS 정책 확인**:
   ```sql
   -- students 테이블의 RLS 정책 확인
   SELECT * FROM pg_policies WHERE tablename = 'students';
   
   -- RLS 활성화 여부 확인
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND tablename = 'students';
   ```

**해결 방법**:
1. **RLS 정책 수정**: `students` 테이블의 RLS 정책을 확인하고, 필요시 수정
2. **인증 추가**: API 호출 시 인증 쿠키를 포함하도록 수정
3. **서비스 역할 키 사용**: 관리자 API의 경우 `SERVICE_ROLE_KEY`를 사용하여 RLS 우회 (보안 주의)

## 참고 사항

- `tenant_id` 검증은 보안상 중요하므로 제거하지 않음
- 디버깅 로그는 개발 환경에서만 출력되도록 권장 (프로덕션에서는 제거 또는 조건부 출력)
- 향후 RLS 정책 개선 시 `tenant_id` 검증 로직 재검토 필요
- API는 인증된 사용자만 접근할 수 있도록 해야 함 (현재 인증 확인 로그 추가됨)

