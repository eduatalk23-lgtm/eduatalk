# Admin 페이지 본인 기관 메뉴 UI 개선

**작업일**: 2025-02-02  
**작업자**: AI Assistant  
**목적**: Admin 페이지에서 본인 기관 정보를 사이드바에 표시하여 사용자가 현재 소속 기관을 쉽게 확인할 수 있도록 개선

---

## 개선 내용

### 1. 사이드바에 기관 정보 표시

**목적**: Admin/Consultant 사용자가 현재 소속 기관을 사이드바에서 바로 확인할 수 있도록 함

**표시 위치**:
- 데스크톱: 사이드바 로고 아래, 네비게이션 메뉴 위
- 모바일: 상단 네비게이션 로고 아래

**표시 정보**:
- 기관 이름 (🏢 아이콘과 함께)
- 기관 유형 (학원, 학교, 기업 등)

---

## 구현 사항

### 1. RoleBasedLayout 컴포넌트 개선

**파일**: `components/layout/RoleBasedLayout.tsx`

**변경 사항**:
1. `tenantInfo` prop 추가
   ```typescript
   tenantInfo?: {
     name: string;
     type?: string;
   } | null;
   ```

2. 사이드바에 기관 정보 섹션 추가
   - 로고와 네비게이션 메뉴 사이에 표시
   - Admin/Consultant 역할인 경우에만 표시
   - 기관 이름과 유형을 표시

3. 모바일 네비게이션에도 동일한 기관 정보 표시

**UI 디자인**:
- 배경색: `bg-gray-50`
- 아이콘: 🏢
- 기관 이름: 굵은 글씨 (`font-semibold`)
- 기관 유형: 작은 회색 글씨

---

### 2. AdminLayout 컴포넌트 개선

**파일**: `app/(admin)/layout.tsx`

**변경 사항**:
1. 기관 정보 조회 로직 추가
   - `getTenantContext()`로 현재 사용자의 tenantId 조회
   - `tenants` 테이블에서 기관 이름과 유형 조회
   - Admin/Consultant인 경우에만 조회

2. RoleBasedLayout에 tenantInfo 전달

**구현 코드**:
```typescript
// 기관 정보 조회 (Admin/Consultant인 경우)
let tenantInfo = null;
if (role === "admin" || role === "consultant") {
  const tenantContext = await getTenantContext();
  if (tenantContext?.tenantId) {
    const supabase = await createSupabaseServerClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, type")
      .eq("id", tenantContext.tenantId)
      .maybeSingle();

    if (tenant) {
      tenantInfo = {
        name: tenant.name,
        type: tenant.type || undefined,
      };
    }
  }
}
```

---

## UI 개선 상세

### 데스크톱 사이드바

```
┌─────────────────────────┐
│ ⏱️ TimeLevelUp Admin    │  ← 로고
├─────────────────────────┤
│ 🏢 기관 이름            │  ← 새로 추가된 기관 정보
│    학원                 │
├─────────────────────────┤
│ 📊 대시보드            │  ← 네비게이션 메뉴
│ 👥 학생 관리           │
│ ...                     │
└─────────────────────────┘
```

### 모바일 네비게이션

```
┌─────────────────────────┐
│ ⏱️ TimeLevelUp Admin    │  ← 로고
├─────────────────────────┤
│ 🏢 기관 이름            │  ← 새로 추가된 기관 정보
│    학원                 │
├─────────────────────────┤
│ 📊 대시보드            │  ← 네비게이션 메뉴
│ ...                     │
└─────────────────────────┘
```

---

## 기관 유형 표시 규칙

| DB 값 | 표시 텍스트 |
|-------|------------|
| `academy` | 학원 |
| `school` | 학교 |
| `enterprise` | 기업 |
| 기타 | 기타 |

---

## 조건부 표시 로직

### 표시 조건
- ✅ Admin 역할인 경우
- ✅ Consultant 역할인 경우
- ✅ 기관 정보가 정상적으로 조회된 경우

### 표시 안 함
- ❌ Student 역할
- ❌ Parent 역할
- ❌ Superadmin 역할
- ❌ 기관 정보 조회 실패

---

## 관련 파일

### 수정된 파일
1. `components/layout/RoleBasedLayout.tsx`
   - `tenantInfo` prop 추가
   - 사이드바에 기관 정보 섹션 추가
   - 모바일 네비게이션에 기관 정보 섹션 추가

2. `app/(admin)/layout.tsx`
   - 기관 정보 조회 로직 추가
   - RoleBasedLayout에 tenantInfo 전달

### 사용된 유틸리티
- `lib/tenant/getTenantContext.ts` - 현재 사용자의 tenantId 조회
- `lib/supabase/server.ts` - Supabase 서버 클라이언트

---

## 결과

### 개선 전
- ❌ Admin 사용자가 본인 기관을 확인하려면 설정 페이지로 이동해야 함
- ❌ 사이드바에서 현재 소속 기관을 바로 확인 불가

### 개선 후
- ✅ 사이드바에서 바로 본인 기관 확인 가능
- ✅ 기관 이름과 유형이 명확하게 표시됨
- ✅ 데스크톱과 모바일 모두 지원
- ✅ Admin/Consultant만 표시되어 역할별 맞춤 UI 제공

---

## 테스트 체크리스트

- [x] Admin 역할 사용자에서 기관 정보가 표시되는지 확인
- [x] Consultant 역할 사용자에서 기관 정보가 표시되는지 확인
- [x] Student 역할 사용자에서 기관 정보가 표시되지 않는지 확인
- [x] Superadmin 역할 사용자에서 기관 정보가 표시되지 않는지 확인
- [x] 기관 정보가 없는 경우 표시되지 않는지 확인
- [x] 데스크톱 사이드바에 기관 정보가 올바르게 표시되는지 확인
- [x] 모바일 네비게이션에 기관 정보가 올바르게 표시되는지 확인
- [x] 기관 유형(학원, 학교, 기업 등)이 올바르게 표시되는지 확인

---

## 결론

**Admin/Consultant 사용자가 사이드바에서 본인 기관 정보를 바로 확인할 수 있도록 UI를 개선했습니다.**

- ✅ 사용자 경험 향상: 기관 정보를 찾기 위해 별도 페이지로 이동할 필요 없음
- ✅ 역할별 맞춤 UI: Admin/Consultant만 표시되어 불필요한 정보 노출 방지
- ✅ 반응형 지원: 데스크톱과 모바일 모두 지원

