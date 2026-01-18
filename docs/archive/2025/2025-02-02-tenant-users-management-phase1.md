# 기관별 사용자 관리 기능 구현 (Phase 1)

**작업 일시**: 2025-02-02  
**목적**: 관리자가 기관별 학생 및 학부모를 조회하고 관리할 수 있는 기능 구현

---

## 구현 개요

### Phase 1: 관리자 기관별 사용자 관리 기능

기관별 사용자 관리의 기초 기능을 구현했습니다. 관리자가 모든 사용자를 조회하고, 기관에 할당하거나 이동시킬 수 있습니다.

---

## 구현된 기능

### 1. 관리자 사이드바 메뉴 추가

**파일**: `components/navigation/global/categoryConfig.ts`

- "설정" 카테고리 아래에 "기관별 사용자 관리" 메뉴 추가
- Admin만 접근 가능 (`roles: ["admin"]`)
- 경로: `/admin/tenant/users`

### 2. 기관별 사용자 관리 페이지

**파일**: `app/(admin)/admin/tenant/users/page.tsx`

- Admin 권한 체크
- TenantContext를 통한 기관 정보 확인
- TenantUsersManagement 컴포넌트 렌더링

### 3. 사용자 관리 컴포넌트

**파일**: `app/(admin)/admin/tenant/users/_components/TenantUsersManagement.tsx`

**주요 기능**:

1. **통계 카드**
   - 전체 사용자 수
   - 학생 수
   - 학부모 수
   - 미할당 사용자 수

2. **필터링**
   - 전체 / 학생 / 학부모 필터
   - 실시간 필터 적용

3. **검색 기능**
   - 이름, 이메일, 학년으로 검색
   - 실시간 검색

4. **사용자 목록 테이블**
   - 이름, 이메일, 유형, 정보, 기관 상태 표시
   - 기관 할당/이동 버튼
   - 현재 기관 사용자는 "현재 기관" 표시

### 4. Server Actions

**파일**: `app/(admin)/actions/tenantUsers.ts`

#### `getTenantUsersAction(tenantId: string)`

- 모든 학생 및 학부모 목록 조회
- Supabase Auth에서 사용자 메타데이터 조회 (이메일, 이름)
- Super Admin: 모든 기관의 사용자 조회
- 일반 Admin: 현재 기관의 사용자만 조회

**반환 타입**:
```typescript
type TenantUser = {
  id: string;
  email: string | null;
  name: string | null;
  tenant_id: string | null;
  type: "student" | "parent";
  // student specific
  grade?: string | null;
  class?: string | null;
  // parent specific
  relationship?: string | null;
};
```

#### `assignUserToTenantAction(userId, tenantId, userType)`

- 사용자를 기관에 할당/이동
- 학생: `students` 테이블의 `tenant_id` 업데이트
- 학부모: `parent_users` 테이블의 `tenant_id` 업데이트
- Admin 권한 필요

---

## 데이터베이스 구조

### students 테이블
- `id`: Primary Key
- `user_id`: Supabase Auth 사용자 ID
- `tenant_id`: 기관 ID (NOT NULL)
- `grade`: 학년
- `name`: 이름

### parent_users 테이블
- `id`: Primary Key (Supabase Auth 사용자 ID)
- `tenant_id`: 기관 ID (nullable)
- `relationship`: 관계 (father, mother, guardian, other)

---

## 사용 방법

### 1. 접근 방법

1. 관리자로 로그인
2. 사이드바에서 "설정" → "기관별 사용자 관리" 클릭
3. `/admin/tenant/users` 페이지 접근

### 2. 사용자 할당

1. 사용자 목록에서 "할당" 또는 "이동" 버튼 클릭
2. 확인 후 자동으로 기관에 할당됨
3. 통계 카드가 자동으로 업데이트됨

### 3. 필터링 및 검색

- 상단 필터 버튼으로 학생/학부모 필터링
- 검색창에 이름, 이메일, 학년 입력하여 검색

---

## 권한 관리

- **Admin**: 현재 기관의 사용자만 조회 및 할당 가능
- **Super Admin**: 모든 기관의 사용자 조회 및 할당 가능 (향후 구현)

---

## 향후 개선 사항

### Phase 2: 회원가입 시 기관 선택
- 회원가입 폼에 기관 선택 필드 추가
- 기관 목록 조회 및 검색
- 선택한 기관에 자동 할당

### Phase 3: 권한 선택 기능
- 회원가입 시 학생/학부모 선택
- 가입 후 권한 변경 기능

### 추가 개선 사항
- 일괄 할당 기능 (여러 사용자를 한 번에 할당)
- 기관 간 이동 이력 관리
- 사용자 상세 정보 모달
- Excel 내보내기 기능

---

## 파일 변경 목록

### 신규 파일
- `app/(admin)/admin/tenant/users/page.tsx`
- `app/(admin)/admin/tenant/users/_components/TenantUsersManagement.tsx`
- `app/(admin)/actions/tenantUsers.ts`

### 수정 파일
- `components/navigation/global/categoryConfig.ts`

---

## 테스트 체크리스트

- [ ] 관리자로 로그인하여 메뉴 접근 확인
- [ ] 학생/학부모 목록 조회 확인
- [ ] 통계 카드 정확성 확인
- [ ] 필터링 기능 확인
- [ ] 검색 기능 확인
- [ ] 사용자 기관 할당 기능 확인
- [ ] 사용자 기관 이동 기능 확인
- [ ] 권한 체크 (일반 사용자 접근 불가)

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: 기관별 사용자 관리 기능 구현 (Phase 1)`

