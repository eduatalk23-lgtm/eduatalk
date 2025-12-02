# 기관 관리 status 필드 추가 및 통계 수정

**작업 일시**: 2025-02-02  
**문제**: 
1. 기관 관리에서 활성, 비활성, 정지 관련 UI가 안 보임
2. 전체 기관 수에는 1이 있지만 활성, 비활성, 정지에는 모두 0

**원인**: 
- status 필드가 조회되지 않음
- status 필드가 UI에 표시되지 않음
- status 필드가 업데이트되지 않음
- 통계 조회 시 status가 null인 경우 처리되지 않음

**해결**: status 필드를 전체적으로 추가하고 통계 로직 수정

---

## 수정 내용

### 1. API 수정

#### GET /api/tenants
- status 필드를 select에 추가

#### POST /api/tenants
- status 필드를 기본값 'active'로 설정하여 생성

#### PUT /api/tenants/[id]
- status 필드를 업데이트할 수 있도록 수정
- body에 status가 포함되면 업데이트

### 2. 페이지 수정

#### tenants/page.tsx
- status 필드를 select에 추가

### 3. 컴포넌트 수정

#### TenantCard.tsx
- status 배지 추가 (활성: 초록색, 비활성: 회색, 정지: 빨간색)
- status가 null인 경우 '활성'으로 표시

#### TenantForm.tsx
- status 선택 필드 추가 (활성/비활성/정지)
- 기본값: 'active'

#### TenantList.tsx
- Tenant 타입에 status 필드 추가

### 4. 통계 수정

#### getTenantStatistics()
- 활성 기관 수 조회 시 status가 'active'이거나 null인 경우 모두 포함
- 에러 처리 추가

---

## 구현 세부사항

### Status 필드 값

- `active`: 활성 (기본값)
- `inactive`: 비활성
- `suspended`: 정지
- `null`: 활성으로 간주 (기존 데이터 호환성)

### UI 표시

- **활성**: 초록색 배지 (`bg-green-100 text-green-800`)
- **비활성**: 회색 배지 (`bg-gray-100 text-gray-800`)
- **정지**: 빨간색 배지 (`bg-red-100 text-red-800`)

### 통계 로직

```typescript
// 활성 기관 수 (status가 'active'이거나 null인 경우)
const { count: active } = await supabase
  .from("tenants")
  .select("*", { count: "exact", head: true })
  .or("status.eq.active,status.is.null");
```

---

## 테스트 체크리스트

- [ ] 기관 관리 페이지에서 status 배지가 표시되는지 확인
- [ ] 기관 생성 시 기본값 'active'로 설정되는지 확인
- [ ] 기관 수정 시 status를 변경할 수 있는지 확인
- [ ] 대시보드 통계에서 활성 기관 수가 정확히 표시되는지 확인
- [ ] status가 null인 기관이 활성으로 집계되는지 확인
- [ ] 비활성, 정지 기관 수가 정확히 표시되는지 확인

---

## 주의사항

1. **기존 데이터 호환성**
   - status가 null인 기관은 '활성'으로 간주
   - 통계에서도 null을 활성으로 집계

2. **기본값**
   - 새로 생성되는 기관은 자동으로 'active' 상태로 설정

3. **데이터 마이그레이션**
   - 마이그레이션 파일: `supabase/migrations/20251202172406_add_tenant_status_column.sql`
   - 마이그레이션이 적용되어 status 컬럼이 추가됨
   - 기존 데이터는 자동으로 'active'로 설정됨

4. **Fallback 처리**
   - status 컬럼이 없을 때를 대비한 fallback 처리 추가
   - 컬럼이 없어도 에러 없이 작동 (전체를 활성으로 간주)

---

## 향후 개선 사항

1. **일괄 상태 변경**
   - 여러 기관의 status를 한 번에 변경하는 기능

2. **상태 변경 이력**
   - 기관 상태 변경 이력 기록

3. **상태별 필터링**
   - 기관 목록에서 status별로 필터링

4. **자동 상태 변경**
   - 특정 조건에 따라 자동으로 상태 변경 (예: 장기 미사용 시 비활성화)

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: 기관 관리 status 필드 추가 및 통계 수정`

