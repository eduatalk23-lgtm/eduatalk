# 플랜 시스템 종합 개선 (2025년 12월)

## 1. 플랜그룹 생성 위자드 개선 (Phase 1-4)

### Phase 1: 타입 안전성 및 오토세이브
- **오토세이브**: 2초 디바운스 자동 저장, `useAutoSave` 훅 + `AutoSaveIndicator` UI
- **매직 넘버 상수화**: `wizardConstants.ts`에 `WIZARD_STEPS`, `STEP_WEIGHTS`, `TIMING` 등 중앙화
- **타입 가드**: `typeGuards.ts` 추가 (`isBaseContent`, `isMasterContent` 등)

### Phase 2: 성능 최적화
- **Context 분리**: 단일 → 3개 분리 (WizardDataContext, WizardStepContext, WizardValidationContext)
  - 리렌더 60-80% 감소
- **동적 임포트**: Step 컴포넌트 lazy loading → 초기 번들 37% 감소
- **LRU 캐시**: 100개 항목, 30분 TTL → 메모리 47% 감소
- **Dirty 상태 디바운스**: 300ms 디바운스 → 불필요한 JSON.stringify 방지

### Phase 3: 코드 구조 개선
- **훅 추출**: `useWizardStepHandlers`, `useStep7Completion`
- **리듀서 분리**: `dataReducer`, `stepReducer`, `validationReducer`

### Phase 4: UX/접근성 개선
- **키보드 네비게이션**: Alt+→/← (단계 이동), Alt+1~7 (직접 이동), Esc (취소)
- **포커스 관리**: 단계 전환 시 자동 포커스, 에러 필드 포커스
- **진행 표시기**: 클릭 가능한 단계 표시, 모바일 컴팩트 모드
- **스켈레톤**: 단계별 맞춤 로딩 UI, 접근성 속성, 다크모드 지원

### 7단계 사용자 흐름
1. **Step 1: 기본 정보** - 플랜 이름, 블록세트, 학습 기간, 요일
2. **Step 2: 블록 및 제외일** - 시간 설정, 학원 스케줄 임포트, 제외일
3. **Step 3: 스케줄 확인** - 주간별 미리보기, 타임라인 시각화
4. **Step 4: 콘텐츠 선택** - 마스터/학생 콘텐츠, 슬롯 모드 (템플릿/캠프 모드 종료점)
5. **Step 5: 추천 콘텐츠** - 추천 패널, 과목 균형 차트
6. **Step 6: 최종 검토** - 콘텐츠 할당, 전략/약점 에디터
7. **Step 7: 결과 확인** - 생성된 플랜 목록, 활성화 다이얼로그

### 모드별 분기
| 모드 | 마지막 단계 | 특징 |
|------|------------|------|
| 일반 모드 | Step 7 | 전체 플로우 |
| 템플릿 모드 | Step 4 | 추천/최종검토/결과 스킵 |
| 캠프 모드 (학생) | Step 4 | 콘텐츠 선택 후 종료 |
| 관리자 모드 | Step 7 | 관리자가 대신 생성 |
| 관리자 continue 모드 | Step 7 | 기존 데이터 이어서 편집 |

### 훅 구조 (15개)
```
[데이터/저장]
├─ useAutoSave, usePlanDraft, usePlanSubmission, usePlanPayloadBuilder

[네비게이션/UX]
├─ useWizardStepHandlers, useWizardNavigation, useWizardScroll
├─ useWizardKeyboardNavigation, useWizardFocusManagement, usePageLeaveGuard

[검증]
├─ useWizardValidation, useFieldPermission

[데이터 페칭]
├─ useContentDataFetcher, usePlanGenerator, useStep7Completion
```

---

## 2. 슬롯 모드 (2단계 콘텐츠 선택 시스템)

### 개요
관리자가 슬롯 템플릿을 구성하면 학생이 슬롯에 콘텐츠를 연결하는 방식

### 주요 컴포넌트
- `SlotTemplateEditor`: 관리자용 슬롯 템플릿 편집
- `Step3SlotModeSelection`: 학생용 슬롯 기반 콘텐츠 선택
- `SlotItem`, `SlotConfigurationPanel`, `ContentLinkingPanel`
- `VirtualTimelinePreview`: 스케줄 시각화
- `SubjectBalanceChart`: 과목 분포 차트
- `SlotAdvancedSettings`: 상세 슬롯 설정

### 슬롯 관계 기능
- 연결 슬롯 (linked slots): 함께 배치
- 배타 슬롯 (exclusive slots): 같은 시간대 배제
- AI 기반 슬롯 추천 (`a323363f`)
- 드래그앤드롭 지원

---

## 3. 컨테이너 기반 플랜 관리 시스템

### 경로
- `app/(student)/today/_components/containers/`
- `lib/domains/today/actions/containerPlans.ts`

### 컨테이너 유형
1. **Unfinished (미완료)**: 이전에 완료하지 못한 플랜
2. **Daily (일간)**: 오늘 해야 할 플랜
3. **Weekly (주간)**: 이번 주 내 해야 할 플랜

### 핵심 컴포넌트
- `ContainerDock`: 컨테이너 도크 UI
- `ContainerPlanItem`: 개별 플랜 아이템 (상태, 액션, 이월 표시)
- `ContainerView`: 메인 오케스트레이터
- `TimelineZone`: 일간 스케줄 시각화

### 핵심 액션
- `getTodayContainerPlans`: 컨테이너별 플랜 조회
- `moveToDaily`: 플랜을 일간 컨테이너로 이동
- `moveToWeekly`: 플랜을 주간 컨테이너로 이동
- `processEndOfDay`: 하루 종료 처리

### 특징
- 우선순위 기반 표시 (Unfinished > Daily > Weekly)
- 플랜 컨테이너 간 이동
- 시각적 이월 추적
- Ad-hoc 플랜 지원
- @dnd-kit 패키지 (드래그앤드롭)

---

## 4. 캠프/일반 플랜 통합 활성화

### 주요 변경 (fd65ac38)
- `allow_normal_plan_activation` 컬럼 추가 (camp_templates)
- 모드 무관 1개 활성 플랜 그룹 제한
- 캠프 중 일반 플랜 활성화 기본 차단 (관리자 설정 가능)
- `/today`, `/plan/calendar` 통합 (모든 플랜 표시)
- `/camp/today` → `/today`, `/camp/calendar` → `/plan/calendar` 리다이렉트

---

## 5. 타이머 상태 머신

### 상태 전이 규칙
```
NOT_STARTED → START → RUNNING
RUNNING → PAUSE → PAUSED
RUNNING → COMPLETE → COMPLETED
PAUSED → RESUME → RUNNING
PAUSED → COMPLETE → COMPLETED
COMPLETED → (terminal state)
```

### 구현
- Zod 기반 `TimerStatusSchema`, `TimerActionSchema`
- `validateTimerTransition()`: 상태 전이 유효성 검사
- `canPerformAction()`, `getAllowedActions()` 헬퍼
- `determineTimerStatus()`: 플랜/세션 데이터에서 상태 도출
- 오프라인 큐 시스템 (`0d216de4`)
- 멀티 디바이스 세션 충돌 감지 (`8c0610f6`)

---

## 6. 이월(Carryover) 시스템

### 경로
- `lib/domains/admin-plan/actions/carryover.ts`

### 핵심 함수
- `getCarryoverPreview`: 이월 미리보기
- `runCarryoverForStudent`: 학생별 이월 실행
- `runBulkCarryover`: 대량 이월 처리

### 관련 액션
- `lib/domains/admin-plan/actions/planEvent.ts`: 플랜 이벤트 관리
- `lib/domains/admin-plan/actions/adHocPlan.ts`: 임시 플랜 생성

---

## 7. 달력형 플랜 관리

### 경로
- `app/(student)/plan/calendar/`
  - `_components/`: DayView, PlanCalendarView, TimelineItem 등
  - `_hooks/`: 캘린더 훅
  - `_utils/`: 유틸리티
  - `_constants/`: 상수
  - `_types/`: 타입 정의

### 특징
- 일간/주간/월간 뷰 지원
- 타임라인 아이템 시각화
- 캠프/일반 플랜 통합 표시

---

## 8. Today 페이지 구조

### 경로
- `app/(student)/today/_components/`

### 주요 컴포넌트
- **플랜 표시**: `PlanItem`, `TodayPlanItem`, `PlanCard`, `PlanGroupCard`
- **타이머**: `PlanTimer`, `PlanTimerCard`, `TimerControls`
- **뷰 모드**: `SinglePlanView`, `DailyPlanView`, `DailyPlanListView`
- **진행률**: `CircularProgress`, `TodayAchievements`
- **컨테이너**: `containers/` (컨테이너 기반 관리)
- **기타**: `PlanSelector`, `ViewModeSelector`, `PlanDateNavigator`

---

## 9. 보안 및 성능 개선

### 보안
- 인증 가드 통합 (`guards.ts`)
- 테넌트 격리 API 엔드포인트
- 동적 권한 관리 시스템
- 감사 로깅 시스템 (`b49e1a2e`)
- 멱등성 키 시스템 (`d7d74246`)
- 원자적 트랜잭션 지원 (`fba97ae6`)

### 성능
- N+1 쿼리 최적화
- 동적 임포트 (Recharts, Step 컴포넌트)
- React 컴포넌트 최적화
- 배치 작업 래퍼 (`1b907b48`)

---

## 10. 아키텍처 요약

```
┌─────────────────────────────────────────────────────────────┐
│                    플랜 시스템 전체 구조                      │
├─────────────────────────────────────────────────────────────┤
│  [플랜 생성]                                                 │
│  └─ 7단계 위자드 (Phase 1-4 개선)                           │
│     └─ 슬롯 모드 / 일반 모드                                │
│                                                             │
│  [플랜 실행]                                                 │
│  ├─ Today 페이지 (컨테이너 기반)                            │
│  ├─ 타이머 상태 머신                                        │
│  └─ 오프라인 큐                                             │
│                                                             │
│  [플랜 관리]                                                 │
│  ├─ 캘린더 뷰 (일간/주간/월간)                              │
│  ├─ 이월 시스템                                             │
│  └─ 캠프/일반 통합 활성화                                   │
│                                                             │
│  [관리자 기능]                                               │
│  ├─ 슬롯 템플릿 편집                                        │
│  ├─ 대량 이월 처리                                          │
│  └─ 권한/감사 시스템                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 관련 파일 경로

```
[위자드]
app/(student)/plan/new-group/_components/

[컨테이너]
app/(student)/today/_components/containers/
lib/domains/today/actions/containerPlans.ts

[캘린더]
app/(student)/plan/calendar/

[관리자]
lib/domains/admin-plan/actions/

[타이머]
lib/store/planTimerStore.ts
lib/domains/today/actions/timer.ts
```

---

*마지막 업데이트: 2025-12-26*
