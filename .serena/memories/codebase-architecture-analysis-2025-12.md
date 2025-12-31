# 코드베이스 아키텍처 종합 분석 (2025년 12월)

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TimeLevelUp Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│  [Presentation Layer - Next.js App Router]                          │
│  ├─ app/(admin)/    → 관리자 페이지                                   │
│  ├─ app/(student)/  → 학생 페이지 (today, plan, scores)               │
│  └─ app/(parent)/   → 학부모 페이지                                   │
├─────────────────────────────────────────────────────────────────────┤
│  [Business Logic Layer]                                              │
│  ├─ lib/domains/    → 25개 도메인 (DDD 패턴)                          │
│  │   ├─ plan/       → 플랜 생성/관리 핵심 도메인                        │
│  │   ├─ camp/       → 캠프 관리 (가장 큰 도메인)                        │
│  │   ├─ today/      → 컨테이너 기반 일일 플랜                          │
│  │   └─ ...         → 기타 도메인들                                   │
│  └─ lib/services/   → 크로스 도메인 서비스                             │
├─────────────────────────────────────────────────────────────────────┤
│  [Data Access Layer]                                                 │
│  ├─ lib/data/       → 쿼리 함수 (데이터 조회)                          │
│  └─ lib/domains/*/repository.ts → 도메인별 Repository                 │
├─────────────────────────────────────────────────────────────────────┤
│  [Infrastructure]                                                    │
│  ├─ lib/supabase/   → Supabase 클라이언트                             │
│  └─ supabase/migrations/ → DB 마이그레이션                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Plan 도메인 심층 구조

### 2.1 디렉토리 구조
```
lib/domains/plan/
├─ repository.ts           # 저수준 CRUD (24개 함수)
├─ service.ts             # 고수준 비즈니스 로직 (21개 함수)
├─ transactions.ts        # 트랜잭션 관리
├─ types.ts               # 타입 정의
├─ utils/                 # 유틸리티
│   ├─ availableDates.ts
│   ├─ contentValidation.ts
│   ├─ dailyScheduleReconstructor.ts
│   └─ subjectConstraintValidator.ts
├─ actions/               # Server Actions
│   ├─ plan-groups/       # 플랜 그룹 관련 (17개 파일)
│   │   ├─ create.ts      # 핵심 생성 로직
│   │   ├─ generatePlansWithServices.ts
│   │   ├─ generatePlansRefactored.ts
│   │   ├─ previewPlansRefactored.ts
│   │   ├─ reschedule.ts
│   │   ├─ rollback.ts
│   │   └─ ...
│   ├─ contentPlanGroup/  # 콘텐츠 기반 플랜
│   │   ├─ create.ts
│   │   ├─ quickCreate.ts
│   │   └─ ...
│   └─ ...
└─ services/             # 서비스 레이어 (10개)
    ├─ planValidationService.ts
    ├─ planPayloadBuilder.ts
    ├─ planPersistenceService.ts
    ├─ contentResolutionService.ts
    ├─ adaptiveScheduler.ts
    ├─ conflictResolver.ts
    ├─ progressCalculator.ts
    ├─ slotValidationService.ts
    └─ templateLockService.ts
```

### 2.2 핵심 서비스 클래스

| 서비스 | 책임 |
|--------|------|
| `PlanValidationService` | 페이로드/콘텐츠/삽입 결과 검증 |
| `PlanPayloadBuilder` | 스케줄 → DB 페이로드 변환 |
| `PlanPersistenceService` | 배치 삽입, 롤백, 상태 업데이트 |
| `ContentResolutionService` | 마스터→학생 콘텐츠 복사/해석 |
| `AdaptiveScheduler` | 학습 패턴 분석, 추천 생성 |

### 2.3 플랜 생성 플로우

```
사용자 입력 (7단계 위자드)
        ↓
createPlanGroupAtomic() [create.ts]
        ↓
┌─────────────────────────────────────────┐
│  generatePlansWithServicesAction()       │
│  ├─ ContentResolutionService.resolve()   │
│  ├─ PlanValidationService.validate()     │
│  ├─ PlanPayloadBuilder.build()           │
│  └─ PlanPersistenceService.insert()      │
└─────────────────────────────────────────┘
        ↓
   plan_groups + student_plan 테이블에 저장
```

---

## 3. 서비스 레이어 패턴

### 3.1 도메인 내부 서비스 (`lib/domains/*/services/`)
```typescript
// 팩토리 패턴으로 서비스 생성
export function createPlanValidationService(ctx: ServiceContext) {
  return new PlanValidationService(ctx);
}

// 클래스 기반 서비스
class PlanValidationService {
  constructor(private ctx: ServiceContext) {}
  
  validatePayloads(payloads: StudentPlanPayload[]): ValidationResult
  validateContentExistence(contents: Content[]): ValidationResult
  validateContentResolution(resolved: ResolvedContent[]): ValidationResult
  validateInsertResult(result: InsertResult): ValidationResult
}
```

### 3.2 크로스 도메인 서비스 (`lib/services/`)
```
lib/services/
├─ campNotificationService.ts      # 캠프 알림
├─ campReminderService.ts          # 캠프 리마인더
├─ campInvitationExpiryService.ts  # 초대 만료 처리
├─ inAppNotificationService.ts     # 인앱 알림
├─ smsService.ts                   # SMS 발송
├─ attendanceSMSService.ts         # 출석 SMS
├─ emailService.ts                 # 이메일
├─ qrCodeService.ts                # QR 코드 생성
└─ locationService.ts              # 위치 서비스
```

---

## 4. 데이터 레이어 패턴

### 4.1 Repository 패턴 (`lib/domains/*/repository.ts`)
```typescript
// 저수준 CRUD 함수
export async function insertPlanGroup(data: PlanGroupInsert) {...}
export async function findPlanGroupById(id: string) {...}
export async function updatePlanGroupById(id: string, data: Partial) {...}
export async function softDeletePlanGroup(id: string) {...}
```

### 4.2 Data Query 함수 (`lib/data/`)
```typescript
// 고수준 조회 함수 (조인, 필터링 포함)
export async function getPlanGroupsForStudent(studentId: string) {...}
export async function getPlanGroupById(id: string) {...}
```

### 4.3 BaseRepository 클래스 (`lib/data/core/baseRepository.ts`)
```typescript
class BaseRepository<T> {
  create(data: Partial<T>): Promise<T>
  findById(id: string): Promise<T | null>
  findByIds(ids: string[]): Promise<T[]>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
  softDelete(id: string): Promise<void>
}
```

### 4.4 lib/data 모듈 구조
```
lib/data/
├─ core/                    # 핵심 쿼리 유틸리티
│   ├─ baseRepository.ts
│   ├─ queryBuilder.ts
│   ├─ typedQueryBuilder.ts
│   └─ errorHandler.ts
├─ planGroups/              # 플랜 그룹 쿼리
│   ├─ core.ts
│   ├─ admin.ts
│   ├─ contents.ts
│   ├─ exclusions.ts
│   └─ ...
├─ contentMasters/          # 마스터 콘텐츠 쿼리
│   ├─ books/
│   ├─ lectures/
│   └─ ...
└─ ...                      # 기타 도메인별 쿼리
```

---

## 5. 플랜 위자드 컴포넌트 구조

### 경로: `app/(student)/plan/new-group/_components/`

```
_components/
├─ PlanGroupWizard.tsx              # 메인 위자드
├─ BasePlanWizard.tsx               # 베이스 위자드
├─ UnifiedPlanGroupWizard.tsx       # 통합 위자드
│
├─ _context/                        # Context (3개 분리)
│   ├─ WizardDataContext.tsx        # 데이터 상태
│   ├─ WizardStepContext.tsx        # 단계 상태
│   ├─ WizardValidationContext.tsx  # 검증 상태
│   └─ reducers/                    # 리듀서
│       ├─ dataReducer.ts
│       ├─ stepReducer.ts
│       └─ validationReducer.ts
│
├─ hooks/                           # 훅 (15개)
│   ├─ useAutoSave.ts              # 오토세이브 (2초 디바운스)
│   ├─ usePlanDraft.ts             # 드래프트 관리
│   ├─ usePlanSubmission.ts        # 제출 처리
│   ├─ usePlanPayloadBuilder.ts    # 페이로드 생성
│   ├─ useWizardStepHandlers.ts    # 단계 핸들러
│   ├─ useWizardNavigation.ts      # 네비게이션
│   ├─ useWizardValidation.ts      # 검증
│   ├─ useWizardKeyboardNavigation.ts  # 키보드 (Alt+→/←)
│   ├─ useWizardFocusManagement.ts # 포커스 관리
│   ├─ useContentDataFetcher.ts    # 콘텐츠 데이터 페칭
│   └─ ...
│
├─ _features/                       # 단계별 기능
│   ├─ basic-info/                 # Step 1
│   ├─ scheduling/                 # Step 2, 3, 7
│   └─ content-selection/          # Step 4, 5, 6
│       └─ slot-mode/              # 슬롯 모드
│
├─ common/                          # 공통 컴포넌트
└─ _ui/                            # UI 컴포넌트
```

### 7단계 위자드 흐름
| 단계 | 컴포넌트 | 설명 |
|------|----------|------|
| 1 | Step1BasicInfo | 이름, 블록세트, 학습 기간, 요일 |
| 2 | Step2TimeSettings | 시간 설정, 학원 스케줄, 제외일 |
| 3 | Step3SchedulePreview | 주간별 타임라인 미리보기 |
| 4 | Step3ContentSelection | 마스터/학생 콘텐츠, 슬롯 모드 |
| 5 | RecommendedContentsPanel | AI 추천, 과목 균형 |
| 6 | Step6FinalReview | 콘텐츠 할당, 전략/약점 에디터 |
| 7 | Step7ScheduleResult | 생성 결과, 활성화 다이얼로그 |

---

## 6. Today 도메인 (컨테이너 시스템)

### 경로: `lib/domains/today/`

### 6.1 컨테이너 유형
```typescript
type ContainerType = 'unfinished' | 'daily' | 'weekly';

interface ContainerPlan {
  id: string;
  plan_date: string;
  container_type: ContainerType;
  status: PlanStatus;
  carryover_count: number;      // 이월 횟수
  carryover_from_date?: string; // 이월 원본 날짜
}
```

### 6.2 핵심 액션 (`lib/domains/today/actions/containerPlans.ts`)
| 액션 | 설명 |
|------|------|
| `getTodayContainerPlans` | 컨테이너별 플랜 조회 |
| `moveToDaily` | Daily 컨테이너로 이동 |
| `moveToWeekly` | Weekly 컨테이너로 이동 |
| `processEndOfDay` | 하루 종료 처리 (미완료→Unfinished) |
| `reorderContainerPlans` | 드래그앤드롭 재정렬 |
| `handleStudentPlanDrop` | 플랜 드롭 처리 |

---

## 7. 주요 설계 패턴 요약

| 패턴 | 적용 위치 | 설명 |
|------|----------|------|
| **DDD (Domain-Driven Design)** | `lib/domains/` | 25개 도메인으로 분리 |
| **Repository Pattern** | `*/repository.ts` | 데이터 접근 추상화 |
| **Service Layer** | `*/services/` | 비즈니스 로직 캡슐화 |
| **Factory Pattern** | `createXxxService()` | 서비스 인스턴스 생성 |
| **Context + Reducer** | 위자드 컴포넌트 | 상태 관리 (3분할) |
| **Server Actions** | `*/actions/` | Next.js 서버 액션 |
| **Atomic Operations** | `createPlanGroupAtomic` | 트랜잭션 보장 |
| **Lazy Loading** | 위자드 Step 컴포넌트 | 동적 임포트 |
| **LRU Cache** | 위자드 | 100항목, 30분 TTL |

---

## 8. 도메인 크기 순위

| 순위 | 도메인 | 특징 |
|------|--------|------|
| 1 | **camp** | 가장 큼 (permissions 457줄, errors 492줄) |
| 2 | **plan** | 복잡한 위자드, 서비스 레이어 10개 |
| 3 | **content** | 마스터/학생 콘텐츠 관리 |
| 4 | **today** | 컨테이너 시스템 |
| 5 | **school** | 학교/대학/지역 관리 |
| 6 | **attendance** | 출석/통계/검증 |
| 7 | **student** | 학생 관리/상담/알림 |
| 8 | **score** | 성적 3종 (모의/학교/내신) |
| 9 | **tenant** | 블록세트/설정/사용자 |
| 10 | **block** | 시간표 블록 |

---

## 9. 핵심 테이블 관계

```
plan_groups (1) ──┬── (N) student_plan
                  ├── (N) plan_group_contents
                  ├── (N) plan_group_exclusions
                  └── (N) academy_schedules

student_plan ──── content_id ──── student_contents
                                        │
                                        └── master_contents (복사 원본)
```

---

## 10. 파일 명명 규칙

### 액션 파일
- `create.ts` - 생성 로직
- `update.ts` - 수정 로직
- `delete.ts` - 삭제 로직
- `queries.ts` - 조회 로직
- `status.ts` - 상태 변경
- `*Refactored.ts` - 리팩토링된 버전

### 서비스 파일
- `*Service.ts` - 서비스 클래스
- `*Validator.ts` - 검증 로직
- `*Builder.ts` - 빌더 패턴

### 컴포넌트 파일
- `Step[N]*.tsx` - 위자드 단계
- `*Panel.tsx` - 패널 컴포넌트
- `*Modal.tsx` - 모달 컴포넌트
- `use*.ts` - 커스텀 훅

---

*마지막 업데이트: 2025-12-31*
