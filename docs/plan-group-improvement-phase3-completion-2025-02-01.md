# 플랜 그룹 개선 Phase 3 완료 보고서

작업 일자: 2025-02-01

## 개요

플랜 그룹 관련 코드의 타입 안전성, 로깅, 에러 처리 일관성, fallback 로직 개선 및 통합 테스트 구현을 위한 추가 개선 작업을 완료했습니다.

## 완료된 작업

### 1. 타입 안전성 개선 (Medium 우선순위)

#### 1.1 planGroupDataSync.ts 타입 안전성 개선

**파일**: `lib/utils/planGroupDataSync.ts`

**개선 내용**:
- `PlanPurpose`, `SchedulerType`, `PlanContentInput`, `ExclusionType` 타입 import 및 적용
- Line 114-115: `plan_purpose`, `scheduler_type`에 `as any` 제거
- Line 123-164: `contentItem: any` 및 다수의 `as any` 제거 (약 15곳)
- 타입 변환 로직 추가 (빈 문자열 → null, "모의고사(수능)" → "모의고사")

**주요 변경사항**:
```typescript
// Before
plan_purpose: wizardData.plan_purpose as any,
scheduler_type: wizardData.scheduler_type as any,
const contentItem: any = { ... };

// After
const normalizedPlanPurpose: PlanPurpose | null =
  !wizardData.plan_purpose || wizardData.plan_purpose === ""
    ? null
    : wizardData.plan_purpose === "모의고사(수능)"
      ? "모의고사"
      : (wizardData.plan_purpose as PlanPurpose);

const contentItem: PlanContentInput & { ... } = { ... };
```

#### 1.2 planGroupTransform.ts 타입 개선

**파일**: `lib/utils/planGroupTransform.ts`

**개선 내용**:
- Line 19: `scheduler_options?: any` → `scheduler_options?: SchedulerOptions`
- Line 333-336: `as any` 사용 제거 및 명시적 타입 적용

#### 1.3 update.ts 타입 개선

**파일**: `app/(student)/actions/plan-groups/update.ts`

**개선 내용**:
- Line 304: `scheduler_options?: any | null` → `scheduler_options?: SchedulerOptions | null`
- Line 325: `group.status as any` → `group.status as PlanStatus`
- Line 62: `group.status as any` → `group.status as PlanStatus`
- `template_block_set_id` 보호 로직 타입 개선

### 2. 로깅 개선 (Medium 우선순위)

#### 2.1 planGroups.ts 로깅 개선

**파일**: `lib/data/planGroups.ts`

**개선 내용**:
- 약 68개의 `console.log`, `console.warn`, `console.error` 호출을 `logError`로 교체
- 개발 환경에서만 정보성 로그 출력 (`process.env.NODE_ENV === "development"`)
- 로그 레벨 구분 (error, warn, info)
- 컨텍스트 정보 구조화

**주요 변경사항**:
```typescript
// Before
console.error("[data/planGroups] 플랜 그룹 조회 실패", error);
console.warn("[data/planGroups] 컬럼 에러 발생, fallback 쿼리 사용", {...});
console.log("[getPlanContents] 조회 시작:", {...});

// After
logError(error, {
  function: "getPlanGroupById",
  groupId,
  studentId,
  tenantId,
});

if (process.env.NODE_ENV === "development") {
  logError(new Error("컬럼 에러 발생, fallback 쿼리 사용"), {
    function: "getPlanGroupById",
    level: "warn",
    groupId,
    studentId,
    tenantId,
  });
}

if (process.env.NODE_ENV === "development") {
  logError(new Error("플랜 콘텐츠 조회 시작"), {
    function: "getPlanContents",
    level: "info",
    groupId,
    tenantId,
  });
}
```

**개선된 함수**:
- `getPlanGroupsForStudent`
- `getPlanGroupById`
- `createPlanGroup`
- `updatePlanGroup`
- `deletePlanGroup`
- `deletePlanGroupByInvitationId`
- `deletePlanGroupsByTemplateId`
- `getPlanContents`
- `createPlanContents`
- `getPlanExclusions`
- `getStudentExclusions`
- `createPlanExclusions`
- `createStudentExclusions`
- `getAcademySchedules`
- `getStudentAcademySchedules`
- `createPlanAcademySchedules`
- `createStudentAcademySchedules`
- `getPlanGroupByIdForAdmin`
- `getPlanGroupWithDetails`
- `getPlanGroupWithDetailsForAdmin`

### 3. Fallback 로직 개선 (Low 우선순위)

#### 3.1 마이그레이션 상태 확인 유틸리티 생성

**파일**: `lib/utils/migrationStatus.ts` (신규 생성)

**주요 기능**:
- 데이터베이스 컬럼 존재 여부 확인
- 마이그레이션 상태 캐싱 (TTL: 5분)
- 불필요한 재시도 방지

**주요 함수**:
- `checkColumnExists(tableName, columnName)`: 단일 컬럼 존재 여부 확인
- `checkColumnsExist(tableName, columnNames)`: 여러 컬럼 존재 여부 확인
- `clearMigrationStatusCache()`: 캐시 초기화 (테스트용)

#### 3.2 planGroups.ts Fallback 로직 개선

**파일**: `lib/data/planGroups.ts`

**개선 내용**:
- `getPlanGroupById`: 마이그레이션 상태 확인 추가 (캐싱 활용)
- `getPlanGroupsForStudent`: 마이그레이션 상태 확인 추가
- 불필요한 재시도 방지
- 구조화된 로깅 사용

**주요 변경사항**:
```typescript
// Before
if (error && error.code === "42703") {
  // fallback 쿼리 직접 실행
  const fallbackQuery = supabase.from("plan_groups")...
}

// After
if (error && error.code === "42703") {
  // 마이그레이션 상태 확인 (캐시 사용)
  const hasSchedulerOptions = await checkColumnExists(
    "plan_groups",
    "scheduler_options"
  );

  if (!hasSchedulerOptions) {
    // fallback 쿼리 실행
    const fallbackQuery = supabase.from("plan_groups")...
  }
}
```

### 4. 에러 처리 일관성 개선 (Low 우선순위)

#### 4.1 에러 처리 가이드라인 작성

**파일**: `docs/error-handling-guidelines.md` (신규 생성)

**내용**:
- 에러 타입 선택 가이드 (PlanGroupError vs AppError)
- 에러 로깅 규칙
- 사용자 친화적 메시지 작성 가이드
- 에러 컨텍스트 포함 규칙
- 마이그레이션 가이드

**에러 처리 규칙**:
- 플랜 그룹 도메인: `PlanGroupError` 사용
- 일반 애플리케이션 에러: `AppError` 사용
- 외부 라이브러리 에러: `normalizeError`로 변환

### 5. 통합 테스트 구현 (Low 우선순위)

#### 5.1 통합 테스트 설정 가이드 작성

**파일**: `docs/integration-test-setup.md` (신규 생성)

**내용**:
- 테스트용 Supabase 프로젝트 설정 방법
- 환경 변수 설정 가이드
- 데이터베이스 마이그레이션 실행 방법
- CI/CD 통합 방법

#### 5.2 테스트 헬퍼 함수 구현

**파일**: `__tests__/helpers/supabase.ts` (신규 생성)

**주요 함수**:
- `createTestSupabaseClient()`: 테스트용 Supabase 클라이언트 생성
- `cleanupTestData()`: 테스트 데이터 정리
- `createTestTenant()`: 테스트용 테넌트 생성
- `createTestStudent()`: 테스트용 학생 생성
- `createTestBlockSet()`: 테스트용 블록 세트 생성

#### 5.3 통합 테스트 파일 개선

**파일**: `__tests__/integration/planGroupTimeBlock.test.ts`

**개선 내용**:
- 헬퍼 함수 import 추가
- 테스트 구조 개선
- 주석으로 실제 구현 예시 제공

## 통계

### 타입 안전성 개선
- `as any` 제거: 약 20곳
- 명시적 타입 적용: 5개 파일

### 로깅 개선
- `console.*` 호출 교체: 68개
- 구조화된 로깅 적용: 100%
- 개발 환경 구분: 적용 완료

### Fallback 로직 개선
- 마이그레이션 상태 확인 유틸리티: 1개 파일 생성
- Fallback 로직 개선: 2개 함수
- 캐싱 추가: TTL 5분

### 문서화
- 가이드라인 문서: 2개 생성
- 테스트 헬퍼: 1개 파일 생성

## 파일 변경 사항

### 수정된 파일
1. `lib/utils/planGroupDataSync.ts` - 타입 안전성 개선
2. `lib/utils/planGroupTransform.ts` - 타입 개선
3. `app/(student)/actions/plan-groups/update.ts` - 타입 개선
4. `lib/data/planGroups.ts` - 로깅 개선, fallback 로직 개선
5. `__tests__/integration/planGroupTimeBlock.test.ts` - 헬퍼 함수 적용

### 신규 생성 파일
1. `lib/utils/migrationStatus.ts` - 마이그레이션 상태 확인 유틸리티
2. `docs/error-handling-guidelines.md` - 에러 처리 가이드라인
3. `docs/integration-test-setup.md` - 통합 테스트 설정 가이드
4. `__tests__/helpers/supabase.ts` - 통합 테스트 헬퍼 함수

## 향후 개선 사항

### 추가 고려사항

1. **쿼리 문자열 상수화**
   - `planGroups.ts`에 긴 쿼리 문자열이 여러 곳에 중복
   - 쿼리 문자열을 상수로 추출 (`lib/data/planGroupsQueries.ts`)

2. **타입 정의 통합**
   - `PlanGroupCreationData`, `PartialWizardData` 등 유사한 타입이 여러 곳에 정의
   - 타입 정의 통합 검토

3. **테스트 커버리지 향상**
   - 통합 테스트는 구조만 작성됨
   - 테스트 커버리지 목표 설정 (예: 80% 이상)
   - 실제 Supabase 연결 테스트 구현

## 참고 파일

- [lib/utils/planGroupDataSync.ts](lib/utils/planGroupDataSync.ts)
- [lib/data/planGroups.ts](lib/data/planGroups.ts)
- [lib/utils/planGroupTransform.ts](lib/utils/planGroupTransform.ts)
- [app/(student)/actions/plan-groups/update.ts](app/(student)/actions/plan-groups/update.ts)
- [lib/utils/migrationStatus.ts](lib/utils/migrationStatus.ts)
- [docs/error-handling-guidelines.md](docs/error-handling-guidelines.md)
- [docs/integration-test-setup.md](docs/integration-test-setup.md)
- [__tests__/helpers/supabase.ts](__tests__/helpers/supabase.ts)

