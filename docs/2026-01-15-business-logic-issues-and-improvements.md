# 비즈니스 로직 관련 문제점 분석 및 개선 방향

**작성일**: 2026-01-15  
**분석 범위**: `lib/domains/`, `lib/plan/`, `lib/metrics/`, `lib/coaching/`, `lib/recommendations/`  
**목적**: 비즈니스 로직의 구조적 문제점 파악 및 체계적 개선 방향 제시

---

## 📋 목차

1. [분석 개요](#1-분석-개요)
2. [아키텍처 문제점](#2-아키텍처-문제점)
3. [코드 품질 문제점](#3-코드-품질-문제점)
4. [의존성 관리 문제점](#4-의존성-관리-문제점)
5. [에러 처리 문제점](#5-에러-처리-문제점)
6. [타입 안전성 문제점](#6-타입-안전성-문제점)
7. [성능 및 확장성 문제점](#7-성능-및-확장성-문제점)
8. [개선 방향 및 로드맵](#8-개선-방향-및-로드맵)

---

## 1. 분석 개요

### 1.1 현재 비즈니스 로직 구조

```
lib/
├── domains/              # 도메인 기반 비즈니스 로직 (23개 도메인)
│   ├── plan/            # 플랜 도메인 (가장 복잡)
│   ├── camp/             # 캠프 도메인 (가장 큰 도메인)
│   ├── score/             # 성적 도메인
│   ├── attendance/        # 출석 도메인
│   └── ...
├── plan/                  # 플랜 생성 로직 (레거시)
├── metrics/               # 학습 지표 계산
├── coaching/              # 코칭 로직
└── recommendations/       # 추천 엔진
```

### 1.2 분석 방법

- **코드베이스 검색**: 주요 비즈니스 로직 파일 검토
- **기존 문서 분석**: 비즈니스 로직 관련 기존 문서 검토
- **패턴 분석**: 에러 처리, 의존성, 타입 안전성 패턴 분석
- **TODO/FIXME 검색**: 미완성 작업 및 기술 부채 파악

### 1.3 발견된 주요 문제 영역

1. **아키텍처 불일치**: 레이어 분리 불완전, 비즈니스 로직 혼재
2. **코드 중복**: 유사한 로직이 여러 위치에 분산
3. **의존성 관리**: 순환 의존성 가능성, 의존성 방향 불명확
4. **에러 처리 불일치**: 여러 패턴 혼재 (try-catch, throw, Result 타입)
5. **타입 안전성**: null 체크 부족, 타입 단언 과다 사용
6. **성능 이슈**: N+1 쿼리, 불필요한 재계산

---

## 2. 아키텍처 문제점

### 2.1 레이어 분리 불완전

#### 문제점

**현재 상태**: 일부 도메인만 완전한 레이어 분리 (repository, service, actions)

```
lib/domains/
├── school/          # ✅ 완전 구현 (repository, service, actions)
├── score/           # ✅ 완전 구현
├── attendance/      # ✅ 완전 구현
├── plan/            # 🔄 repository, service만 존재
│   ├── repository.ts
│   ├── service.ts
│   └── ❌ actions.ts 없음 (app/(student)/actions/planActions.ts에 분산)
└── ... (나머지는 index.ts만 존재)
```

**비즈니스 로직 혼재 문제**:

- `app/actions/planActions.ts`: 날짜/요일 검증 로직이 Actions에 직접 포함
- `lib/plan/blocks.ts`: 중복 확인, 개수 제한 등 비즈니스 규칙이 Actions에 포함
- `lib/plan/blockSets.ts`: 중복 이름 확인 등 비즈니스 로직 혼재

#### 영향

1. **개발자 혼란**: 어디서 함수를 찾아야 할지 불명확
2. **테스트 어려움**: 비즈니스 로직이 Actions에 있어 단위 테스트 어려움
3. **재사용성 저하**: 동일한 로직이 여러 위치에 분산

#### 개선 방향

```typescript
// ✅ 이상적인 구조
lib/domains/plan/
├── repository.ts    # 순수 데이터 접근
├── service.ts       # 비즈니스 로직 (검증, 계산, 변환)
├── actions.ts       # Server Actions (FormData 파싱 + Service 호출)
└── types.ts         # 타입 정의
```

**마이그레이션 계획**:
1. Phase 1: Actions에서 비즈니스 로직 추출 → Service로 이동
2. Phase 2: Repository 패턴 완전 적용
3. Phase 3: 타입 정의 통합

---

### 2.2 도메인 간 경계 불명확

#### 문제점

**크로스 도메인 로직 분산**:

```typescript
// lib/coaching/getWeeklyMetrics.ts
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getPlanCompletion } from "@/lib/metrics/getPlanCompletion";
import { getGoalStatus } from "@/lib/metrics/getGoalStatus";
// 여러 도메인의 함수를 직접 import
```

**의존성 방향 불명확**:

```typescript
// lib/plan/services/PlanGenerationOrchestrator.ts
import { getPlanGroupById, getPlanContents } from "@/lib/domains/plan/service";
// service를 import하지만 service도 다른 모듈에 의존
```

#### 영향

1. **순환 의존성 위험**: 모듈 간 강한 결합
2. **리팩토링 어려움**: 한 모듈 변경 시 다른 모듈 영향
3. **테스트 복잡도 증가**: 여러 도메인에 의존하는 함수 테스트 어려움

#### 개선 방향

**인터페이스 기반 의존성 주입**:

```typescript
// ✅ 인터페이스 정의
interface MetricsService {
  getPlanCompletion(...): Promise<PlanCompletionMetrics>;
  getWeakSubjects(...): Promise<WeakSubjectMetrics>;
}

// ✅ 의존성 주입
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  metricsService: MetricsService
) {
  // ...
}
```

---

### 2.3 레거시 코드와 신규 코드 혼재

#### 문제점

**이중 구조**:

```
lib/
├── plan/              # 레거시 플랜 생성 로직
│   ├── scheduler.ts
│   ├── 1730TimetableLogic.ts
│   └── ...
└── domains/plan/      # 신규 도메인 구조
    ├── repository.ts
    ├── service.ts
    └── services/       # 새로운 서비스 레이어
        ├── PlanGenerationOrchestrator.ts
        └── ...
```

**마이그레이션 미완료**:

- 일부 기능은 레거시 코드 사용
- 일부 기능은 신규 구조 사용
- 두 구조 간 데이터 변환 필요

#### 영향

1. **유지보수 복잡도**: 두 가지 패턴을 모두 이해해야 함
2. **버그 위험**: 레거시와 신규 코드 간 불일치 가능성
3. **성능 이슈**: 불필요한 데이터 변환

#### 개선 방향

**점진적 마이그레이션 전략**:

1. Phase 1: 레거시 코드에 @deprecated 주석 추가
2. Phase 2: 신규 기능은 신규 구조만 사용
3. Phase 3: 레거시 코드를 신규 구조로 점진적 마이그레이션
4. Phase 4: 레거시 코드 제거

---

## 3. 코드 품질 문제점

### 3.1 코드 중복

#### 문제점

**중복된 로직 예시**:

1. **시간 설정 병합 로직 중복**:
   - `app/(student)/actions/plan-groups/create.ts:45-68`
   - `app/(student)/actions/plan-groups/create.ts:334-338`
   - `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:117-119`

2. **블록 세트 조회 로직 중복**:
   - `lib/plan/blocks.ts:88-143`
   - `lib/utils/planGroupTransform.ts:115-127`
   - `app/(admin)/actions/campTemplateActions.ts:1406-1454`

3. **학습-복습 주기 병합 로직 중복**:
   - `app/(student)/actions/plan-groups/create.ts:70-74`
   - `app/(student)/actions/plan-groups/create.ts:340-344`
   - `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:103-106`

#### 영향

1. **버그 전파**: 한 곳 수정 시 다른 곳도 수정 필요
2. **일관성 저하**: 로직이 약간씩 다를 수 있음
3. **유지보수 비용 증가**: 동일한 로직을 여러 곳에서 관리

#### 개선 방향

**공통 유틸리티 함수 추출**:

```typescript
// ✅ 공통 함수로 추출
// lib/domains/plan/utils/timeSettings.ts
export function mergeTimeSettings(
  plannerSettings: TimeSettings | null,
  groupSettings: TimeSettings | null
): TimeSettings {
  // 병합 로직
}

// ✅ 공통 함수로 추출
// lib/plan/blocks.ts
export async function getTemplateBlockSet(
  supabase: SupabaseServerClient,
  tenantId: string
): Promise<BlockSet | null> {
  // 템플릿 블록 세트 조회 로직
}
```

---

### 3.2 함수 시그니처 불일치

#### 문제점

**파라미터 순서 불일치**:

```typescript
// 패턴 A: supabase가 첫 번째
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
);

// 패턴 B: supabase가 없음
export async function getPlanGroups(filters: PlanGroupFilters);

// 패턴 C: 옵션 객체 사용
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string
);
```

**옵션 객체 사용 여부 불일치**:

```typescript
// 단일 파라미터
export async function getWeakSubjects(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
);

// 옵션 객체 (더 나은 방식)
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  options?: { weekStart?: Date; weekEnd?: Date }
);
```

#### 영향

1. **학습 곡선 증가**: 각 함수의 시그니처를 외워야 함
2. **실수 가능성**: 파라미터 순서를 잘못 전달할 위험
3. **확장성 저하**: 새로운 파라미터 추가 시 시그니처 변경 필요

#### 개선 방향

**표준 함수 시그니처**:

```typescript
/**
 * [함수 설명]
 *
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 함수 옵션
 * @returns [반환 타입 설명]
 */
export async function functionName(
  supabase: SupabaseServerClient,
  options: FunctionOptions
): Promise<FunctionResult> {
  // 구현
}
```

---

### 3.3 하드코딩된 값

#### 문제점

**스케줄러 기본값 하드코딩**:

```typescript
// lib/scheduler/calculateAvailableDates.ts
const DEFAULT_STUDY_HOURS = { start: "10:00", end: "19:00" };
// 플래너에서 설정한 시간을 사용하지 않음
```

**TODO 주석으로 표시된 미완성 로직**:

```typescript
// lib/domains/plan/actions/content-calendar.ts:558
content_title: "", // TODO: 콘텐츠 제목 조인

// lib/domains/plan/actions/statistics.ts:263
trend: "stable" as const, // TODO: 시계열 분석

// lib/domains/plan/actions/timezone.ts:385
total_study_hours: studyDays * 8, // TODO: 블록셋 기반 계산
```

#### 영향

1. **유연성 저하**: 설정 변경 시 코드 수정 필요
2. **버그 위험**: 하드코딩된 값이 실제 설정과 불일치
3. **기술 부채**: TODO 주석이 누적되어 미완성 기능 증가

#### 개선 방향

**설정 기반 접근**:

```typescript
// ✅ 플래너 설정 활용
const studyHours = planGroup.study_hours ?? DEFAULT_STUDY_HOURS;
const lunchTime = planGroup.lunch_time ?? DEFAULT_LUNCH_TIME;
```

**TODO 정리**:

1. Phase 1: TODO 목록 정리 및 우선순위 설정
2. Phase 2: 즉시 해결 가능한 TODO 처리
3. Phase 3: 장기 계획 수립

---

## 4. 의존성 관리 문제점

### 4.1 Supabase 클라이언트 의존성 불일치

#### 문제점

**세 가지 패턴 혼재**:

```typescript
// 패턴 A: 클라이언트를 파라미터로 받음
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  ...
);

// 패턴 B: 내부에서 생성
export async function findPlanGroups(filters: PlanGroupFilters) {
  const supabase = await createSupabaseServerClient();
  // ...
}

// 패턴 C: 선택적으로 받음
protected async getSupabase(): Promise<SupabaseServerClient> {
  if (this.supabase) {
    return this.supabase;
  }
  return await createSupabaseServerClient();
}
```

#### 영향

1. **테스트 어려움**: 클라이언트를 주입할 수 없어 모킹이 어려움
2. **의존성 불명확**: 함수가 내부에서 클라이언트를 생성하는지 알기 어려움
3. **재사용성 저하**: 다른 클라이언트(Admin 등)를 사용해야 할 때 수정 필요

#### 개선 방향

**통일된 패턴: 파라미터로 받기**:

```typescript
// ✅ 모든 비즈니스 로직 함수가 클라이언트를 파라미터로 받도록 변경
export async function findPlanGroups(
  supabase: SupabaseServerClient,
  filters: PlanGroupFilters
): Promise<PlanGroup[]> {
  // ...
}
```

**마이그레이션 계획**:
1. Phase 1: 새로 작성하는 함수는 파라미터 패턴 사용
2. Phase 2: 기존 함수 점진적 마이그레이션
3. Phase 3: 내부 생성 패턴 완전 제거

---

### 4.2 순환 의존성 위험

#### 문제점

**의존성 방향 불명확**:

```typescript
// lib/coaching/getWeeklyMetrics.ts
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getPlanCompletion } from "@/lib/metrics/getPlanCompletion";
// 여러 메트릭 함수를 직접 import

// lib/plan/services/PlanGenerationOrchestrator.ts
import { getPlanGroupById, getPlanContents } from "@/lib/domains/plan/service";
// service를 import하지만 service도 다른 모듈에 의존
```

#### 영향

1. **빌드 시간 증가**: 순환 의존성으로 인한 빌드 지연
2. **모듈 결합도 증가**: 모듈 간 강한 결합
3. **리팩토링 어려움**: 한 모듈 변경 시 다른 모듈 영향

#### 개선 방향

**의존성 역전 원칙 적용**:

```typescript
// ✅ 인터페이스 정의
interface MetricsService {
  getPlanCompletion(...): Promise<PlanCompletionMetrics>;
  getWeakSubjects(...): Promise<WeakSubjectMetrics>;
}

// ✅ 의존성 주입
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string,
  metricsService: MetricsService
) {
  // ...
}
```

---

## 5. 에러 처리 문제점

### 5.1 에러 처리 패턴 불일치

#### 문제점

**세 가지 패턴 혼재**:

```typescript
// 패턴 A: try-catch로 빈 값 반환
export async function getPlanCompletion(...) {
  try {
    // ...
  } catch (error) {
    console.error("[metrics/getPlanCompletion] 플랜 실행률 조회 실패", error);
    return {
      totalPlans: 0,
      completedPlans: 0,
      completionRate: 0,
    };
  }
}

// 패턴 B: throw 사용
export async function findPlanGroups(...) {
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error; // 상위에서 처리
  return (data as PlanGroup[]) ?? [];
}

// 패턴 C: Result 타입 사용
async generate(...): Promise<ServiceResult<PlanGenerationOrchestratorOutput>> {
  return {
    success: false,
    error: "플랜 그룹을 찾을 수 없습니다",
    errorCode: ServiceErrorCodes.INVALID_INPUT,
  };
}
```

#### 영향

1. **에러 처리 복잡성**: 호출자가 각 함수의 에러 처리 방식을 알아야 함
2. **에러 정보 손실**: 빈 값 반환 시 원인 파악 어려움
3. **일관성 부족**: 같은 도메인 내에서도 패턴이 다름

#### 개선 방향

**통일된 에러 처리 패턴: Result 타입**:

```typescript
// ✅ 표준 Result 타입
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E; errorCode?: string };

// ✅ 모든 비즈니스 로직 함수가 Result 타입 반환
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  options: PlanCompletionOptions
): Promise<Result<PlanCompletionMetrics>> {
  try {
    // ...
    return { success: true, data: metrics };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode: "PLAN_COMPLETION_FETCH_FAILED",
    };
  }
}
```

---

### 5.2 에러 메시지 일관성 부족

#### 문제점

**에러 메시지 형식 불일치**:

```typescript
// 형식 A: 한국어 메시지
return { success: false, error: "학생 ID가 필요합니다." };

// 형식 B: 영어 메시지
return { success: false, error: "Student ID is required." };

// 형식 C: 에러 코드만
return { success: false, errorCode: "INVALID_INPUT" };
```

#### 영향

1. **사용자 경험 저하**: 일관성 없는 에러 메시지
2. **디버깅 어려움**: 에러 메시지 형식이 달라 파싱 어려움
3. **다국어 지원 어려움**: 하드코딩된 메시지

#### 개선 방향

**에러 코드 체계 구축**:

```typescript
// ✅ 에러 코드 정의
export enum BusinessErrorCode {
  INVALID_INPUT = "INVALID_INPUT",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  // ...
}

// ✅ 에러 메시지 맵
const ERROR_MESSAGES: Record<BusinessErrorCode, string> = {
  [BusinessErrorCode.INVALID_INPUT]: "입력값이 유효하지 않습니다.",
  [BusinessErrorCode.NOT_FOUND]: "요청한 리소스를 찾을 수 없습니다.",
  // ...
};

// ✅ 에러 생성 함수
export function createBusinessError(
  code: BusinessErrorCode,
  details?: Record<string, unknown>
): BusinessError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    details,
  };
}
```

---

## 6. 타입 안전성 문제점

### 6.1 null 체크 부족

#### 문제점

**null 가능성 무시**:

```typescript
// lib/metrics/getPlanCompletion.ts
const planRows = await safeQueryArray<PlanRow>(...);
// planRows가 null일 수 있지만 체크 없이 사용
const learningPlans = filterLearningPlans(planRows);
```

**타입 단언 과다 사용**:

```typescript
// lib/domains/plan/repository.ts
return (data as PlanGroup[]) ?? [];
// 타입 단언이 필요한 이유가 불명확
```

#### 영향

1. **런타임 에러**: null/undefined 접근 시 에러 발생
2. **타입 안전성 저하**: TypeScript의 이점을 활용하지 못함
3. **디버깅 어려움**: 타입 단언으로 인한 실제 타입 불일치 감지 어려움

#### 개선 방향

**명시적 null 체크**:

```typescript
// ✅ null 체크 포함
const planRows = await safeQueryArray<PlanRow>(...);
if (!planRows || planRows.length === 0) {
  return {
    success: true,
    data: {
      totalPlans: 0,
      completedPlans: 0,
      completionRate: 0,
    },
  };
}
const learningPlans = filterLearningPlans(planRows);
```

**타입 가드 함수 사용**:

```typescript
// ✅ 타입 가드 함수
function isPlanGroupArray(data: unknown): data is PlanGroup[] {
  return Array.isArray(data) && data.every(isPlanGroup);
}

// ✅ 타입 가드 사용
if (isPlanGroupArray(data)) {
  return data;
}
```

---

### 6.2 any 타입 사용

#### 문제점

**any 타입 사용 가능성**:

```typescript
// lib/coaching/engine.ts
export function coachingEngine(metrics: WeeklyMetricsData): WeeklyCoaching {
  // metrics의 필드가 null일 수 있지만 체크 없이 사용
  if (metrics.weeklyStudyTrend >= 20) {
    // ...
  }
}
```

**타입 정의 부족**:

```typescript
// user_metadata가 Record<string, any>로 되어 타입 안전성이 낮음
const signupRole = user.user_metadata?.signup_role as "student" | "parent" | null | undefined;
```

#### 영향

1. **타입 안전성 저하**: 런타임 에러 가능성 증가
2. **IDE 지원 저하**: 자동완성, 타입 체크 불가
3. **리팩토링 어려움**: 타입 정보 부족으로 변경 영향 파악 어려움

#### 개선 방향

**명시적 타입 정의**:

```typescript
// ✅ 타입 정의
interface UserMetadata {
  signup_role?: "student" | "parent" | "admin" | "consultant";
  tenant_id?: string;
  // ...
}

// ✅ 타입 가드 함수
function isValidUserMetadata(data: unknown): data is UserMetadata {
  return (
    typeof data === "object" &&
    data !== null &&
    ("signup_role" in data || "tenant_id" in data)
  );
}

// ✅ 타입 안전한 접근
if (isValidUserMetadata(user.user_metadata)) {
  const signupRole = user.user_metadata.signup_role;
  // ...
}
```

---

## 7. 성능 및 확장성 문제점

### 7.1 N+1 쿼리 문제

#### 문제점

**반복문 내 쿼리 실행**:

```typescript
// 의심되는 패턴 (실제 코드 확인 필요)
const planGroups = await getPlanGroups(filters);
for (const group of planGroups) {
  const contents = await getPlanContents(group.id); // N+1 쿼리
  // ...
}
```

#### 영향

1. **성능 저하**: 데이터베이스 쿼리 수 증가
2. **응답 시간 증가**: 대량 데이터 처리 시 느려짐
3. **데이터베이스 부하**: 불필요한 쿼리로 인한 부하 증가

#### 개선 방향

**배치 쿼리 사용**:

```typescript
// ✅ 배치 쿼리
const planGroups = await getPlanGroups(filters);
const groupIds = planGroups.map((g) => g.id);
const allContents = await getPlanContentsBatch(groupIds);

// 그룹별로 매핑
const contentsMap = new Map(
  allContents.map((c) => [c.plan_group_id, c])
);

for (const group of planGroups) {
  const contents = contentsMap.get(group.id) ?? [];
  // ...
}
```

---

### 7.2 불필요한 재계산

#### 문제점

**캐싱 부족**:

```typescript
// 매번 재계산
export async function getWeeklyMetrics(...) {
  const studyTime = await getStudyTime(...);
  const planCompletion = await getPlanCompletion(...);
  const weakSubjects = await getWeakSubjects(...);
  // 매번 모든 메트릭을 계산
}
```

#### 영향

1. **성능 저하**: 동일한 데이터를 반복 계산
2. **데이터베이스 부하**: 불필요한 쿼리 실행
3. **응답 시간 증가**: 사용자 대기 시간 증가

#### 개선 방향

**캐싱 전략 적용**:

```typescript
// ✅ React Query 캐싱 활용
const { data: studyTime } = useQuery({
  queryKey: ["studyTime", studentId, weekStart, weekEnd],
  queryFn: () => getStudyTime(supabase, { studentId, weekStart, weekEnd }),
  staleTime: 5 * 60 * 1000, // 5분
});

// ✅ 서버 사이드 캐싱
import { unstable_cache } from "next/cache";

export const getCachedWeeklyMetrics = unstable_cache(
  async (studentId: string, weekStart: Date, weekEnd: Date) => {
    return await getWeeklyMetrics(supabase, { studentId, weekStart, weekEnd });
  },
  ["weekly-metrics"],
  { revalidate: 300 } // 5분
);
```

---

## 8. 개선 방향 및 로드맵

### 8.1 우선순위별 개선 계획

#### 🔴 높은 우선순위 (즉시 시작)

1. **에러 처리 패턴 통일** (예상 소요: 2-3일)
   - Result 타입 표준화
   - 에러 코드 체계 구축
   - 기존 함수 점진적 마이그레이션

2. **Supabase 클라이언트 의존성 통일** (예상 소요: 2-3일)
   - 모든 함수가 클라이언트를 파라미터로 받도록 변경
   - 내부 생성 패턴 제거

3. **타입 안전성 강화** (예상 소요: 1-2일)
   - null 체크 추가
   - 타입 가드 함수 작성
   - any 타입 제거

#### 🟡 중간 우선순위 (1-2주 내)

4. **코드 중복 제거** (예상 소요: 2-3일)
   - 공통 유틸리티 함수 추출
   - 중복 로직 통합

5. **함수 시그니처 표준화** (예상 소요: 1-2일)
   - 옵션 객체 패턴 채택
   - 파라미터 순서 표준화

6. **레이어 분리 완성** (예상 소요: 3-5일)
   - Actions에서 비즈니스 로직 추출
   - Service 레이어 완성
   - Repository 패턴 완전 적용

#### 🟢 낮은 우선순위 (1-2개월 내)

7. **의존성 관리 개선** (예상 소요: 3-5일)
   - 인터페이스 기반 의존성 주입
   - 순환 의존성 제거

8. **성능 최적화** (예상 소요: 3-5일)
   - N+1 쿼리 해결
   - 캐싱 전략 적용

9. **문서화 개선** (예상 소요: 2-3일)
   - JSDoc 추가
   - 사용 예시 포함

---

### 8.2 단계별 마이그레이션 전략

#### Phase 1: 기반 구축 (1주)

1. **표준 패턴 정의**
   - Result 타입 표준화
   - 에러 코드 체계 구축
   - 함수 시그니처 표준 정의

2. **공통 유틸리티 작성**
   - 에러 처리 헬퍼 함수
   - 타입 가드 함수
   - 공통 유틸리티 함수

#### Phase 2: 점진적 마이그레이션 (2-3주)

1. **우선순위 높은 도메인부터**
   - plan 도메인 (가장 복잡)
   - metrics 모듈 (이미 일부 개선됨)
   - coaching 모듈

2. **기존 코드와 병행 운영**
   - 레거시 코드에 @deprecated 주석
   - 신규 기능은 신규 구조만 사용
   - 점진적 마이그레이션

#### Phase 3: 통합 및 정리 (1-2주)

1. **레거시 코드 제거**
   - 사용되지 않는 레거시 코드 제거
   - 중복 코드 통합

2. **문서화 및 테스트**
   - 마이그레이션 가이드 작성
   - 단위 테스트 작성
   - 통합 테스트 작성

---

### 8.3 표준 패턴 정의

#### 함수 시그니처 표준

```typescript
/**
 * [함수 설명]
 *
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 함수 옵션
 * @returns [반환 타입 설명]
 *
 * @example
 * ```typescript
 * const result = await functionName(supabase, { ... });
 * if (!result.success) {
 *   console.error(result.error);
 *   return;
 * }
 * console.log(result.data);
 * ```
 */
export async function functionName(
  supabase: SupabaseServerClient,
  options: FunctionOptions
): Promise<Result<FunctionResult, BusinessError>> {
  // 구현
}
```

#### 에러 처리 표준

```typescript
// ✅ 표준 Result 타입
export type Result<T, E = BusinessError> =
  | { success: true; data: T }
  | { success: false; error: E; errorCode?: BusinessErrorCode };

// ✅ 에러 생성 함수
export function createBusinessError(
  code: BusinessErrorCode,
  message?: string,
  details?: Record<string, unknown>
): BusinessError {
  return {
    code,
    message: message ?? ERROR_MESSAGES[code],
    details,
  };
}

// ✅ 에러 처리 패턴
export async function functionName(...): Promise<Result<ReturnType>> {
  try {
    // ...
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: createBusinessError(
        BusinessErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : String(error)
      ),
    };
  }
}
```

---

### 8.4 성공 지표

#### 정량적 지표

1. **코드 중복률**: 현재 → 목표 (50% 감소)
2. **타입 안전성**: any 타입 사용률 (현재 → 목표: 0%)
3. **에러 처리 일관성**: 표준 패턴 사용률 (현재 → 목표: 100%)
4. **테스트 커버리지**: 현재 → 목표 (80% 이상)

#### 정성적 지표

1. **개발자 만족도**: 코드 가독성, 유지보수성 향상
2. **버그 감소**: 타입 안전성 강화로 인한 런타임 에러 감소
3. **개발 속도**: 표준 패턴으로 인한 개발 속도 향상

---

## 9. 참고 문서

- [비즈니스 로직 사용성 문제점 분석](./business-logic-usability-issues.md)
- [비즈니스 로직 분리 가이드](./business-logic-separation.md)
- [플래너, 플랜그룹, 플랜 비즈니스 로직 분석](./2026-01-06-business-logic-analysis-and-improvements.md)
- [아키텍처 감사 보고서](./architecture/phase9-architecture-audit-report.md)

---

**마지막 업데이트**: 2026-01-15

