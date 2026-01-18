# 스케줄 미리보기 최적화 작업 완료

**작업 일자**: 2025-02-02  
**작업 범위**: 스케줄 미리보기 컴포넌트 성능 최적화

## 개요

스케줄 미리보기 컴포넌트의 성능을 개선하기 위해 가상 스크롤링, 메모이제이션, React Query 최적화 등을 단계적으로 적용했습니다.

## 구현된 최적화

### Phase 1: 즉시 적용 가능한 최적화 (High Impact)

#### 1.1 가상 스크롤링 적용
**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

- 기존 `VirtualizedList` 컴포넌트 활용
- 주차 정보가 없는 경우 가상 스크롤링 적용
- 아이템 높이: 120px (기본값)
- 컨테이너 높이: 800px

**주요 변경사항**:
- `dailySchedule.map()` → `VirtualizedList` 사용
- `sortedSchedules` 메모이제이션 추가

#### 1.2 컴포넌트 메모이제이션 강화
**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

- `ScheduleItem` 컴포넌트를 `React.memo`로 감싸기
- `TimeSlotsWithPlans` 컴포넌트 메모이제이션
- `PlanTable` 컴포넌트 메모이제이션
- 커스텀 비교 함수로 불필요한 재렌더링 방지

**비교 함수 로직**:
- `schedule.date`, `isExpanded`, `datePlans.length`, `sequenceMap.size` 등 주요 속성만 비교

#### 1.3 React Query 옵션 최적화
**파일**: `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`

- `refetchOnWindowFocus: false` 추가
- `refetchOnMount: false` 추가
- `refetchOnReconnect: false` 추가

**효과**: 불필요한 자동 재요청 방지로 네트워크 트래픽 감소

#### 1.4 확장/축소 상태 최적화
**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

- `Set<string>` → `Map<string, boolean>` 변경
- `toggleDate` 함수를 `useCallback`으로 메모이제이션
- `ScheduleListByWeek`, `WeekSection` 타입 정의 업데이트

**효과**: 상태 업데이트 성능 개선

### Phase 2: 중기 개선 (Medium Impact)

#### 2.1 플랜 배치 로직 메모이제이션
**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

- `TimeSlotsWithPlans` 내부의 복잡한 계산 로직을 `useMemo`로 감싸기
- `studyTimeSlots`, `travelAndAcademySlots` 필터링 메모이제이션
- `plansWithInfo` 배열 생성 메모이제이션
- `sortedPlans` 정렬 결과 캐싱
- `slotPlansMap` 계산 결과 메모이제이션
- `remainingTimeSlotsMap` 계산 결과 메모이제이션
- `travelAndAcademyPlansMap` 계산 결과 메모이제이션
- `studySlotIndexMap`, `travelAndAcademySlotIndexMap` 메모이제이션

**효과**: 플랜 배치 계산 시간 대폭 감소

#### 2.2 주차별 그룹화 최적화
**파일**: `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

- `weeklySchedules` 계산 결과 메모이제이션 강화
- `calculateTimeFromSlots` 함수를 `useCallback`으로 메모이제이션
- `toggleWeek` 함수를 `useCallback`으로 메모이제이션

**효과**: 주차별 통계 계산 성능 개선

#### 2.3 지연 로딩 (Intersection Observer)
**파일**: `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

- 주차별 섹션에 Intersection Observer 적용
- 화면에 보이기 전 200px 전에 미리 로드
- 확장되지 않은 주차는 통계만 표시
- `visibleWeeks` 상태로 렌더링 최적화

**효과**: 초기 렌더링 시간 감소, 메모리 사용량 감소

## 예상 성능 개선

- **초기 렌더링**: 50-70% 감소 (가상 스크롤링)
- **스크롤 성능**: 80-90% 개선
- **메모리 사용**: 60-80% 감소
- **재렌더링**: 70-85% 감소 (메모이제이션)

## 변경된 파일 목록

1. `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
   - 가상 스크롤링 적용
   - 컴포넌트 메모이제이션 강화
   - 확장/축소 상태 최적화
   - 플랜 배치 로직 메모이제이션

2. `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`
   - React Query 옵션 최적화

3. `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`
   - 주차별 그룹화 최적화
   - 지연 로딩 구현

## 향후 개선 사항 (Phase 3 - 선택적)

### 3.1 동적 높이 가상 스크롤링
- `@tanstack/react-virtual` 라이브러리 도입 검토
- 아이템 높이 변동이 심한 경우 적용

### 3.2 Web Worker 분리
- 플랜 수가 1000개 이상인 경우
- 계산 시간이 500ms 이상인 경우

## 주의사항

- 가상 스크롤링 적용 시 스크롤 위치 복원 기능 필요
- 확장/축소 상태 유지 로직 보존
- 접근성 (키보드 네비게이션) 유지
- 모바일 환경 테스트 필수

## 테스트 체크리스트

- [ ] 초기 렌더링 시간 측정
- [ ] 스크롤 성능 테스트
- [ ] 메모리 사용량 확인
- [ ] 재렌더링 횟수 확인 (React DevTools Profiler)
- [ ] 모바일 환경 테스트
- [ ] 접근성 테스트

