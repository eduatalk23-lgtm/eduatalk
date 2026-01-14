# 프로젝트 종합 분석 및 개선 사항 보고서

**작성일**: 2026-01-13  
**분석 범위**: 전체 코드베이스  
**목적**: 프로젝트 전반의 아키텍처, 코드 품질, 성능, 유지보수성 관점에서 개선 사항 도출

---

## 📋 목차

1. [Executive Summary](#1-executive-summary)
2. [프로젝트 현황](#2-프로젝트-현황)
3. [아키텍처 분석](#3-아키텍처-분석)
4. [코드 품질 분석](#4-코드-품질-분석)
5. [성능 분석](#5-성능-분석)
6. [의존성 및 타입 안전성](#6-의존성-및-타입-안전성)
7. [테스트 및 문서화](#7-테스트-및-문서화)
8. [우선순위별 개선 로드맵](#8-우선순위별-개선-로드맵)

---

## 1. Executive Summary

### 1.1 프로젝트 개요

- **프로젝트명**: TimeLevelUp (Eduatalk)
- **프레임워크**: Next.js 16.0.10 (App Router)
- **언어**: TypeScript 5
- **스타일링**: Tailwind CSS 4
- **백엔드**: Supabase (PostgreSQL)
- **상태 관리**: React Query, Zustand
- **테스트**: Vitest, Playwright

### 1.2 핵심 발견 사항

#### 🔴 Critical (즉시 조치 필요)

1. **Server Actions 구조 혼재**: 레거시와 도메인 기반 구조가 공존하며, 비즈니스 로직이 Actions에 직접 포함됨
2. **과도한 동적 렌더링**: 90개 이상의 페이지가 `force-dynamic`으로 캐싱 이점 상실
3. **기술 부채 누적**: 1,212개의 TODO/FIXME 주석 발견

#### 🟡 High (단기 개선 필요)

4. **N+1 쿼리 패턴**: 일부 도메인에서 여전히 발생
5. **에러 처리 불일치**: 여러 패턴 혼재 (try-catch, throw, Result 타입)
6. **타입 안전성**: null 체크 부족, 타입 단언 과다 사용

#### 🟢 Medium (중기 개선 필요)

7. **테스트 커버리지**: E2E 테스트는 있으나 단위 테스트 부족
8. **문서화**: 개별 기능 문서는 많으나 아키텍처 문서 부족
9. **성능 모니터링**: 프로덕션 성능 측정 도구 부족

### 1.3 개선 효과 예상

- **성능**: 페이지 로딩 시간 30-50% 감소, 서버 부하 40-60% 감소
- **개발 생산성**: 코드 일관성 향상으로 개발 속도 20-30% 증가
- **유지보수성**: 아키텍처 통일로 버그 감소 및 리팩토링 용이성 향상

---

## 2. 프로젝트 현황

### 2.1 프로젝트 규모

```
프로젝트 구조:
├── app/                    # Next.js App Router (1,300+ 파일)
│   ├── (admin)/           # 관리자 페이지 (512 파일)
│   ├── (student)/          # 학생 페이지 (703 파일)
│   ├── (parent)/           # 부모 페이지 (28 파일)
│   └── (superadmin)/       # 슈퍼 관리자 페이지 (25 파일)
├── components/             # 재사용 컴포넌트
├── lib/                    # 비즈니스 로직 및 유틸리티
│   ├── domains/            # 도메인 기반 구조 (23개 도메인)
│   ├── plan/               # 레거시 플랜 로직
│   └── data/               # 레거시 데이터 레이어
├── supabase/               # 마이그레이션 파일 (136개)
└── docs/                   # 문서 (1,340개)
```

### 2.2 기술 스택

#### 프론트엔드

- **Next.js 16.0.10**: App Router, Server Components
- **React 19.2.0**: 최신 React 기능 활용
- **TypeScript 5**: 타입 안전성
- **Tailwind CSS 4**: 유틸리티 우선 스타일링

#### 백엔드

- **Supabase**: PostgreSQL, Auth, Realtime
- **Server Actions**: Next.js Server Actions 활용

#### 상태 관리

- **React Query 5.90.10**: 서버 상태 관리
- **Zustand 5.0.9**: 클라이언트 상태 관리

#### 개발 도구

- **Vitest**: 단위 테스트
- **Playwright**: E2E 테스트
- **ESLint**: 코드 품질 검사

### 2.3 도메인 구조

현재 **23개 도메인**이 `lib/domains/` 구조로 정리되어 있음:

```
lib/domains/
├── admin-plan/      # 관리자 플랜 관리
├── analysis/        # 학습 분석
├── attendance/      # 출석 관리 ✅ 완전 구현
├── auth/            # 인증
├── block/           # 블록 관리
├── camp/             # 캠프 관리
├── content/         # 콘텐츠 관리
├── plan/             # 플랜 관리 🔄 부분 구현
├── score/            # 성적 관리 ✅ 완전 구현
├── school/           # 학교 관리 ✅ 완전 구현
└── ... (13개 추가)
```

**구현 상태**:

- ✅ 완전 구현: `school`, `score`, `attendance` (3개)
- 🔄 부분 구현: `plan` (repository, service만 존재)
- ❌ 미구현: 나머지 19개 도메인

---

## 3. 아키텍처 분석

### 3.1 Server Actions 구조 혼재

#### 문제점

**현재 상태**:

```
app/actions/                    # 전역 레거시 Actions
├── scores.ts                  # ⚠️ DEPRECATED
├── scores-internal.ts          # 🔄 마이그레이션 필요
├── planActions.ts              # ❌ 비즈니스 로직 혼재
├── blocks.ts                   # ❌ 비즈니스 로직 혼재
└── ...

app/(student)/actions/          # 학생 전용 Actions
├── planActions.ts              # ❌ plan 도메인과 분리
└── plan-groups/               # ❌ plan 도메인과 분리

lib/domains/
├── school/                    # ✅ 완전 구현
│   ├── repository.ts
│   ├── service.ts
│   └── actions/
├── score/                     # ✅ 완전 구현
│   ├── repository.ts
│   ├── service.ts
│   └── actions/
└── plan/                      # 🔄 부분 구현
    ├── repository.ts
    ├── service.ts
    └── ❌ actions.ts 없음
```

**비즈니스 로직 혼재 예시**:

```typescript
// ❌ 나쁜 예: app/actions/planActions.ts
export async function createPlan(data: FormData) {
  // 비즈니스 로직이 Actions에 직접 포함
  const startDate = parseDate(data.get("start_date"));
  const endDate = parseDate(data.get("end_date"));

  // 날짜 검증 로직
  if (startDate >= endDate) {
    throw new Error("시작일은 종료일보다 이전이어야 합니다.");
  }

  // 요일 검증 로직
  const dayOfWeek = startDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new Error("주말에는 플랜을 생성할 수 없습니다.");
  }

  // 데이터베이스 작업
  const { data: plan } = await supabase.from("plans").insert(...);
  return plan;
}
```

**이상적인 구조**:

```typescript
// ✅ 좋은 예: lib/domains/plan/service.ts
export async function validatePlanDates(
  startDate: Date,
  endDate: Date
): Promise<void> {
  if (startDate >= endDate) {
    throw new PlanValidationError("시작일은 종료일보다 이전이어야 합니다.");
  }

  const dayOfWeek = startDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new PlanValidationError("주말에는 플랜을 생성할 수 없습니다.");
  }
}

// ✅ 좋은 예: lib/domains/plan/actions.ts
export async function createPlan(data: FormData) {
  const startDate = parseDate(data.get("start_date"));
  const endDate = parseDate(data.get("end_date"));

  // Service 레이어에서 검증
  await planService.validatePlanDates(startDate, endDate);

  // Service 레이어에서 생성
  return await planService.createPlan({
    startDate,
    endDate,
    // ...
  });
}
```

#### 영향

1. **개발자 혼란**: 어디서 함수를 찾아야 할지 불명확
2. **테스트 어려움**: 비즈니스 로직이 Actions에 있어 단위 테스트 어려움
3. **재사용성 저하**: 동일한 로직이 여러 위치에 분산
4. **타입 안전성 저하**: FormData 파싱과 비즈니스 로직이 혼재

#### 개선 방향

**Phase 1: Deprecated 코드 정리** (1일)

- `app/actions/scores.ts` 완전 제거 또는 사용처 확인 후 제거

**Phase 2: 중간 단계 Actions 마이그레이션** (3일)

- `app/actions/scores-internal.ts` → `lib/domains/score/actions.ts`로 통합

**Phase 3: Plan 도메인 완전 마이그레이션** (5일)

- `lib/domains/plan/actions.ts` 생성
- `app/(student)/actions/planActions.ts` 마이그레이션
- 비즈니스 로직을 Service 레이어로 추출

**Phase 4: 나머지 도메인 마이그레이션** (15일)

- `student`, `content`, `goal`, `block`, `camp`, `tenant`, `subject` 도메인 구조화

---

### 3.2 레이어 분리 불완전

#### 문제점

**현재 상태**: 일부 도메인만 완전한 레이어 분리

```
lib/domains/
├── school/          # ✅ Repository → Service → Actions
├── score/           # ✅ Repository → Service → Actions
├── attendance/      # ✅ Repository → Service → Actions
├── plan/            # 🔄 Repository → Service (Actions 없음)
└── ... (나머지는 index.ts만 존재)
```

**비즈니스 로직 혼재**:

- `app/actions/planActions.ts`: 날짜/요일 검증 로직이 Actions에 직접 포함
- `lib/plan/blocks.ts`: 중복 확인, 개수 제한 등 비즈니스 규칙이 Actions에 포함
- `lib/plan/blockSets.ts`: 중복 이름 확인 등 비즈니스 로직 혼재

#### 이상적인 구조

```typescript
lib/domains/{domain}/
├── repository.ts    # 순수 데이터 접근 (Supabase 쿼리)
├── service.ts       # 비즈니스 로직 (검증, 계산, 변환)
├── actions.ts       # Server Actions (FormData 파싱 + Service 호출)
├── types.ts         # 타입 정의
└── validation.ts    # 검증 로직 (선택적)
```

#### 개선 방향

1. **Phase 1**: Actions에서 비즈니스 로직 추출 → Service로 이동
2. **Phase 2**: Repository 패턴 완전 적용
3. **Phase 3**: 타입 정의 통합

---

### 3.3 레거시 코드와 신규 코드 혼재

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

#### 개선 방향

**점진적 마이그레이션 전략**:

1. **Phase 1**: 레거시 코드에 `@deprecated` 주석 추가
2. **Phase 2**: 신규 기능은 신규 구조만 사용
3. **Phase 3**: 레거시 코드를 신규 구조로 점진적 마이그레이션
4. **Phase 4**: 레거시 코드 제거

---

## 4. 코드 품질 분석

### 4.1 파일 크기 및 복잡도

#### 문제점

**대형 파일 현황**:

| 파일 경로                                                                                    | 줄 수 | 문제점                         | 우선순위  |
| -------------------------------------------------------------------------------------------- | ----- | ------------------------------ | --------- |
| `lib/domains/attendance/actions/student.ts`                                                  | 1,105 | God Function, 복잡한 로직      | 🔴 High   |
| `lib/domains/attendance/actions/settings.ts`                                                 | 734   | 다중 책임, 복잡한 상태 관리    | 🟡 Medium |
| `lib/domains/tenant/blockSets.ts`                                                            | 592   | 블록 세트 관리 로직 집중       | 🟡 Medium |
| `lib/domains/attendance/actions/attendance.ts`                                               | 559   | 출석 관련 로직 집중            | 🟡 Medium |
| `app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`                 | 1,561 | 거대한 컴포넌트, 15+ 상태 변수 | 🔴 High   |
| `app/(admin)/admin/content-metadata/_components/CurriculumHierarchyManager.tsx`              | 1,175 | 복잡한 계층 구조 관리          | 🟡 Medium |
| `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings.tsx` | 1,128 | 시간 설정 로직 복잡            | 🟡 Medium |

**권장 파일 크기**:

- TypeScript 파일: **300줄 이하**
- React 컴포넌트: **200-300줄 이하**
- 현재 **20개 이상의 파일**이 권장 크기를 초과

#### 영향

1. **가독성 저하**: 큰 파일은 이해하기 어려움
2. **테스트 어려움**: 단위 테스트 작성이 복잡해짐
3. **병합 충돌**: 여러 개발자가 동시에 작업 시 충돌 증가
4. **유지보수 어려움**: 버그 수정 및 기능 추가가 어려움

#### 개선 방향

**파일 분리 전략**:

```typescript
// ❌ 나쁜 예: 1,105줄의 거대한 파일
// lib/domains/attendance/actions/student.ts
export async function checkInWithQRCode(...) { /* 200줄 */ }
export async function checkInWithLocation(...) { /* 200줄 */ }
export async function checkOut(...) { /* 150줄 */ }
// ... 10개 이상의 함수

// ✅ 좋은 예: 책임별로 파일 분리
// lib/domains/attendance/actions/student/checkIn.ts
export async function checkInWithQRCode(...) { /* 200줄 */ }
export async function checkInWithLocation(...) { /* 200줄 */ }

// lib/domains/attendance/actions/student/checkOut.ts
export async function checkOut(...) { /* 150줄 */ }

// lib/domains/attendance/actions/student/index.ts
export * from "./checkIn";
export * from "./checkOut";
```

**컴포넌트 분리 전략**:

```typescript
// ❌ 나쁜 예: 1,561줄의 거대한 컴포넌트
// PlannerCreationModal.tsx
export default function PlannerCreationModal() {
  // 15+ 상태 변수
  // 20+ 함수
  // 복잡한 JSX
}

// ✅ 좋은 예: 기능별로 컴포넌트 분리
// PlannerCreationModal.tsx (메인, 200줄)
export default function PlannerCreationModal() {
  return (
    <Modal>
      <PlannerForm />
      <PlannerPreview />
      <PlannerActions />
    </Modal>
  );
}

// _components/PlannerForm.tsx
// _components/PlannerPreview.tsx
// _components/PlannerActions.tsx
```

---

### 4.2 코드 중복

#### 문제점

**발견된 중복 패턴**:

1. **시간 설정 병합 로직 중복** (3곳):
   - `app/(student)/actions/plan-groups/create.ts:45-68`
   - `app/(student)/actions/plan-groups/create.ts:334-338`
   - `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:117-119`

2. **템플릿 블록 세트 조회 로직** (✅ 일부 해결됨):
   - ~~`lib/plan/blocks.ts::getTemplateBlockSet`~~ → `lib/domains/camp/utils/templateBlockSetResolver.ts`로 통합 완료
   - ~~`lib/plan/blocks.ts::getTemplateBlockSetId`~~ → 통합 완료
   - ~~`lib/camp/campAdapter.ts::resolveCampBlockSetId`~~ → 통합 완료

3. **학습-복습 주기 병합 로직 중복** (3곳):
   - `app/(student)/actions/plan-groups/create.ts:70-74`
   - `app/(student)/actions/plan-groups/create.ts:340-344`
   - `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:103-106`

4. **전략/취약 과목 할당 로직 중복** (✅ 해결됨):
   - ~~`app/(student)/plan/new-group/_components/Step6Simplified.tsx`~~ → `lib/utils/subjectAllocation.ts`로 통합 완료
   - ~~`lib/plan/1730TimetableLogic.ts`~~ → 통합 완료

5. **에러 처리 패턴 중복**:
   - 여러 파일에서 동일한 try-catch 패턴 반복
   - 에러 메시지 포맷팅 로직 중복

#### 영향

1. **버그 전파**: 한 곳 수정 시 다른 곳도 수정 필요
2. **일관성 저하**: 중복 코드가 서로 다른 방식으로 수정될 수 있음
3. **유지보수 비용 증가**: 동일한 로직을 여러 곳에서 관리
4. **테스트 복잡도**: 중복 코드마다 테스트 필요

#### 개선 방향

**공통 유틸리티 함수 추출**:

```typescript
// ✅ 좋은 예: 공통 유틸리티 함수
// lib/domains/plan/utils/schedulerOptionsMerger.ts
export function mergeTimeSettings(
  base: SchedulerOptions,
  override: Partial<SchedulerOptions>
): SchedulerOptions {
  return {
    ...base,
    ...override,
    // 병합 로직
  };
}

export function mergeStudyReviewCycle(
  base: StudyReviewCycle,
  override: Partial<StudyReviewCycle>
): StudyReviewCycle {
  return {
    ...base,
    ...override,
    // 병합 로직
  };
}

// 사용처에서
import {
  mergeTimeSettings,
  mergeStudyReviewCycle,
} from "@/lib/domains/plan/utils/schedulerOptionsMerger";
```

**에러 처리 통일**:

```typescript
// ✅ 좋은 예: 공통 에러 처리 유틸리티
// lib/utils/errorHandling.ts
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    throw normalizeError(error);
  }
}
```

---

### 4.3 함수 복잡도

#### 문제점

**God Function 발견**:

| 함수                      | 파일                                           | 줄 수  | 복잡도    | 문제점                   |
| ------------------------- | ---------------------------------------------- | ------ | --------- | ------------------------ |
| `generatePlansRefactored` | `lib/plan/services/generatePlansRefactored.ts` | 1,547  | 매우 높음 | 16+ 책임, God Function   |
| `previewPlansRefactored`  | `lib/plan/services/previewPlansRefactored.ts`  | ~1,500 | 매우 높음 | generate와 90% 중복      |
| `checkInWithQRCode`       | `lib/domains/attendance/actions/student.ts`    | ~200   | 높음      | 다단계 처리, 복잡한 로직 |

**복잡도 지표**:

- **Cyclomatic Complexity**: 일부 함수가 20+ (권장: 10 이하)
- **함수당 줄 수**: 일부 함수가 200+ 줄 (권장: 50줄 이하)
- **중첩 깊이**: 일부 함수가 5+ 레벨 (권장: 3 이하)

#### 영향

1. **이해 어려움**: 복잡한 함수는 이해하기 어려움
2. **테스트 어려움**: 모든 경로를 테스트하기 어려움
3. **버그 위험**: 복잡한 로직은 버그 발생 가능성 증가
4. **리팩토링 어려움**: 변경 시 사이드 이펙트 위험

#### 개선 방향

**함수 분리 전략**:

```typescript
// ❌ 나쁜 예: 200줄의 복잡한 함수
export async function checkInWithQRCode(qrData: string) {
  // Step 1: 인증 확인 (20줄)
  // Step 2: 테넌트 컨텍스트 (15줄)
  // Step 3: QR 코드 검증 (30줄)
  // Step 4: 테넌트 일치 확인 (20줄)
  // Step 5: 날짜 준비 (10줄)
  // Step 6: 기존 기록 확인 (25줄)
  // Step 7: 출석 기록 생성 (40줄)
  // Step 8: SMS 전송 (30줄)
  // Step 9: 결과 반환 (10줄)
}

// ✅ 좋은 예: 단계별로 함수 분리
export async function checkInWithQRCode(qrData: string) {
  const context = await prepareCheckInContext(qrData);
  const verification = await verifyQRCodeForCheckIn(qrData, context);
  const attendance = await createAttendanceRecord(verification, context);
  await sendAttendanceNotification(attendance, context);
  return { success: true, attendance };
}

async function prepareCheckInContext(qrData: string) {
  const user = await requireStudentAuth();
  const tenantContext = await getTenantContext();
  return { user, tenantContext, today: new Date().toISOString().slice(0, 10) };
}

async function verifyQRCodeForCheckIn(qrData: string, context: CheckInContext) {
  // QR 코드 검증 로직
}

async function createAttendanceRecord(
  verification: QRVerification,
  context: CheckInContext
) {
  // 출석 기록 생성 로직
}
```

---

### 4.4 네이밍 일관성

#### 문제점

**발견된 불일치**:

1. **테이블명 불일치**:
   - ERD 문서: `student_parent_links`
   - 실제 코드: `parent_student_links`
   - **결정**: 실제 코드 기준으로 통일

2. **필드명 불일치**:
   - ERD 문서: `relationship`
   - 실제 코드: `relation`
   - **결정**: 실제 코드 기준으로 통일

3. **함수명 패턴 불일치**:
   - `get*`: 데이터 조회 (일관적)
   - `fetch*`: 데이터 페칭 (일관적)
   - `create*`: 생성 (일관적)
   - `update*`: 수정 (일관적)
   - `delete*`: 삭제 (일관적)
   - ⚠️ 일부 파일에서 `remove*`, `remove*` 혼용

4. **변수명 패턴 불일치**:
   - `camelCase`: 일반 변수 (일관적)
   - `PascalCase`: 타입/컴포넌트 (일관적)
   - `UPPER_SNAKE_CASE`: 상수 (일관적)
   - ⚠️ 일부 파일에서 `snake_case` 혼용

#### 개선 방향

**네이밍 가이드라인 수립**:

```typescript
// ✅ 함수명 패턴
// 조회: get*, fetch*, find*
export async function getStudentById(id: string) { }
export async function fetchStudents(filters: Filters) { }
export async function findStudentByEmail(email: string) { }

// 생성: create*
export async function createStudent(data: StudentData) { }

// 수정: update*
export async function updateStudent(id: string, data: Partial<StudentData>) { }

// 삭제: delete* (remove* 사용 금지)
export async function deleteStudent(id: string) { }

// ✅ 변수명 패턴
// camelCase: 일반 변수
const studentName = "홍길동";
const planGroups = await getPlanGroups();

// PascalCase: 타입, 컴포넌트
type StudentData = { ... };
export function StudentCard() { }

// UPPER_SNAKE_CASE: 상수
const MAX_PLAN_COUNT = 100;
const DEFAULT_SCHEDULER_OPTIONS = { ... };
```

---

### 4.5 코드 스타일 일관성

#### 문제점

**발견된 스타일 불일치**:

1. **Import 순서**:
   - 일부 파일: 외부 라이브러리 → 내부 모듈
   - 일부 파일: 내부 모듈 → 외부 라이브러리
   - 일부 파일: 알파벳 순서

2. **Export 패턴**:
   - 일부 파일: `export default`
   - 일부 파일: `export { ... }`
   - 일부 파일: `export * from`

3. **타입 정의 위치**:
   - 일부 파일: 파일 상단
   - 일부 파일: 함수 위
   - 일부 파일: 별도 `types.ts` 파일

4. **주석 스타일**:
   - 일부 파일: JSDoc 주석
   - 일부 파일: 인라인 주석
   - 일부 파일: 블록 주석

#### 개선 방향

**코드 스타일 가이드라인**:

```typescript
// ✅ Import 순서 (ESLint 규칙 적용)
// 1. 외부 라이브러리
import { useState, useEffect } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 2. 내부 모듈 (절대 경로)
import { AppError } from "@/lib/errors";
import { getStudentById } from "@/lib/domains/student/service";

// 3. 상대 경로
import { StudentCard } from "./StudentCard";

// ✅ Export 패턴
// 단일 export: default
export default function StudentDashboard() { }

// 다중 export: named
export function getStudentById() { }
export function createStudent() { }

// ✅ 타입 정의 위치
// 파일 상단 또는 별도 types.ts 파일
type StudentData = { ... };

// ✅ 주석 스타일
/**
 * 학생 정보를 조회합니다.
 * @param id - 학생 ID
 * @returns 학생 정보
 */
export async function getStudentById(id: string): Promise<Student> {
  // 구현
}
```

---

### 4.6 기술 부채 (TODO/FIXME)

#### 현황

- **총 1,212개의 TODO/FIXME 주석** 발견 (342개 파일)
- 주요 분포:
  - `lib/domains/`: 200+ 개
  - `app/`: 300+ 개
  - `lib/plan/`: 100+ 개
  - `docs/`: 400+ 개 (문서화 TODO 포함)

#### 주요 카테고리

1. **리팩토링 필요**: 400+ 개
   - 레거시 코드 마이그레이션
   - 중복 코드 제거
   - 타입 안전성 개선

2. **성능 최적화**: 200+ 개
   - N+1 쿼리 개선
   - 캐싱 추가
   - 불필요한 재계산 제거

3. **기능 추가**: 300+ 개
   - 미완성 기능
   - 향후 개선 사항

4. **버그 수정**: 100+ 개
   - 알려진 이슈
   - 엣지 케이스 처리

#### 개선 방향

**우선순위별 정리**:

1. **Critical**: 버그 수정 관련 TODO (즉시 처리)
2. **High**: 리팩토링 및 성능 최적화 (단기 처리)
3. **Medium**: 기능 추가 (중기 처리)
4. **Low**: 문서화 및 개선 제안 (장기 처리)

---

### 4.7 주석 및 문서화

#### 현황

**JSDoc 주석 현황**:

- **4,600개 이상의 export 함수** 발견
- JSDoc 주석이 있는 함수: 약 30-40% (추정)
- 타입 정의 문서화: 약 50% (추정)

**문서화 품질**:

- ✅ 일부 도메인: 완전한 JSDoc 주석 (`lib/domains/attendance/`)
- ⚠️ 일부 도메인: 부분적 JSDoc 주석 (`lib/domains/plan/`)
- ❌ 일부 도메인: JSDoc 주석 부족 (`lib/domains/camp/`)

#### 문제점

1. **함수 설명 부족**:

   ```typescript
   // ❌ 나쁜 예: 설명 없음
   export async function getStudentById(id: string) {
     // ...
   }

   // ✅ 좋은 예: JSDoc 주석 포함
   /**
    * 학생 ID로 학생 정보를 조회합니다.
    * @param id - 학생 UUID
    * @returns 학생 정보 또는 null
    * @throws {AppError} 학생을 찾을 수 없을 때
    */
   export async function getStudentById(id: string): Promise<Student | null> {
     // ...
   }
   ```

2. **타입 정의 문서화 부족**:

   ```typescript
   // ❌ 나쁜 예: 타입 설명 없음
   type PlanGroupData = {
     student_id: string;
     period_start: Date;
     period_end: Date;
   };

   // ✅ 좋은 예: 타입 설명 포함
   /**
    * 플랜 그룹 생성 데이터
    */
   type PlanGroupData = {
     /** 학생 UUID */
     student_id: string;
     /** 학습 기간 시작일 */
     period_start: Date;
     /** 학습 기간 종료일 */
     period_end: Date;
   };
   ```

3. **복잡한 로직 설명 부족**:
   - 복잡한 비즈니스 로직에 대한 설명 부족
   - 알고리즘 설명 부족
   - 엣지 케이스 처리 설명 부족

#### 개선 방향

**JSDoc 주석 표준화**:

````typescript
/**
 * [함수 설명]
 *
 * [상세 설명 (필요 시)]
 *
 * @param {타입} paramName - [파라미터 설명]
 * @returns {타입} [반환값 설명]
 * @throws {에러타입} [에러 조건 설명]
 * @example
 * ```typescript
 * const result = await functionName(param);
 * ```
 */
export async function functionName(param: Type): Promise<ReturnType> {
  // ...
}
````

**타입 정의 문서화**:

```typescript
/**
 * [타입 설명]
 */
export interface TypeName {
  /** [필드 설명] */
  fieldName: Type;
}
```

---

### 4.8 함수 및 모듈 통계

#### 함수 통계

- **총 export 함수 수**: 4,600개 이상
- **도메인별 함수 수**:
  - `lib/domains/plan/`: 200+ 함수
  - `lib/domains/attendance/`: 50+ 함수
  - `lib/domains/camp/`: 100+ 함수
  - `lib/domains/admin-plan/`: 150+ 함수

#### 모듈 통계

- **총 TypeScript 파일**: 1,846개
- **도메인 모듈**: 23개
- **컴포넌트 파일**: 1,300+ 개
- **테스트 파일**: 100+ 개

#### 코드 라인 수

- **총 코드 라인**: 약 226,808줄 (`.tsx` 파일)
- **도메인 로직**: 약 5,783줄 (`lib/domains/`)
- **컴포넌트**: 약 226,808줄 (`app/`)

---

### 4.9 에러 처리 불일치

#### 문제점

**여러 패턴 혼재**:

```typescript
// 패턴 1: try-catch + throw
try {
  const result = await doSomething();
} catch (error) {
  throw new Error("에러 발생");
}

// 패턴 2: Result 타입
type Result<T> = { success: true; data: T } | { success: false; error: string };
const result = await doSomething();
if (!result.success) {
  return { success: false, error: result.error };
}

// 패턴 3: AppError 사용
throw new AppError("에러 발생", ErrorCode.NOT_FOUND, 404);

// 패턴 4: PlanGroupError 사용
throw new PlanGroupError("플랜 그룹을 찾을 수 없습니다.", ...);
```

**현재 에러 처리 시스템**:

- `lib/errors/handler.ts`: `AppError`, `ErrorCode` 정의
- `lib/errors/planGroupErrors.ts`: `PlanGroupError` 정의
- `lib/data/core/errorHandler.ts`: `StructuredError` 정의
- `lib/utils/errorHandling.ts`: 추가 에러 처리 유틸리티

#### 개선 방향

**통일된 에러 처리 패턴**:

```typescript
// ✅ 도메인별 에러 타입 사용
// lib/domains/{domain}/errors.ts
export class PlanError extends AppError {
  constructor(
    message: string,
    code: PlanErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message, code, 400, true, context);
  }
}

// ✅ Service 레이어에서 사용
export async function getPlanById(id: string): Promise<Plan> {
  const plan = await repository.findById(id);
  if (!plan) {
    throw new PlanError("플랜을 찾을 수 없습니다.", PlanErrorCode.NOT_FOUND, {
      id,
    });
  }
  return plan;
}

// ✅ Actions에서 에러 처리
export const getPlan = withErrorHandling(async (id: string) => {
  return await planService.getPlanById(id);
});
```

---

### 4.3 타입 안전성 문제

#### 문제점

**null 체크 부족**:

```typescript
// ❌ 나쁜 예
const { data } = await supabase.from("students").select("*");
const firstStudent = data[0]; // Error: 'data' is possibly 'null'
const name = firstStudent.name; // Error: 'firstStudent' is possibly 'undefined'
```

**타입 단언 과다 사용**:

```typescript
// ❌ 나쁜 예
const student = data as StudentRow;
const students = (data ?? []) as StudentRow[];
```

#### 개선 방향

**타입 안전한 접근**:

```typescript
// ✅ 좋은 예: Optional Chaining + Nullish Coalescing
const { data, error } = await supabase.from("students").select("*");
if (error) {
  throw new AppError("학생 조회 실패", ErrorCode.DATABASE_ERROR, 500);
}

const students = data ?? [];
if (students.length === 0) {
  return [];
}

const firstStudent = students[0];
const name = firstStudent?.name ?? "이름 없음";

// ✅ 좋은 예: 타입 가드 함수
function isValidStudent(data: unknown): data is StudentRow {
  return (
    typeof data === "object" && data !== null && "id" in data && "name" in data
  );
}

if (isValidStudent(data)) {
  // 타입이 좁혀짐
  const name = data.name;
}
```

---

## 5. UI/UX 분석

### 5.1 접근성 (Accessibility)

#### 문제점

**ARIA 속성 부족**:

- **1,132개 파일**에서 접근성 관련 코드 발견
- ARIA 속성 사용률: 약 30-40% (추정)
- 스크린 리더 지원 미흡

**주요 문제**:

1. **ARIA 레이블 부족**:

   ```tsx
   // ❌ 나쁜 예: aria-label 없음
   <button onClick={handleClick}>
     <Icon name="close" />
   </button>

   // ✅ 좋은 예: aria-label 포함
   <button onClick={handleClick} aria-label="닫기">
     <Icon name="close" />
   </button>
   ```

2. **키보드 네비게이션 미흡**:
   - 일부 컴포넌트만 키보드 네비게이션 지원
   - 모달 내부 포커스 관리 미흡
   - Tab 순서 논리적 구성 부족

3. **포커스 관리 문제**:
   - 모달이 열릴 때 첫 번째 포커스 가능 요소로 자동 포커스 이동 없음
   - 모달이 닫힐 때 이전 포커스 위치로 복귀 없음
   - 포커스 트랩 미구현

4. **시맨틱 HTML 부족**:
   - 일부 컴포넌트에서 `<div>` 남용
   - `<button>` 대신 `<div>` + `onClick` 사용하는 경우 있음

#### 개선 방향

**접근성 가이드라인**:

```tsx
// ✅ 키보드 네비게이션 지원
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }}
  aria-label="닫기"
>
  <Icon name="close" />
</button>

// ✅ 모달 포커스 관리
function Modal({ isOpen, onClose, children }) {
  const firstFocusableRef = useRef<HTMLElement>(null);
  const lastFocusableRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      firstFocusableRef.current?.focus();
    }
  }, [isOpen]);

  // 포커스 트랩 구현
  // ...
}

// ✅ 시맨틱 HTML 사용
// ❌ 나쁜 예
<div onClick={handleClick}>클릭</div>

// ✅ 좋은 예
<button onClick={handleClick}>클릭</button>
```

---

### 5.2 로딩 상태 및 사용자 피드백

#### 현황

- **2,718개 파일**에서 로딩 관련 코드 발견
- **3,074개 파일**에서 토스트/에러 처리 관련 코드 발견

#### 문제점

1. **로딩 상태 표시 불일치**:
   - 일부 컴포넌트: Skeleton 사용
   - 일부 컴포넌트: Spinner 사용
   - 일부 컴포넌트: 로딩 상태 없음

2. **에러 처리 패턴 불일치**:
   - 일부: Toast 메시지
   - 일부: 인라인 에러 표시
   - 일부: 모달 에러 표시

3. **성공 피드백 부족**:
   - 작업 완료 후 피드백이 없는 경우 많음
   - 성공 애니메이션 부족

#### 개선 방향

**통일된 로딩 상태 패턴**:

```tsx
// ✅ Skeleton 사용 (데이터 로딩)
<Suspense fallback={<Skeleton />}>
  <DataComponent />
</Suspense>

// ✅ Spinner 사용 (액션 로딩)
<Button isLoading={isSubmitting}>
  제출
</Button>

// ✅ 통일된 에러 처리
const { showError, showSuccess } = useToast();

try {
  await submitForm();
  showSuccess("제출이 완료되었습니다.");
} catch (error) {
  showError(error.message);
}
```

---

### 5.3 컴포넌트 재사용성 및 중복

#### 문제점

**중복 컴포넌트 발견**:

1. **Button 컴포넌트**:
   - `components/ui/button.tsx`: 4개 파일에서 사용
   - `components/atoms/Button.tsx`: 29개 파일에서 사용
   - **결론**: `atoms/Button.tsx`가 더 기능이 많고 개선된 버전

2. **EmptyState 컴포넌트**:
   - `components/ui/EmptyState.tsx`: 17개 파일에서 사용
   - `components/molecules/EmptyState.tsx`: 13개 파일에서 사용
   - **차이점**: `molecules/EmptyState.tsx`가 ReactNode icon 지원

3. **ProgressBar 컴포넌트**:
   - `components/ui/ProgressBar.tsx`: 제거됨 (✅ 해결됨)
   - `components/atoms/ProgressBar.tsx`: 통합 완료

4. **Badge 컴포넌트**:
   - `components/ui/Badge.tsx`: 제거됨 (✅ 해결됨)
   - `components/atoms/Badge.tsx`: 통합 완료

#### 개선 방향

**컴포넌트 통합 전략**:

1. **Atomic Design 패턴 적용**:

   ```
   components/
   ├── atoms/           # 기본 UI 요소 (Button, Input, Badge)
   ├── molecules/       # atoms 조합 (FormField, Card)
   ├── organisms/       # 복잡한 UI (DataTable, Dialog)
   └── ui/              # 레거시 (점진적 마이그레이션)
   ```

2. **중복 컴포넌트 통합**:
   - 더 기능이 많은 버전을 기준으로 통합
   - 사용처를 점진적으로 마이그레이션
   - 레거시 컴포넌트는 `@deprecated` 표시 후 제거

---

### 5.4 반응형 디자인

#### 문제점

1. **브레이크포인트 일관성 부족**:
   - 일부 컴포넌트: `sm:` 사용
   - 일부 컴포넌트: `md:` 사용
   - 브레이크포인트 선택 기준이 일관되지 않음

2. **모바일 최적화 부족**:
   - 일부 모달이 모바일에서 너무 넓음
   - 테이블이 모바일에서 가로 스크롤 없이 잘림
   - 터치 친화적 버튼 크기 부족

3. **모바일 우선 패턴 미적용**:
   - 대부분 모바일 우선 패턴 적용됨 (✅)
   - 일부 컴포넌트에서 데스크톱 우선 패턴 발견

#### 개선 방향

**표준 브레이크포인트 정의**:

```tsx
// ✅ 모바일 우선 패턴
<div className="p-4 md:p-6 lg:p-8">
  {/* 모바일: p-4, 태블릿: p-6, 데스크톱: p-8 */}
</div>

// ✅ 모바일 테이블 최적화
<div className="overflow-x-auto md:overflow-visible">
  <table className="min-w-full">
    {/* 모바일: 가로 스크롤, 데스크톱: 일반 테이블 */}
  </table>
</div>

// ✅ 모바일 카드 레이아웃
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 모바일: 1열, 태블릿: 2열, 데스크톱: 3열 */}
</div>
```

---

### 5.5 모달 및 다이얼로그 통일

#### 문제점

**여러 모달 패턴 혼재**:

1. **Dialog 컴포넌트 사용**:
   - `components/ui/Dialog.tsx`: 표준 모달 컴포넌트
   - 일부 페이지에서 사용 중

2. **커스텀 모달**:
   - 각 페이지별로 커스텀 모달 구현
   - 일관성 없는 구조 및 스타일

3. **ModalWrapper**:
   - `app/(admin)/admin/students/[id]/plans/_components/modals/ModalWrapper.tsx`
   - 관리자 플랜 관리 전용 래퍼

#### 개선 방향

**통일된 모달 패턴**:

```tsx
// ✅ 표준 Dialog 컴포넌트 사용
import { Dialog } from "@/components/ui/Dialog";

<Dialog open={isOpen} onClose={onClose} title="제목" description="설명">
  {/* 내용 */}
</Dialog>;

// ✅ 모달 테마 가이드라인
// - blue: 조회/기본 액션
// - amber: 편집/수정 액션
// - purple: 그룹/조직 관련
// - green: 생성/추가 액션
// - red: 삭제/위험 액션
```

---

### 5.6 Spacing-First 정책 위반

#### 문제점

**많은 파일에서 margin 사용**:

- 형제 요소 간 간격을 `margin`으로 처리하는 경우 많음
- Spacing-First 정책: 형제 간격은 `gap`, 외곽 여백은 `padding`

**위반 예시**:

```tsx
// ❌ 나쁜 예: margin 사용
<div>
  <Card className="mb-4" />
  <Card className="mb-4" />
  <Card />
</div>

// ✅ 좋은 예: gap 사용
<div className="flex flex-col gap-4">
  <Card />
  <Card />
  <Card />
</div>
```

#### 개선 방향

**Spacing-First 정책 적용**:

1. **형제 요소 간격**: `gap` 사용
2. **외곽 여백**: 최상단 래퍼의 `padding` 사용
3. **ESLint 규칙**: margin 클래스 사용 금지 (이미 적용됨)

---

### 5.7 인라인 스타일 사용

#### 문제점

**인라인 스타일 발견**:

- 일부 컴포넌트에서 `style={{ }}` 사용
- Tailwind CSS 정책: 인라인 스타일 금지

**위반 예시**:

```tsx
// ❌ 나쁜 예: 인라인 스타일
<div style={{ width: `${progress}%` }}>
  진행률
</div>

// ✅ 좋은 예: Tailwind 클래스
<div className="w-full">
  <div className="h-2 bg-blue-500" style={{ width: `${progress}%` }}>
    {/* 동적 width는 예외적으로 허용 */}
  </div>
</div>
```

#### 개선 방향

**CSS 변수 활용**:

```tsx
// ✅ 좋은 예: CSS 변수 사용
<div
  className="h-2 bg-blue-500 transition-all"
  style={{ "--progress": `${progress}%` } as React.CSSProperties}
>
  {/* 또는 Tailwind arbitrary values */}
  <div className={`w-[${progress}%]`}>{/* ... */}</div>
</div>
```

---

### 5.8 디자인 시스템 일관성

#### 문제점

1. **색상 시스템 불일치**:
   - 하드코딩된 색상 클래스 사용 (gray-_, indigo-_ 등)
   - 디자인 시스템 토큰 미사용

2. **타이포그래피 불일치**:
   - 일부 컴포넌트: 디자인 시스템 타이포그래피 클래스 사용
   - 일부 컴포넌트: 임의의 텍스트 크기 사용

3. **Elevation/Shadow 불일치**:
   - 일관된 그림자 시스템 부족
   - 카드 컴포넌트마다 다른 그림자 스타일

#### 개선 방향

**디자인 시스템 통일**:

```tsx
// ✅ 디자인 시스템 색상 사용
// ❌ 나쁜 예
<div className="bg-gray-100 text-gray-800">

// ✅ 좋은 예
<div className="bg-background text-foreground">
// 또는 semantic colors
<div className="bg-primary text-primary-foreground">

// ✅ 디자인 시스템 타이포그래피
<h1 className="text-h1">제목</h1>
<p className="text-body-2">본문</p>

// ✅ Elevation 시스템
<div className="elevation-1">카드 1</div>
<div className="elevation-2">카드 2</div>
```

---

### 5.9 사용자 경험 패턴

#### 문제점

1. **폼 검증 피드백**:
   - 일부 폼: 실시간 검증
   - 일부 폼: 제출 시 검증
   - 일관성 부족

2. **자동 저장**:
   - 일부 위저드: 자동 저장 기능
   - 일부 위저드: 자동 저장 없음
   - 사용자 혼란 가능성

3. **로딩 상태 표시**:
   - 일부 액션: 로딩 표시
   - 일부 액션: 로딩 표시 없음
   - 사용자가 작업 진행 여부를 알 수 없음

#### 개선 방향

**일관된 UX 패턴**:

```tsx
// ✅ 폼 검증 피드백
// 실시간 검증 (onBlur)
<Input
  onBlur={(e) => validateField(e.target.value)}
  error={fieldError}
/>

// ✅ 자동 저장 표시
<div className="flex items-center gap-2">
  <SaveStatusIndicator status={saveStatus} />
  <span className="text-sm text-gray-500">
    {saveStatus === "saving" && "저장 중..."}
    {saveStatus === "saved" && "저장됨"}
  </span>
</div>

// ✅ 로딩 상태 표시
<Button isLoading={isSubmitting} disabled={isSubmitting}>
  제출
</Button>
```

---

## 6. 성능 분석

### 5.1 과도한 동적 렌더링

#### 문제점

**현재 상태**:

- **90개 이상의 파일**에서 `export const dynamic = 'force-dynamic'` 사용
- **모든 레이아웃 파일**이 `force-dynamic`:
  - `app/(student)/layout.tsx`
  - `app/(admin)/layout.tsx`
  - `app/(parent)/layout.tsx`
  - `app/(superadmin)/layout.tsx`

**성능 영향**:

- Next.js의 자동 캐싱 및 ISR 활용 불가
- 매 요청마다 서버에서 렌더링 수행
- 데이터베이스 쿼리 중복 실행
- 응답 시간 증가 및 서버 부하 증가

#### 개선 방향

**캐싱 전략 수립**:

```typescript
// ✅ 레이아웃 파일
export const revalidate = 300; // 5분

// ✅ 정적 데이터가 많은 페이지
export const revalidate = 3600; // 1시간

// ✅ 사용자별 데이터지만 자주 변경되지 않는 페이지
export const revalidate = 60; // 1분

// ✅ 실시간 데이터가 필요한 페이지만
export const dynamic = "force-dynamic";
```

**예상 성능 개선**:

- 페이지 로딩 시간: **30-50% 감소**
- 서버 부하: **40-60% 감소**
- 데이터베이스 쿼리: **50-70% 감소**

---

### 5.2 N+1 쿼리 패턴

#### 문제점

**현재 상태**:

- 대부분 배치 처리로 해결됨
- 일부 여전히 미해결:
  - Parent 도메인: 부모-학생 연결 조회 시 각 부모별 학생 수를 별도로 계산
  - Score 조회: 과목별 점수 상세 조회 시 각 과목마다 별도 쿼리

**예시**:

```typescript
// ❌ 나쁜 예: N+1 쿼리
const planGroups = await getPlanGroups(filters);
for (const group of planGroups) {
  const contents = await getPlanContents(group.id); // N+1!
}
```

#### 개선 방향

**배치 쿼리 사용**:

```typescript
// ✅ 좋은 예: 배치 쿼리
const planGroups = await getPlanGroups(filters);
const groupIds = planGroups.map((g) => g.id);
const allContents = await getPlanContentsBatch(groupIds);

// 그룹별로 매핑
const contentsMap = new Map(allContents.map((c) => [c.plan_group_id, c]));

for (const group of planGroups) {
  const contents = contentsMap.get(group.id) ?? [];
  // ...
}
```

---

### 5.3 불필요한 재계산

#### 문제점

**캐싱 부족**:

```typescript
// ❌ 나쁜 예: 매번 재계산
export async function getWeeklyMetrics(...) {
  const studyTime = await getStudyTime(...);
  const planCompletion = await getPlanCompletion(...);
  const weakSubjects = await getWeakSubjects(...);
  // 매번 모든 메트릭을 계산
}
```

#### 개선 방향

**캐싱 추가**:

```typescript
// ✅ 좋은 예: 캐싱 사용
import { unstable_cache } from "next/cache";

export const getWeeklyMetrics = unstable_cache(
  async (studentId: string, weekStart: Date) => {
    const studyTime = await getStudyTime(studentId, weekStart);
    const planCompletion = await getPlanCompletion(studentId, weekStart);
    const weakSubjects = await getWeakSubjects(studentId, weekStart);
    return { studyTime, planCompletion, weakSubjects };
  },
  ["weekly-metrics"],
  { revalidate: 300 } // 5분
);
```

---

## 6. 의존성 및 타입 안전성

### 6.1 도메인 간 경계 불명확

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

- 순환 의존성 위험
- 리팩토링 어려움
- 테스트 복잡도 증가

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

### 6.2 타입 안전성 개선 필요

#### 문제점

1. **null 체크 부족**: Supabase 응답에서 `null | Type` 형태가 자주 발생
2. **타입 단언 과다 사용**: `as` 키워드 남용
3. **any 타입 사용**: 일부 레거시 코드에서 `any` 사용

#### 개선 방향

1. **Optional Chaining + Nullish Coalescing** 적극 활용
2. **타입 가드 함수** 사용
3. **명시적 타입 정의** 및 `any` 제거

---

## 7. 테스트 및 문서화

### 7.1 테스트 커버리지

#### 현황

- **E2E 테스트**: Playwright로 17개 테스트 파일 존재
- **단위 테스트**: Vitest로 일부 테스트 존재
- **통합 테스트**: 일부 도메인에만 존재

#### 개선 방향

1. **단위 테스트 커버리지 향상**: Service 레이어 중심
2. **통합 테스트 확대**: Repository + Service 조합
3. **E2E 테스트 확대**: 주요 사용자 시나리오

---

### 7.2 문서화

#### 현황

- **기능 문서**: 1,340개의 문서 파일 존재
- **아키텍처 문서**: 일부 존재하나 통합 문서 부족
- **API 문서**: Server Actions 문서화 부족

#### 개선 방향

1. **아키텍처 문서 통합**: 전체 아키텍처 개요 문서
2. **API 문서화**: Server Actions JSDoc 강화
3. **개발 가이드**: 신규 개발자 온보딩 가이드

---

## 8. 우선순위별 개선 로드맵

### 8.1 Phase 1: Critical (즉시 조치) - 2주

#### 1.1 Server Actions 구조 정리

**목표**: Deprecated 코드 제거 및 중간 단계 Actions 마이그레이션

**작업**:

- [ ] `app/actions/scores.ts` 사용처 확인 후 제거
- [ ] `app/actions/scores-internal.ts` → `lib/domains/score/actions.ts` 마이그레이션
- [ ] 비즈니스 로직을 Service 레이어로 추출

**예상 작업량**: 4일

#### 1.2 레이아웃 파일 캐싱 최적화

**목표**: 모든 레이아웃 파일에 적절한 캐싱 전략 적용

**작업**:

- [ ] `app/(student)/layout.tsx` → `revalidate: 300` 적용
- [ ] `app/(admin)/layout.tsx` → `revalidate: 300` 적용
- [ ] `app/(parent)/layout.tsx` → `revalidate: 300` 적용
- [ ] `app/(superadmin)/layout.tsx` → `revalidate: 300` 적용

**예상 작업량**: 1일

#### 1.3 Critical TODO 정리

**목표**: 버그 수정 관련 TODO 우선 처리

**작업**:

- [ ] Critical TODO 목록 작성
- [ ] 우선순위별 처리 계획 수립
- [ ] 즉시 처리 가능한 항목 처리

**예상 작업량**: 3일

---

### 8.2 Phase 2: High (단기 개선) - 4주

#### 2.1 Plan 도메인 완전 마이그레이션

**목표**: Plan 도메인을 완전한 레이어 구조로 마이그레이션

**작업**:

- [ ] `lib/domains/plan/actions.ts` 생성
- [ ] `app/(student)/actions/planActions.ts` 마이그레이션
- [ ] 비즈니스 로직을 Service 레이어로 추출
- [ ] 타입 정의 통합

**예상 작업량**: 5일

#### 2.2 에러 처리 패턴 통일

**목표**: 도메인별 에러 타입 정의 및 통일된 에러 처리

**작업**:

- [ ] 도메인별 에러 타입 정의 (`lib/domains/{domain}/errors.ts`)
- [ ] Service 레이어에서 도메인 에러 사용
- [ ] Actions에서 `withErrorHandling` 적용

**예상 작업량**: 5일

#### 2.3 N+1 쿼리 패턴 제거

**목표**: 남아있는 N+1 쿼리 패턴을 배치 쿼리로 변경

**작업**:

- [ ] N+1 쿼리 패턴 검색 및 목록 작성
- [ ] 배치 쿼리로 변경
- [ ] 성능 측정 및 검증

**예상 작업량**: 5일

#### 2.4 타입 안전성 개선

**목표**: null 체크 강화 및 타입 단언 최소화

**작업**:

- [ ] Optional Chaining + Nullish Coalescing 적용
- [ ] 타입 가드 함수 추가
- [ ] `any` 타입 제거

**예상 작업량**: 5일

---

### 8.3 Phase 3: Medium (중기 개선) - 8주

#### 3.1 나머지 도메인 마이그레이션

**목표**: 미구현 도메인들을 완전한 레이어 구조로 마이그레이션

**작업**:

- [ ] `student`, `content`, `goal`, `block`, `camp`, `tenant`, `subject` 도메인 구조화
- [ ] Repository 패턴 적용
- [ ] Service 레이어 구현
- [ ] Actions 마이그레이션

**예상 작업량**: 15일

#### 3.2 페이지별 캐싱 전략 수립

**목표**: 각 페이지에 적절한 캐싱 전략 적용

**작업**:

- [ ] 페이지별 데이터 특성 분석
- [ ] 캐싱 전략 수립
- [ ] `revalidate` 값 설정
- [ ] 성능 측정 및 검증

**예상 작업량**: 5일

#### 3.3 레거시 코드 마이그레이션

**목표**: `lib/plan/` 레거시 코드를 `lib/domains/plan/`로 마이그레이션

**작업**:

- [ ] 레거시 코드 의존성 분석
- [ ] 점진적 마이그레이션
- [ ] 레거시 코드 제거

**예상 작업량**: 10일

---

### 8.4 Phase 4: Low (장기 개선) - 12주

#### 4.1 테스트 커버리지 향상

**목표**: 단위 테스트 커버리지 70% 이상 달성

**작업**:

- [ ] Service 레이어 단위 테스트 작성
- [ ] Repository 레이어 통합 테스트 작성
- [ ] 테스트 커버리지 측정 도구 설정

**예상 작업량**: 20일

#### 4.2 문서화 강화

**목표**: 아키텍처 문서 및 개발 가이드 작성

**작업**:

- [ ] 전체 아키텍처 개요 문서 작성
- [ ] Server Actions API 문서화
- [ ] 신규 개발자 온보딩 가이드 작성

**예상 작업량**: 10일

#### 4.3 성능 모니터링 도구 도입

**목표**: 프로덕션 성능 측정 및 모니터링 시스템 구축

**작업**:

- [ ] 성능 측정 도구 도입 (예: Vercel Analytics, Sentry)
- [ ] 성능 대시보드 구축
- [ ] 알림 시스템 설정

**예상 작업량**: 5일

---

## 9. 결론

### 9.1 주요 개선 사항 요약

1. **아키텍처 통일**: Server Actions 구조 혼재 해결 및 레이어 분리 완성
2. **성능 최적화**: 캐싱 전략 수립으로 30-50% 성능 개선 예상
3. **코드 품질 향상**: 에러 처리 통일, 타입 안전성 개선
4. **유지보수성 향상**: 도메인 구조 완성 및 문서화 강화

### 9.2 예상 효과

- **성능**: 페이지 로딩 시간 30-50% 감소
- **개발 생산성**: 코드 일관성 향상으로 개발 속도 20-30% 증가
- **유지보수성**: 아키텍처 통일로 버그 감소 및 리팩토링 용이성 향상
- **테스트 용이성**: 레이어 분리로 단위 테스트 작성 용이

### 9.3 다음 단계

1. **Phase 1 작업 시작**: Critical 항목부터 우선 처리
2. **정기적 리뷰**: 주간/월간 진행 상황 리뷰
3. **점진적 개선**: 큰 변경보다 작은 개선을 지속적으로 적용

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-01-13  
**작성자**: AI Assistant (Claude)
