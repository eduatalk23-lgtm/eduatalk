# SMS 발송 대상자 목록 조회 문제 해결 가이드

## 문제 증상

SMS 발송 페이지(`/admin/sms`)에서 학생 목록이 조회되지 않는 경우

## 점검 사항

### 1. 데이터베이스에 학생 데이터가 있는지 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT COUNT(*) as total_students FROM students;

-- 특정 tenant의 학생 수 확인
SELECT COUNT(*) as tenant_students 
FROM students 
WHERE tenant_id = 'your-tenant-id';
```

### 2. RLS (Row Level Security) 정책 확인

관리자는 자신의 tenant에 속한 학생만 조회할 수 있습니다.

```sql
-- students 테이블의 RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'students';
```

### 3. 브라우저 콘솔 확인

개발 환경에서 브라우저 콘솔을 열고 다음 로그를 확인:

```
[admin/sms] 학생 목록 조회 결과: {
  count: 0,
  tenantId: "...",
  hasError: false,
  errorCode: undefined
}
```

### 4. 서버 로그 확인

터미널에서 다음 에러 로그를 확인:

```
[admin/sms] 학생 목록 조회 실패: {
  error: "...",
  code: "...",
  details: "...",
  hint: "..."
}
```

## 일반적인 원인 및 해결 방법

### 원인 1: RLS 정책 문제

**증상**: 학생 데이터는 있지만 조회되지 않음

**해결**:
1. Supabase 대시보드 → Authentication → Policies
2. `students` 테이블의 SELECT 정책 확인
3. 관리자가 자신의 tenant 학생을 조회할 수 있는 정책이 있는지 확인

**예시 정책**:
```sql
CREATE POLICY "admin_can_select_own_tenant_students" ON students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = students.tenant_id
    )
  );
```

### 원인 2: tenant_id 불일치

**증상**: 관리자의 tenant_id와 학생의 tenant_id가 일치하지 않음

**해결**:
1. 관리자 정보 확인:
   ```sql
   SELECT id, tenant_id FROM admin_users WHERE id = auth.uid();
   ```

2. 학생의 tenant_id 확인:
   ```sql
   SELECT id, name, tenant_id FROM students LIMIT 10;
   ```

3. tenant_id가 일치하는지 확인

### 원인 3: 컬럼 누락

**증상**: 특정 컬럼(`is_active`, `parent_contact` 등)이 없어서 에러 발생

**해결**:
- 코드에서 자동으로 처리하도록 되어 있음
- 에러가 발생하면 마이그레이션 파일 확인

### 원인 4: 권한 문제

**증상**: `403 Forbidden` 또는 권한 관련 에러

**해결**:
1. 사용자 역할 확인:
   ```typescript
   const { role } = await getCurrentUserRole();
   // role이 'admin' 또는 'consultant'인지 확인
   ```

2. `isAdminRole(role)` 함수가 `true`를 반환하는지 확인

## 디버깅 방법

### 1. 개발 환경에서 상세 로그 확인

`app/(admin)/admin/sms/page.tsx`에서 다음 로그가 출력됩니다:

```typescript
// 개발 환경에서만 출력
console.log("[admin/sms] 학생 목록 조회 결과:", {
  count: studentsForSMS?.length ?? 0,
  tenantId: tenantContext?.tenantId,
  hasError: !!studentsError,
  errorCode: studentsError?.code,
});
```

### 2. 네트워크 탭 확인

브라우저 개발자 도구 → Network 탭에서:
- `/admin/sms` 페이지 로드 시 Supabase API 호출 확인
- `students` 테이블 조회 요청 확인
- 응답 상태 코드 및 에러 메시지 확인

### 3. Supabase 로그 확인

Supabase 대시보드 → Logs → API Logs에서:
- 최근 요청 확인
- 에러 응답 확인
- RLS 정책 위반 여부 확인

## 추가 확인 사항

### 학생 데이터 구조 확인

```sql
-- 학생 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
ORDER BY ordinal_position;
```

### 필수 컬럼 확인

SMS 발송에 필요한 컬럼:
- `id` (필수)
- `name` (선택, 표시용)
- `parent_contact` (SMS 발송에 필수)
- `grade`, `class` (선택, 필터링용)
- `is_active` (선택, 필터링용)
- `tenant_id` (RLS 정책용)

## 테스트 방법

### 1. 간단한 쿼리 테스트

Supabase SQL Editor에서:

```sql
-- 현재 사용자로 학생 조회 테스트
SELECT id, name, parent_contact 
FROM students 
ORDER BY name 
LIMIT 10;
```

### 2. RLS 정책 테스트

```sql
-- RLS 정책이 적용된 상태에서 조회
SET ROLE authenticated;
SELECT id, name FROM students LIMIT 10;
```

### 3. API 직접 호출 테스트

```bash
# Supabase API 직접 호출 (개발 환경)
curl -X GET \
  'https://your-project.supabase.co/rest/v1/students?select=id,name,parent_contact&order=name.asc' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 해결 후 확인

수정 후 다음을 확인:

1. ✅ 학생 목록이 정상적으로 표시되는가?
2. ✅ 필터 기능이 작동하는가?
3. ✅ 학부모 연락처가 있는 학생만 선택 가능한가?
4. ✅ 에러 메시지가 표시되지 않는가?

## 관련 파일

- `app/(admin)/admin/sms/page.tsx` - 학생 목록 조회 로직
- `app/(admin)/admin/sms/_components/SMSRecipientSelector.tsx` - 학생 선택 UI
- `lib/tenant/getTenantContext.ts` - Tenant 정보 조회
- `lib/auth/getCurrentUserRole.ts` - 사용자 역할 확인

