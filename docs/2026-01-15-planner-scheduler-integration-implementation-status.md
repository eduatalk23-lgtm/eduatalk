# 플래너 스케줄러/타임라인 통합 - 구현 상태 문서

**작성일**: 2026-01-15
**목적**: 새 채팅 세션에서 개선 작업을 이어서 진행할 수 있도록 현재 상태 문서화

---

## 프로젝트 개요

플래너 콘텐츠 추가 시 스케줄러와 타임라인 기능을 활용하여:
- 플래너의 시간 설정(학습시간, 자율학습시간 등) 활용
- Best Fit 알고리즘을 통한 효율적인 시간 배정
- 기존에 생성된 플랜의 타임라인을 고려하여 시간 겹침 방지
- 블록 세트, 학원일정, 제외일 고려

---

## 현재 구현 상태

### Phase 1: 완료 ✅

#### 생성된 파일 (3개)

| 파일 | 역할 |
|------|------|
| `lib/domains/admin-plan/actions/planCreation/existingPlansQuery.ts` | 기존 플랜 시간 정보 조회 |
| `lib/domains/admin-plan/actions/planCreation/timelineAdjustment.ts` | 타임라인 조정 (기존 플랜 시간 제외) |
| `lib/domains/admin-plan/actions/planCreation/scheduleGenerator.ts` | 플래너 기반 스케줄 생성 |

#### 수정된 파일 (3개)

| 파일 | 변경 내용 |
|------|----------|
| `lib/domains/admin-plan/actions/createPlanFromContent.ts` | `createPlanFromContentWithScheduler()` 함수 추가 |
| `lib/domains/admin-plan/actions/planCreation/index.ts` | 새 모듈 export 추가 |
| `lib/domains/admin-plan/actions/index.ts` | 새 함수 export 추가 |

#### 구현된 함수 목록

```typescript
// existingPlansQuery.ts
getExistingPlansForPlanGroup(planGroupId, periodStart, periodEnd)
getExistingPlansForStudent(studentId, periodStart, periodEnd)
groupExistingPlansByDate(existingPlans)

// timelineAdjustment.ts
adjustDateTimeSlotsWithExistingPlans(dateTimeSlots, existingPlansByDate)
adjustDateAvailableTimeRangesWithExistingPlans(dateAvailableTimeRanges, existingPlansByDate)
subtractTimeRange(base, exclude)
timeToMinutes(time)
minutesToTime(minutes)
calculateTotalAvailableMinutes(timeSlots)
canPlacePlanOnDate(dateTimeSlots, date, requiredMinutes)

// scheduleGenerator.ts
generateScheduleForPlanner(plannerId, periodStart, periodEnd)
generateScheduleForPlanGroup(planGroupId)

// createPlanFromContent.ts
createPlanFromContentWithScheduler(input) // 새로 추가
```

---

## 핵심 로직 설명

### `createPlanFromContentWithScheduler` 플로우

```
1. period 모드가 아니면 → 기존 createPlanFromContent 호출
2. 플랜 그룹 자동 생성 (createAutoContentPlanGroupAction)
3. 플래너 기반 스케줄 생성 (generateScheduleForPlanner)
   - calculateAvailableDates 호출
   - dateTimeSlots, dateAvailableTimeRanges 추출
4. 기존 플랜 조회 (getExistingPlansForStudent)
5. 기존 타임라인 반영 (adjustDateTimeSlotsWithExistingPlans)
   - 기존 플랜 시간을 학습시간 슬롯에서 제외
6. generatePlansFromGroup으로 Best Fit 알고리즘 적용
7. 스케줄러가 플랜을 생성하지 못하면 → 기존 로직으로 fallback
8. 플랜 저장
```

---

## 미완료 작업

### Phase 2: SchedulerEngine 개선 (선택)

- `SchedulerContext`에 `existingPlans` 필드 추가
- `generateStudyDayPlans`에서 기존 플랜 반영
- `slotAvailability` 초기화 시 기존 플랜 시간 반영

**파일**: `lib/scheduler/SchedulerEngine.ts`

### Phase 3: 선택적 개선 (선택)

1. **콘텐츠 소요시간 활용**
   - Episode 기반 정확한 duration 계산

2. **UI 개선**
   - 플랜 생성 전 미리보기 기능
   - 기존/신규 플랜 시각적 구분

3. **코드 정리**
   - 타입 정의 통합 (`lib/types/plan/timeline.ts`)
   - 미사용 함수 정리 (`buildPlanTimeline`)

---

## 테스트 방법

### 기능 검증 체크리스트

- [ ] period 모드로 콘텐츠 추가 시 스케줄러 적용됨
- [ ] 기존 플랜이 있는 날짜에 빈 시간대로 배치됨
- [ ] 플래너의 학습시간/블록 세트 설정이 반영됨
- [ ] 학원일정/제외일이 고려됨
- [ ] 스케줄러 실패 시 기존 로직으로 fallback됨

### 회귀 테스트 체크리스트

- [ ] today 모드 정상 동작 (기존 로직)
- [ ] weekly 모드 정상 동작 (기존 로직)
- [ ] 기존 createPlanFromContent 호출부 정상 동작

### 수동 테스트 시나리오

1. 관리자 페이지에서 플래너 선택
2. 콘텐츠 추가 → period 모드 선택
3. 기간 설정 후 생성
4. 캘린더에서 타임라인 확인
5. 기존 플랜이 있는 날짜에 새 콘텐츠 추가 → 빈 시간대에 배치 확인

---

## 알려진 이슈

### 무관한 빌드 오류

```
lib/coaching/getWeeklyMetrics.ts
- Line 138: the name `studyTime` is defined multiple times
- Line 165: the name `goalStatus` is defined multiple times
```

이 오류는 기존 코드의 문제로 이번 변경과 무관합니다.

---

## 관련 참조 문서

1. **종합 분석 문서**: `docs/2026-01-15-planner-scheduler-timeline-comprehensive-analysis.md`
2. **Serena 메모리**: `planner-scheduler-integration-plan`
3. **계획 파일**: `/Users/johyeon-u/.claude/plans/piped-stargazing-trinket.md`

---

## 새 채팅에서 작업 이어가기

### 시작 프롬프트 예시

```
플래너 스케줄러/타임라인 통합 개선 작업을 이어서 진행해주세요.

현재 상태:
- Phase 1 완료: createPlanFromContentWithScheduler 함수 구현됨
- 관련 문서: docs/2026-01-15-planner-scheduler-integration-implementation-status.md

다음 작업:
- [원하는 작업 선택]
  1. Phase 2 진행 (SchedulerEngine 개선)
  2. 테스트 작성
  3. UI 연결 (호출부 변경)
  4. 기타 개선
```

### 컨텍스트 확인 명령

```
# Serena 메모리 확인
mcp__serena__read_memory("planner-scheduler-integration-plan")

# 구현 상태 문서 확인
Read docs/2026-01-15-planner-scheduler-integration-implementation-status.md

# 새 함수 확인
Read lib/domains/admin-plan/actions/createPlanFromContent.ts
```

---

## 핵심 파일 경로 요약

```
lib/domains/admin-plan/actions/
├── createPlanFromContent.ts              # 메인 함수 (신규 함수 추가됨)
├── createAutoContentPlanGroup.ts         # 플랜 그룹 자동 생성
├── index.ts                              # export 정의
└── planCreation/
    ├── index.ts                          # 서브모듈 export
    ├── types.ts                          # 타입 정의
    ├── validatePlanner.ts                # 플래너 검증
    ├── existingPlansQuery.ts             # 기존 플랜 조회 (신규)
    ├── timelineAdjustment.ts             # 타임라인 조정 (신규)
    └── scheduleGenerator.ts              # 스케줄 생성 (신규)

lib/scheduler/
└── SchedulerEngine.ts                    # Best Fit 알고리즘 (Phase 2 대상)

lib/plan/
├── scheduler.ts                          # generatePlansFromGroup
└── planDataLoader.ts                     # extractScheduleMaps
```

---

**작성자**: Claude
**최종 업데이트**: 2026-01-15
