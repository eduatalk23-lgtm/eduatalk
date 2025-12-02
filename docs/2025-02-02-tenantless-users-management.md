# Super Admin 테넌트 미할당 사용자 관리 기능 구현

**작업 일시**: 2025-02-02  
**목적**: Super admin 페이지에서 테넌트가 할당되지 않은 사용자들을 조회하고 관리할 수 있는 기능 구현

---

## 구현 개요

Super admin이 테넌트가 할당되지 않은 사용자(students, parents, admin_users)를 조회하고, 테넌트를 할당할 수 있는 관리 기능을 구현했습니다.

---

## 구현된 기능

### 1. Server Actions

**파일**: `app/(superadmin)/actions/tenantlessUserActions.ts`

#### 주요 함수

- `getTenantlessUsers(userType?)`: 테넌트 미할당 사용자 조회
  - 학생, 학부모, 관리자 중 선택적으로 조회 가능
  - Supabase Auth에서 이메일 정보 조회
  - 생성일 기준 정렬 (최신순)

- `assignTenantToUser(userId, tenantId, userType)`: 단일 사용자에 테넌트 할당
  - 사용자 타입에 따라 해당 테이블 업데이트
  - 테넌트 존재 여부 확인

- `assignTenantToMultipleUsers(userIds, tenantId)`: 다중 사용자에 테넌트 할당
  - 일괄 할당 기능
  - 할당 성공/실패 개수 반환

- `getActiveTenants()`: 활성 테넌트 목록 조회
  - 테넌트 할당 시 선택 옵션으로 사용

### 2. 메인 페이지

**파일**: `app/(superadmin)/superadmin/tenantless-users/page.tsx`

**주요 기능**:

1. **권한 확인**
   - Super admin만 접근 가능
   - 권한 없으면 로그인 페이지로 리다이렉트

2. **사용자 조회**
   - 타입별 필터 (학생/학부모/관리자/전체)
   - 검색 기능 (이메일, 이름)
   - 페이지네이션 (페이지당 20명)

3. **통계 표시**
   - 전체 사용자 수
   - 타입별 사용자 수 (학생/학부모/관리자)

### 3. 사용자 목록 컴포넌트

**파일**: `app/(superadmin)/superadmin/tenantless-users/_components/TenantlessUsersList.tsx`

**주요 기능**:

1. **필터링 및 검색**
   - 타입별 필터 탭 (전체/학생/학부모/관리자)
   - 이메일 또는 이름으로 검색
   - URL 파라미터로 상태 관리

2. **사용자 목록 표시**
   - 체크박스로 다중 선택
   - 이메일, 이름, 역할, 가입일 표시
   - 역할별 색상 구분 (학생: 파란색, 학부모: 보라색, 관리자: 인디고)

3. **테넌트 할당**
   - 단일 사용자 할당 버튼
   - 일괄 할당 버튼 (선택된 사용자들)

4. **페이지네이션**
   - 이전/다음 버튼
   - 현재 페이지 / 전체 페이지 표시
   - 총 사용자 수 표시

### 4. 테넌트 할당 다이얼로그

**파일**: `app/(superadmin)/superadmin/tenantless-users/_components/AssignTenantDialog.tsx`

**주요 기능**:

1. **테넌트 선택**
   - 활성 테넌트 목록 자동 로드
   - 드롭다운으로 테넌트 선택

2. **할당 모드**
   - 단일 사용자 할당 모드
   - 다중 사용자 일괄 할당 모드

3. **에러 처리**
   - 테넌트 목록 로드 실패 시 에러 표시
   - 할당 실패 시 에러 메시지 표시

4. **UI/UX**
   - 로딩 상태 표시
   - 할당 완료 후 자동 새로고침

### 5. 대시보드 링크 추가

**파일**: `app/(superadmin)/superadmin/dashboard/page.tsx`

- 빠른 액션 섹션에 "테넌트 미할당 사용자" 카드 추가
- 그리드를 3열에서 4열로 변경 (lg 화면에서)

---

## 데이터 흐름

### 1. 사용자 조회 플로우

```
Super Admin 접근
  ↓
권한 확인 (superadmin)
  ↓
테넌트 미할당 사용자 조회
  ├─ students 테이블 (tenant_id IS NULL)
  ├─ parent_users 테이블 (tenant_id IS NULL)
  └─ admin_users 테이블 (tenant_id IS NULL, superadmin 제외)
  ↓
Supabase Auth에서 이메일 정보 조회
  ↓
사용자 목록 표시
```

### 2. 테넌트 할당 플로우

```
사용자 선택 (단일 또는 다중)
  ↓
테넌트 선택 다이얼로그 열기
  ↓
활성 테넌트 목록 조회
  ↓
테넌트 선택
  ↓
할당 실행
  ├─ 단일: assignTenantToUser()
  └─ 다중: assignTenantToMultipleUsers()
  ↓
해당 테이블 업데이트 (tenant_id 설정)
  ↓
목록 새로고침
```

---

## 사용 방법

### 1. 테넌트 미할당 사용자 조회

1. Super Admin 대시보드 접속
2. "테넌트 미할당 사용자" 카드 클릭
3. 타입별 필터 또는 검색으로 사용자 찾기

### 2. 단일 사용자에 테넌트 할당

1. 사용자 목록에서 "테넌트 할당" 버튼 클릭
2. 테넌트 선택 다이얼로그에서 테넌트 선택
3. "할당하기" 버튼 클릭

### 3. 다중 사용자에 테넌트 일괄 할당

1. 사용자 목록에서 체크박스로 여러 사용자 선택
2. "선택한 N명 할당" 버튼 클릭
3. 테넌트 선택 다이얼로그에서 테넌트 선택
4. "할당하기" 버튼 클릭

---

## UI 개선 사항

### 통계 카드
- 전체 사용자 수
- 타입별 사용자 수 (학생/학부모/관리자)

### 필터링
- 타입별 필터 탭 (전체/학생/학부모/관리자)
- 검색 기능 (이메일, 이름)

### 사용자 목록
- 역할별 색상 구분
- 체크박스로 다중 선택
- 페이지네이션

### 테넌트 할당
- 모달 다이얼로그로 깔끔한 UI
- 로딩 상태 표시
- 에러 메시지 표시

---

## 파일 변경 목록

### 신규 파일

- `app/(superadmin)/actions/tenantlessUserActions.ts`
- `app/(superadmin)/superadmin/tenantless-users/page.tsx`
- `app/(superadmin)/superadmin/tenantless-users/_components/TenantlessUsersList.tsx`
- `app/(superadmin)/superadmin/tenantless-users/_components/AssignTenantDialog.tsx`

### 수정 파일

- `app/(superadmin)/superadmin/dashboard/page.tsx`
  - 빠른 액션 섹션에 테넌트 미할당 사용자 관리 링크 추가
  - 그리드를 3열에서 4열로 변경

---

## 테스트 체크리스트

- [ ] Super Admin 권한 확인 (다른 역할은 접근 불가)
- [ ] 테넌트 미할당 학생 조회 확인
- [ ] 테넌트 미할당 학부모 조회 확인
- [ ] 테넌트 미할당 관리자 조회 확인 (superadmin 제외)
- [ ] 타입별 필터 동작 확인
- [ ] 검색 기능 동작 확인
- [ ] 페이지네이션 동작 확인
- [ ] 단일 사용자 테넌트 할당 확인
- [ ] 다중 사용자 테넌트 일괄 할당 확인
- [ ] 테넌트 할당 후 목록 새로고침 확인
- [ ] 에러 처리 확인 (테넌트 없음, 권한 없음 등)

---

## 주의사항

1. **Super Admin만 접근 가능**
   - 모든 Server Actions에서 superadmin 권한 확인
   - 권한 없으면 에러 반환

2. **Super Admin 제외**
   - admin_users 테이블에서 superadmin은 조회하지 않음
   - superadmin은 tenant_id가 null이어야 함

3. **테넌트 존재 확인**
   - 할당 전에 테넌트 존재 여부 확인
   - 존재하지 않으면 에러 반환

4. **데이터 일관성**
   - 할당 후 해당 테이블의 tenant_id 업데이트
   - users 테이블은 업데이트하지 않음 (각 테이블에서 관리)

---

## 향후 개선 사항

1. **사용자 상세 정보 표시**
   - 클릭 시 사용자 상세 정보 모달 표시
   - 학생: 학년, 반, 학교 정보
   - 학부모: 자녀 정보
   - 관리자: 역할, 부서 정보

2. **테넌트 할당 이력**
   - 할당 이력 기록
   - 할당자, 할당 일시 기록

3. **일괄 작업 개선**
   - CSV 파일로 일괄 할당
   - 할당 결과 리포트 생성

4. **알림 기능**
   - 테넌트 할당 시 사용자에게 알림
   - 관리자에게 할당 완료 알림

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: Super Admin 테넌트 미할당 사용자 관리 기능 구현`

