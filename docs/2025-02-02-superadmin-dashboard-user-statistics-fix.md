# Super Admin 대시보드 사용자 통계 RLS 정책 문제 해결

**작업 일시**: 2025-02-02  
**문제**: 기관에 연결된 학생과 관리자가 있음에도 대시보드 통계에 수치가 반영되지 않음  
**원인**: RLS(Row Level Security) 정책으로 인해 일반 서버 클라이언트로는 모든 테넌트의 데이터를 조회할 수 없음  
**해결**: Admin Client를 사용하여 RLS 정책을 우회하고 모든 테넌트의 데이터 조회

---

## 문제 상황

### 증상

- Super Admin 대시보드의 사용자 통계에서 학생, 학부모, 관리자 수가 0으로 표시됨
- 실제로는 기관에 연결된 학생과 관리자가 존재함
- 기관 통계는 정상적으로 표시됨

### 원인 분석

1. **RLS 정책 제약**
   - `getUserStatistics` 함수가 일반 서버 클라이언트(`createSupabaseServerClient`)를 사용
   - RLS 정책으로 인해 Super Admin도 자신의 테넌트가 아닌 데이터는 조회 불가
   - 각 테이블(`students`, `parent_users`, `admin_users`)에 RLS 정책이 활성화되어 있음

2. **데이터 조회 실패**
   - `students` 테이블: tenant_id가 있는 학생들 조회 실패
   - `parent_users` 테이블: tenant_id가 있는 학부모들 조회 실패
   - `admin_users` 테이블: tenant_id가 있는 관리자들 조회 실패

---

## 해결 방법

### 수정 내용

**파일**: `lib/data/superadminDashboard.ts`

1. **Admin Client 사용**
   - `createSupabaseAdminClient`를 사용하여 RLS 정책 우회
   - Service Role Key를 사용하여 모든 데이터 조회 가능

2. **Fallback 처리**
   - Admin Client가 없을 경우 일반 서버 클라이언트로 fallback
   - 경고 메시지 로깅

3. **에러 처리 강화**
   - 각 쿼리별 에러 로깅 추가
   - 전체 에러 처리 추가

### 수정된 코드

```typescript
/**
 * 사용자 통계 조회
 * Super Admin은 모든 테넌트의 사용자를 볼 수 있어야 하므로 Admin Client 사용
 */
export async function getUserStatistics(): Promise<UserStatistics> {
  // Admin Client를 우선 사용 (RLS 우회하여 모든 테넌트의 데이터 조회)
  const adminClient = createSupabaseAdminClient();
  const supabase = adminClient || (await createSupabaseServerClient());

  if (!adminClient) {
    console.warn(
      "[superadminDashboard] Admin Client를 사용할 수 없어 서버 클라이언트로 조회합니다. RLS 정책으로 인해 일부 데이터가 누락될 수 있습니다."
    );
  }

  try {
    // 학생 수 (모든 테넌트의 학생)
    const { count: students, error: studentsError } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true });

    if (studentsError) {
      console.error("[superadminDashboard] 학생 수 조회 실패:", studentsError);
    }

    // ... (나머지 쿼리들도 동일한 패턴)
  } catch (error) {
    console.error("[superadminDashboard] 사용자 통계 조회 중 오류:", error);
    return {
      students: 0,
      parents: 0,
      admins: 0,
      consultants: 0,
      superadmins: 0,
      total: 0,
    };
  }
}
```

---

## 테스트 체크리스트

- [ ] Super Admin 대시보드 접속
- [ ] 사용자 통계 카드 확인
  - [ ] 학생 수가 정확히 표시되는지
  - [ ] 학부모 수가 정확히 표시되는지
  - [ ] 관리자 수가 정확히 표시되는지
  - [ ] 컨설턴트 수가 정확히 표시되는지
  - [ ] Super Admin 수가 정확히 표시되는지
  - [ ] 전체 사용자 수가 정확히 표시되는지
- [ ] 여러 테넌트에 사용자가 있을 때 모든 사용자가 집계되는지 확인
- [ ] Admin Client가 없을 때 fallback 동작 확인

---

## 주의사항

1. **Service Role Key 필요**
   - Admin Client를 사용하려면 `SUPABASE_SERVICE_ROLE_KEY` 환경 변수가 설정되어 있어야 함
   - 설정되지 않은 경우 일반 서버 클라이언트로 fallback되며, RLS 정책으로 인해 데이터가 누락될 수 있음

2. **보안 고려사항**
   - Admin Client는 RLS를 우회하므로 서버 사이드에서만 사용해야 함
   - 클라이언트 사이드에서는 절대 사용하지 않음

3. **기관 통계도 수정**
   - `getTenantStatistics` 함수도 동일하게 Admin Client를 사용하도록 수정
   - 일관성을 위해 동일한 패턴 적용

---

## 향후 개선 사항

1. **캐싱 추가**
   - 사용자 통계는 자주 변경되지 않으므로 캐싱 적용 고려
   - 캐시 무효화 전략 수립

2. **실시간 업데이트**
   - 사용자 추가/삭제 시 통계 자동 업데이트
   - Webhook 또는 이벤트 기반 업데이트

3. **통계 상세화**
   - 테넌트별 사용자 수 표시
   - 기간별 사용자 증가 추이 표시

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `fix: Super Admin 대시보드 사용자 통계 RLS 정책 우회`

