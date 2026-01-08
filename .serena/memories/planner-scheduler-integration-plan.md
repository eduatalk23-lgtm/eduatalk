# 플래너 스케줄러/타임라인 통합 개선 프로젝트

## 프로젝트 개요
- **시작일**: 2026-01-15
- **상태**: Phase 2 구현 완료 (2026-01-08)
- **관련 분석 문서**: `docs/2026-01-15-admin-planner-1730-timetable-compliance-check.md`

## 핵심 문제점
1. `createPlanFromContent`가 스케줄러를 사용하지 않음
2. 기존 플랜 타임라인을 고려하지 않아 시간 겹침 발생 가능
3. `AvailabilityService`가 스케줄러와 연계되지 않음

## 확정된 구현 방향
- **함수 전략**: 새 함수 `createPlanFromContentWithScheduler` 추가 후 점진적 마이그레이션
- **구현 범위**: Phase 1만 먼저 (스케줄러 연동 함수)
- **적용 범위**: `period` 모드에만 스케줄러 적용

## Phase 1 작업 파일
### 신규 생성
1. `lib/domains/admin-plan/actions/planCreation/existingPlansQuery.ts`
2. `lib/domains/admin-plan/actions/planCreation/timelineAdjustment.ts`
3. `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts`

### 수정
1. `lib/domains/admin-plan/actions/createPlanFromContent.ts`
2. `lib/domains/admin-plan/actions/index.ts`

## 핵심 함수
- `getExistingPlansForPlanGroup()`: 기존 플랜 시간 정보 조회
- `adjustDateTimeSlotsWithExistingPlans()`: 기존 플랜 시간 제외
- `generateScheduleForPlanner()`: 플래너 기반 스케줄 생성
- `createPlanFromContentWithScheduler()`: 스케줄러 활용 콘텐츠 추가

## Phase 2 작업 파일 (2026-01-08 완료)
### 신규 생성
1. `lib/domains/admin-plan/utils/durationCalculator.ts` - 소요시간 계산
2. `lib/domains/admin-plan/actions/planCreation/singleDayScheduler.ts` - 단일 날짜 Best Fit

### 수정
1. `lib/domains/admin-plan/actions/createPlanFromContent.ts` - useScheduler 옵션 추가
2. `AddContentModal.tsx` / `AddContentWizard.tsx` - UI 체크박스

### 핵심 함수
- `calculateEstimatedMinutes()`: 콘텐츠 타입/볼륨 기반 소요시간 계산
- `findAvailableTimeSlot()`: 단일 날짜 Best Fit 스케줄러

### 설계 결정
- today 모드: useScheduler 체크박스 (opt-in)
- weekly 모드: 유연성 유지 (스케줄러 미적용)
- 실패 시: graceful fallback (시간 없이 생성)

## 참고 파일
- `lib/scheduler/SchedulerEngine.ts`: Best Fit 알고리즘
- `lib/plan/scheduler.ts`: generatePlansFromGroup
- `lib/domains/plan/services/AvailabilityService.ts`: 가용시간 계산 (미연동)
- `lib/domains/admin-plan/actions/createAutoContentPlanGroup.ts`: 플래너 상속
