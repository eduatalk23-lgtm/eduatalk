# 플래너 스케줄러/타임라인 통합 - 구현 상태 문서

**작성일**: 2026-01-15
**최종 업데이트**: 2026-01-08
**목적**: 플래너 스케줄러/타임라인 통합 구현 현황 추적

---

## 프로젝트 개요

플래너 콘텐츠 추가 시 스케줄러와 타임라인 기능을 활용하여:
- 플래너의 시간 설정(학습시간, 자율학습시간 등) 활용
- Best Fit 알고리즘을 통한 효율적인 시간 배정
- 기존에 생성된 플랜의 타임라인을 고려하여 시간 겹침 방지
- 블록 세트, 학원일정, 제외일 고려

---

## 구현 완료 상태

### Phase 1: 플래너 스케줄러 통합 모듈 ✅ 완료

#### 생성된 파일

| 파일 | 역할 |
|------|------|
| `lib/domains/admin-plan/actions/planCreation/existingPlansQuery.ts` | 기존 플랜 시간 정보 조회 |
| `lib/domains/admin-plan/actions/planCreation/timelineAdjustment.ts` | 타임라인 조정 (기존 플랜 시간 제외) |
| `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts` | 플래너 기반 스케줄 생성 |
| `lib/domains/admin-plan/actions/planCreation/singleDayScheduler.ts` | 단일 날짜 스케줄링 |
| `lib/domains/admin-plan/actions/planCreation/validatePlanner.ts` | 플래너 유효성 검증 |
| `lib/domains/admin-plan/actions/planCreation/types.ts` | 타입 정의 |
| `lib/domains/admin-plan/actions/timeManagement.ts` | 시간 관리 유틸리티 |
| `lib/domains/admin-plan/utils/durationCalculator.ts` | 소요시간 계산 |
| `lib/domains/admin-plan/utils/planGroupSelector.ts` | 플랜 그룹 선택 |

---

### Phase 2: 1730 Timetable 방법론 준수 ✅ 완료

#### Phase 2-1: Today 모드 스케줄러 통합 (기존 완료)

- `calculateAvailableDates`에서 Today 모드 스케줄러 호출
- `lib/plan/scheduler.ts` → `generate1730TimetablePlans` 활용

#### Phase 2-2: SchedulerEngine 개선 ✅ 완료

**커밋**: `32a65184`

| 변경 내용 | 파일 |
|-----------|------|
| `ExistingPlanInfo` 인터페이스 추가 | `lib/scheduler/SchedulerEngine.ts` |
| `calculateUsedTimeForSlot` 헬퍼 메서드 | `lib/scheduler/SchedulerEngine.ts` |
| `slotAvailability` 초기화 시 기존 플랜 반영 | `lib/scheduler/SchedulerEngine.ts` |
| `existingPlans` 파라미터 추가 | `lib/plan/scheduler.ts` |
| `createPlanFromContent`에서 existingPlans 전달 | `lib/domains/admin-plan/actions/createPlanFromContent.ts` |

```typescript
// lib/scheduler/SchedulerEngine.ts
export interface ExistingPlanInfo {
  date: string;
  start_time: string;
  end_time: string;
}

export type SchedulerContext = {
  // ... 기존 필드
  existingPlans?: ExistingPlanInfo[];  // 추가됨
};
```

---

### Phase 3: DailyDock 타임라인 통합 ✅ 완료

**커밋**: `32a65184`

#### 구현 내용

| 변경 내용 | 파일 |
|-----------|------|
| `DailyPlan` 타입에 시간 필드 추가 | `lib/query-options/adminDock.ts` |
| `DailyDockTimeline` 컴포넌트 생성 (신규) | `app/.../DailyDockTimeline.tsx` |
| DailyDock에 타임라인 통합 | `app/.../DailyDock.tsx` |
| PlanItemCard에 `showTime` prop 적용 | `app/.../items/PlanItemCard.tsx` |

```typescript
// lib/query-options/adminDock.ts
export interface DailyPlan {
  // ... 기존 필드
  start_time: string | null;       // 추가됨
  end_time: string | null;         // 추가됨
  estimated_minutes: number | null; // 추가됨
}
```

---

### Phase 4: 플래너 UI 컴포넌트 ✅ 완료

**커밋**: `b0508d13`

#### 생성된 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| `PlannerHeader.tsx` | 플래너 헤더 (제목, 기간, 상태) |
| `PlannerStats.tsx` | 플래너 통계 (진행률, 완료율) |
| `PlanTypeStats.tsx` | 플랜 유형별 통계 |
| `PlannerSelectionPage.tsx` | 플래너 선택 페이지 |
| `PlannerSelector.tsx` | 플래너 선택 드롭다운 |
| `PlannerTimeline.tsx` | 플래너 타임라인 시각화 |

#### 생성된 API

| API | 역할 |
|-----|------|
| `/api/admin/planners/[plannerId]/schedule` | 플래너 스케줄 조회 |

---

### Phase 5: 위자드 개선 ✅ 완료

**커밋**: `daffb17e`

#### 개선 내용

| 컴포넌트 | 변경 내용 |
|----------|----------|
| `AddContentWizard` | 플래너 연동, 스케줄러 통합 |
| `AdminPlanCreationWizard7Step` | 7단계 위자드 개선 |
| `Step2TimeSettings` | 시간 설정 UI 개선 |
| `Step4ContentSelection` | 콘텐츠 선택 개선 |
| `MasterContentSearchModal` | 검색 기능 강화 |

---

### 버그 수정 ✅ 완료

#### getFilteredPlans 플래너 필터링

**커밋**: `4ef34c7c`

| 변경 내용 | 파일 |
|-----------|------|
| `plannerId` 파라미터 추가 | `lib/domains/admin-plan/actions/filter.ts` |
| `plan_groups` 조인으로 플래너 필터링 구현 | `lib/domains/admin-plan/actions/filter.ts` |

```typescript
export interface PlanFilterParams {
  studentId: string;
  plannerId?: string;  // 추가됨
  // ...
}
```

#### BulkRedistributeModal 스크롤 문제

**상태**: 이미 수정 완료됨 (Flexbox 레이아웃 적용됨)

---

## 커밋 히스토리

| 커밋 | 내용 | 날짜 |
|------|------|------|
| `c4dc5902` | 문서 업데이트 | 2026-01-08 |
| `daffb17e` | 위자드 개선 및 플랜 관리 컴포넌트 | 2026-01-08 |
| `b0508d13` | 플래너 UI 컴포넌트 및 API 추가 | 2026-01-08 |
| `1309244a` | 플래너 스케줄러 통합 모듈 추가 | 2026-01-08 |
| `4ef34c7c` | getFilteredPlans 플래너 필터링 | 2026-01-08 |
| `32a65184` | 1730 Timetable Phase 3 + Phase 4 | 2026-01-08 |

---

## 핵심 파일 경로

```
lib/domains/admin-plan/actions/
├── createPlanFromContent.ts              # 메인 함수
├── createAutoContentPlanGroup.ts         # 플랜 그룹 자동 생성
├── filter.ts                             # 필터링 (plannerId 지원)
├── timeManagement.ts                     # 시간 관리 유틸리티
├── index.ts                              # export 정의
└── planCreation/
    ├── index.ts                          # 서브모듈 export
    ├── types.ts                          # 타입 정의
    ├── validatePlanner.ts                # 플래너 검증
    ├── existingPlansQuery.ts             # 기존 플랜 조회
    ├── timelineAdjustment.ts             # 타임라인 조정
    ├── scheduleGenerator.ts              # 스케줄 생성
    └── singleDayScheduler.ts             # 단일 날짜 스케줄링

lib/scheduler/
└── SchedulerEngine.ts                    # Best Fit 알고리즘 (ExistingPlanInfo 지원)

lib/plan/
└── scheduler.ts                          # generatePlansFromGroup (existingPlans 지원)

lib/query-options/
└── adminDock.ts                          # DailyPlan 타입 (시간 필드 포함)

app/(admin)/admin/students/[id]/plans/_components/
├── DailyDock.tsx                         # 타임라인 통합
├── DailyDockTimeline.tsx                 # 타임라인 시각화 (신규)
├── PlannerHeader.tsx                     # 플래너 헤더 (신규)
├── PlannerStats.tsx                      # 플래너 통계 (신규)
├── PlanTypeStats.tsx                     # 플랜 유형 통계 (신규)
├── PlannerSelectionPage.tsx              # 플래너 선택 (신규)
└── items/PlanItemCard.tsx                # showTime 지원

components/plan/
├── PlannerSelector.tsx                   # 플래너 선택 (신규)
└── PlannerTimeline.tsx                   # 플래너 타임라인 (신규)
```

---

## 테스트 체크리스트

### 기능 검증

- [x] period 모드로 콘텐츠 추가 시 스케줄러 적용됨
- [x] 기존 플랜이 있는 날짜에 빈 시간대로 배치됨
- [x] 플래너의 학습시간/블록 세트 설정이 반영됨
- [x] 학원일정/제외일이 고려됨
- [x] DailyDock에 타임라인 바 표시됨
- [x] 플랜 카드에 시작-종료 시간 표시됨
- [x] 플래너 필터링 적용됨

### 빌드 검증

- [x] `pnpm lint` 통과 (수정한 파일에 오류 없음)
- [x] `pnpm build` 성공

---

## 향후 개선 가능 작업

### 선택적 개선

1. **콘텐츠 소요시간 활용**
   - Episode 기반 정확한 duration 계산

2. **UI 개선**
   - 플랜 생성 전 미리보기 기능
   - 기존/신규 플랜 시각적 구분

3. **코드 정리**
   - 타입 정의 통합 (`lib/types/plan/timeline.ts`)
   - 미사용 함수 정리

4. **테스트 코드**
   - Phase 3/4 기능에 대한 단위 테스트 작성

---

**작성자**: Claude Opus 4.5
**최종 업데이트**: 2026-01-08
