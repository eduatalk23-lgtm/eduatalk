# 데이터 페칭 패턴 통일 리팩토링

## 작업 일시
2025-01-31

## 개요
`lib/data/` 디렉토리의 데이터 페칭 함수들에 일관된 패턴을 적용하고, 공통 인증/테넌트 체크 로직을 추출하여 코드 중복을 제거했습니다.

## 완료된 작업

### 1. 공통 데이터 페칭 레이어 생성

#### `lib/data/core/` 디렉토리 구조
```
lib/data/core/
├── types.ts           # 공통 타입 정의
├── errorHandler.ts    # 공통 에러 처리
├── queryBuilder.ts    # Supabase 쿼리 빌더 래퍼
├── baseRepository.ts  # 기본 Repository 패턴
└── index.ts           # 배럴 익스포트
```

#### 주요 기능

**errorHandler.ts**
- `handleQueryError`: 에러를 안전하게 처리하고 로깅
- `isError`: 에러 발생 여부 확인 (무시할 에러 코드 제외)
- `isColumnNotFoundError`: 42703 에러 코드 확인

**queryBuilder.ts**
- `executeQuery`: 안전한 쿼리 실행 (기본값, fallback 쿼리 지원)
- `executeSingleQuery`: 단일 레코드 조회
- `executeQueriesParallel`: 여러 쿼리 병렬 실행

**baseRepository.ts**
- `BaseRepository`: 기본 CRUD 작업을 위한 베이스 클래스
- `findById`, `findByIds`, `create`, `update`, `delete`, `softDelete` 메서드 제공

**types.ts**
- `SupabaseServerClient`: Supabase 서버 클라이언트 타입
- `BaseEntity`, `SoftDeletableEntity`, `TenantEntity`: 기본 엔티티 타입
- `BaseFilters`, `PaginationOptions`, `SortOptions`: 쿼리 옵션 타입

### 2. 공통 인증/테넌트 체크 로직 추출

#### `lib/auth/requireStudentAuth.ts`
```typescript
export async function requireStudentAuth(): Promise<{
  userId: string;
  role: "student";
  tenantId: string | null;
  email?: string | null;
}>
```
- 현재 사용자가 학생인지 확인하고, 학생 정보를 반환
- 학생이 아니면 에러를 throw

#### `lib/tenant/requireTenantContext.ts`
```typescript
export async function requireTenantContext(): Promise<{
  tenantId: string;
  role: "admin" | "consultant" | "parent" | "student";
  userId: string;
}>
```
- 테넌트 컨텍스트를 조회하고, 없으면 에러를 throw
- Super Admin은 tenantId가 null일 수 있으므로 에러 처리

#### `lib/tenant/requireStudentWithTenant.ts`
```typescript
export async function requireStudentWithTenant(): Promise<{
  userId: string;
  role: "student";
  tenantId: string;
  email?: string | null;
}>
```
- 학생 인증과 테넌트 컨텍스트를 함께 요구하는 헬퍼

### 3. 기존 파일 리팩토링

#### `lib/data/students.ts`
- `executeQuery`, `executeSingleQuery` 사용으로 변경
- 에러 처리 패턴 통일

#### `app/(student)/actions/plan-groups/` 디렉토리
다음 파일들을 리팩토링:
- `create.ts`: `requireStudentAuth`, `requireTenantContext` 사용
- `update.ts`: `requireStudentAuth`, `requireTenantContext` 사용
- `delete.ts`: `requireStudentAuth` 사용
- `status.ts`: `requireStudentAuth` 사용
- `queries.ts`: `requireStudentAuth` 사용
- `exclusions.ts`: `requireStudentAuth`, `requireTenantContext` 사용
- `academy.ts`: `requireStudentAuth`, `requireTenantContext` 사용
- `plans.ts`: `requireTenantContext` 사용 (관리자/컨설턴트 권한 허용)

## 개선 효과

### 코드 중복 제거
- **Before**: 각 함수마다 동일한 인증/테넌트 체크 로직 반복
- **After**: 공통 헬퍼 함수 사용으로 코드 중복 제거

### 에러 처리 일관성
- **Before**: 각 파일마다 다른 에러 처리 패턴
- **After**: 공통 에러 처리 함수 사용으로 일관성 확보

### 유지보수성 향상
- 인증/테넌트 체크 로직 변경 시 한 곳만 수정하면 됨
- 에러 처리 로직 변경 시 한 곳만 수정하면 됨

### 타입 안전성 강화
- 공통 타입 정의로 타입 일관성 확보
- `requireStudentAuth`, `requireTenantContext` 반환 타입 명확화

## 사용 예시

### Before
```typescript
async function _createPlanGroup(data: PlanGroupCreationData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // ... 나머지 로직
}
```

### After
```typescript
async function _createPlanGroup(data: PlanGroupCreationData) {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  // ... 나머지 로직
}
```

## 남은 작업

### Phase 2: 단기 개선
1. **나머지 `lib/data/` 파일들 리팩토링**
   - `planGroups.ts`, `studentPlans.ts` 등 다른 파일들도 새 패턴 적용
   - `executeQuery`, `executeSingleQuery` 사용으로 변경

2. **Supabase 클라이언트 사용 최적화**
   - Server Actions에서 클라이언트를 파라미터로 받도록 변경
   - 상위 레벨에서 클라이언트 생성 후 하위 함수로 전달

3. **중복 함수 통합**
   - 학생 조회 함수들 통합 검토
   - 플랜 조회 함수들 통합 검토
   - 콘텐츠 조회 함수들 통합 검토

## 참고 문서
- `docs/프로젝트-최적화-리팩토링-가이드.md`
- `docs/테이블-조회-가이드.md`

