# camp_invitations 테이블 INSERT RLS 정책 추가

## 📋 작업 개요

**날짜**: 2025-02-02  
**문제**: `camp_invitations` 테이블에 INSERT 시 RLS 정책 위반 에러 발생  
**에러 코드**: `42501` - `new row violates row-level security policy for table "camp_invitations"`

## 🔍 문제 분석

### 에러 발생 위치
- **파일**: `app/(admin)/actions/campTemplateActions.ts`
- **함수**: `sendCampInvitationsAction`
- **라인**: 1078-1081 (INSERT 쿼리)

### 원인
`camp_invitations` 테이블에 RLS가 활성화되어 있지만, INSERT를 허용하는 RLS 정책이 없어서 관리자/컨설턴트가 초대를 생성할 수 없었습니다.

### 관련 코드
```typescript
const { data: insertedInvitations, error } = await supabase
  .from("camp_invitations")
  .insert(invitations)
  .select("id");
```

## ✅ 해결 방법

### 마이그레이션 파일 생성
**파일**: `supabase/migrations/20250202000000_add_camp_invitations_insert_policy.sql`

### RLS 정책 내용

#### 정책명: `camp_invitations_insert_for_admin`

**목적**: 관리자/컨설턴트가 자신의 테넌트에 속한 캠프 초대를 생성할 수 있도록 허용

**보안 요구사항**:
1. 관리자/컨설턴트만 INSERT 가능 (`admin_users` 테이블에 존재)
2. 자신의 테넌트(`tenant_id`)에 속한 초대만 생성 가능
3. 템플릿이 자신의 테넌트에 속해야 함
4. Super Admin은 모든 테넌트의 초대 생성 가능

**정책 SQL**:
```sql
CREATE POLICY "camp_invitations_insert_for_admin"
ON camp_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  -- 관리자/컨설턴트만 INSERT 가능
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  -- 자신의 테넌트에 속한 초대만 생성 가능
  AND (
    tenant_id IN (
      SELECT tenant_id FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
  -- 템플릿이 자신의 테넌트에 속해야 함
  AND EXISTS (
    SELECT 1 FROM camp_templates
    WHERE camp_templates.id = camp_invitations.camp_template_id
      AND (
        camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.role = 'superadmin'
        )
      )
  )
);
```

## 🔄 적용 과정

1. ✅ 마이그레이션 파일 생성
2. ✅ Supabase에 마이그레이션 적용
3. ✅ 정책 검증 완료

## 📝 참고 사항

### 관련 파일
- `app/(admin)/actions/campTemplateActions.ts` - 초대 발송 액션
- `supabase/migrations/20250202000000_add_camp_invitations_insert_policy.sql` - 마이그레이션 파일

### 다른 유사 정책 참고
- `parent_student_links_insert_own` - 학부모 연결 요청 INSERT 정책
- `students_insert_own` - 학생 회원가입 INSERT 정책
- `parent_student_links_insert_for_admin` - 관리자 연결 요청 INSERT 정책

### 보안 고려사항
- 최소 권한 원칙 적용: 관리자/컨설턴트만 INSERT 가능
- 테넌트 격리: 자신의 테넌트에 속한 초대만 생성 가능
- 템플릿 검증: 템플릿이 자신의 테넌트에 속해야 함
- Super Admin 예외: Super Admin은 모든 테넌트의 초대 생성 가능

## 🧪 테스트 방법

1. 관리자 계정으로 로그인
2. 캠프 템플릿 상세 페이지에서 학생 초대 발송 시도
3. 초대가 정상적으로 생성되는지 확인

## ✅ 완료 체크리스트

- [x] 마이그레이션 파일 생성
- [x] RLS 정책 적용
- [x] 정책 검증 완료
- [x] 작업 문서 작성

## 📚 관련 문서

- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md)
- [RLS 정책 분석](./rls-policy-analysis.md)

