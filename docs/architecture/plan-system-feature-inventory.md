# 플랜 시스템 기능 인벤토리

> **작성일**: 2026-01-19
> **목적**: 플랜 시스템 통합 시 기능 누락 방지를 위한 체크리스트
> **관련 문서**: [plan-system-unification.md](./plan-system-unification.md)

---

## 1. 학생 플랜 영역

**위치**: `app/(student)/plan/`, `lib/domains/plan/`

### 1.1 플랜 목록 및 조회

- [ ] **플랜 목록 페이지** (`/plan`)
  - FilterBar (목적, 상태, 진행률)
  - PlanGroupListContainer

- [ ] **플랜 그룹 상세** (`/plan/group/[id]`)
  - PlanGroupDetailView
  - PlanGroupDetailTabs
  - 논리 플랜, 실행 현황 확인

- [ ] **플랜 캘린더** (`/plan/calendar`)
  - 일간/주간/월간 캘린더
  - PlanCalendarView

- [ ] **플랜 통계** (`/plan/stats`)
  - 플랜 성과 지표
  - 학습 분석

### 1.2 플랜 생성 및 관리

- [ ] **새 플랜 그룹 생성** (`/plan/new-group`)
  - 7단계 통합 위저드 (PlanGroupWizard)
  - Step 1: BasicInfo (기본 정보)
  - Step 2: SlotMode (시간 설정)
  - Step 3: ContentSelection (콘텐츠 선택)
  - Step 4: Scheduling (스케줄 확인)
  - Step 5: TimeSettings (세부 시간)
  - Step 6: Summary (요약)
  - Step 7: Review (최종 검토)
  - **15개 커스텀 훅** (useAutoSave, usePlanSubmission, usePlanPayloadBuilder, etc.)

- [ ] **플랜 그룹 편집** (`/plan/group/[id]/edit`)

- [ ] **빠른 플랜 생성** (`/plan/quick-create`)
  - 4단계 간소화 플로우
  - ContentPlanGroup

- [ ] **콘텐츠 추가** (`/plan/content-add`, `/plan/content-add/[templateId]`)
  - 기존 그룹에 신규 콘텐츠 추가

- [ ] **그룹 내 콘텐츠 추가** (`/plan/group/[id]/add-content`)

### 1.3 플랜 조정 및 재스케줄링

- [ ] **플랜 재스케줄** (`/plan/group/[id]/reschedule`)
  - RescheduleWizard
  - ConflictWarning
  - SmartDateRangeSuggestions
  - AI 기반 자동 재스케줄
  - 수동 조정

- [ ] **재스케줄 히스토리**
  - RescheduleHistory
  - RollbackButton

- [ ] **플랜 순서 변경** (`updatePlanOrder`)
- [ ] **플랜 범위 조정** (`adjustPlanRanges`)

### 1.4 타임존 및 캘린더 기반 플랜

- [ ] **타임존 목록** (`/plan/timezone`)
- [ ] **타임존 생성** (`/plan/timezone/new`)
- [ ] **타임존 상세** (`/plan/timezone/[id]`)

### 1.5 콘텐츠 관리

- [ ] `linkContentToVirtualPlan` - 가상 플랜에 콘텐츠 연결/변경
- [ ] `updateContentSchedule` - 콘텐츠별 학습 일정 수정
- [ ] `splitContentSchedule` - 콘텐츠 분할
- [ ] `pauseContent` - 콘텐츠 일시정지
- [ ] `resumeContent` - 콘텐츠 재개
- [ ] `setContentPriority` - 콘텐츠 우선순위
- [ ] `getReviewGroups`, `updateReviewGroupDate`, `deleteReviewGroup` - 복습 그룹 관리

### 1.6 플랜 Server Actions

- [ ] `createPlanGroupAction` - 플랜 그룹 신규 생성
- [ ] `savePlanGroupDraftAction` - 임시 저장
- [ ] `copyPlanGroupAction` - 기존 플랜 그룹 복사
- [ ] `updatePlanGroupAction` - 플랜 정보 수정
- [ ] `updatePlanGroupDraftAction` - 임시 저장 수정
- [ ] `deletePlanGroupAction` - 플랜 그룹 삭제
- [ ] `updatePlanGroupStatus` - 플랜 활성화/비활성화/완료 처리
- [ ] `getLogicalPlans`, `createLogicalPlan`, `updateLogicalPlan`, `deleteLogicalPlan` - 가상 플랜 관리
- [ ] `addPlanExclusion`, `deletePlanExclusion`, `getRecurringExclusions` - 제외일 관리
- [ ] `addAcademySchedule`, `updateAcademySchedule`, `deleteAcademySchedule` - 학원 일정 관리

### 1.7 플랜 분석 및 최적화

- [ ] `getReschedulePreview` - 재스케줄 미리보기
- [ ] `getAdaptiveScheduleAnalysis` - 적응형 분석
- [ ] `getWeakSubjectReinforcement` - 약점 과목 강화 추천
- [ ] `calculateScheduleAvailability` - 남은 학습 시간 계산

### 1.8 플랜 조회 쿼리

- [ ] `getPlansByGroupIdAction` - 플랜 그룹의 모든 플랜 조회
- [ ] `getActivePlanGroups` - 활성 플랜 그룹 조회
- [ ] `getContentPlanGroups`, `getTemplatePlanGroups` - 콘텐츠 기반 플랜 그룹 조회

---

## 2. 관리자 플랜 영역

**위치**: `app/(admin)/admin/`, `lib/domains/admin-plan/`

### 2.1 플랜 생성 및 관리

- [ ] **플랜 생성 페이지** (`/admin/plan-creation`)
- [ ] **플랜 그룹 상세** (`/admin/plan-groups/[id]`)
  - Markdown 내보내기
  - 템플릿 통계
- [ ] **학생 상세 페이지** (`/admin/students/[id]/plans`)
  - 실제 플랜 생성 위저드 실행

### 2.2 통합 플랜 생성 (Unified Pipeline)

- [ ] `createUnifiedPlan` - 새로운 통합 파이프라인으로 플랜 생성
- [ ] `createUnifiedAdhocPlan` - 즉시 실행 가능한 일회성 플랜 생성
- [ ] `ensurePlanGroup` - 필요시 플랜 그룹 자동 생성

### 2.3 Ad-hoc 플랜 (레거시)

- [ ] `createAdHocPlan` (Deprecated → `createUnifiedPlan` 사용 권장)
- [ ] `updateAdHocPlan`
- [ ] `deleteAdHocPlan`
- [ ] `updateAdHocPlanStatus`

### 2.4 AI 플랜 생성

- [ ] `generateBatchPlansWithAI` - 여러 학생의 플랜 일괄 생성
- [ ] `estimateBatchPlanCost` - 배치 생성 비용 계산
- [ ] `getStudentsContentsForBatch` - 배치 생성용 학생/콘텐츠 조회
- [ ] `saveAIGeneratedPlansAction` - AI 플랜 DB 저장
- [ ] `transformLLMResponseToPlans` - LLM 응답 변환

### 2.5 콘텐츠 관리

- [ ] `getStudentContentsForAdmin` - 학생 보유 콘텐츠 조회
- [ ] `getStudentContentsForAIPlanAction` - AI 플랜용 정보
- [ ] `getFlexibleContents`, `getFlexibleContent`, `createFlexibleContent`, `updateFlexibleContent`, `deleteFlexibleContent` - 유연 콘텐츠
- [ ] `linkMasterContent`, `unlinkMasterContent` - 마스터 콘텐츠 연결

### 2.6 플랜 이동 및 복사

- [ ] `movePlansToGroup` - 플랜을 다른 그룹으로 이동
- [ ] `copyPlansToDate` - 플랜을 다른 날짜로 복사
- [ ] `createPlanFromContent` - 특정 콘텐츠로부터 플랜 생성

### 2.7 플랜 편집 및 필터링

- [ ] `getStudentPlanForEdit` - 수정할 플랜 상세 조회
- [ ] `adminUpdateStudentPlan` - 관리자가 플랜 정보 수정
- [ ] `adminBulkUpdatePlans` - 여러 플랜 동시 수정
- [ ] `getFilteredPlans` - 조건별 플랜 검색
- [ ] `getStudentSubjects` - 학생이 학습 중인 과목 목록

### 2.8 Planner (학습 계획자) 관리

- [ ] `createPlannerAction` - 플래너 생성
- [ ] `getPlannerAction` - 플래너 조회
- [ ] `getStudentPlannersAction` - 학생 플래너 목록
- [ ] `updatePlannerAction` - 플래너 수정
- [ ] `deletePlannerAction` - 플래너 삭제
- [ ] `updatePlannerStatusAction` - 플래너 상태 변경
- [ ] `addPlannerExclusionAction`, `removePlannerExclusionAction`, `setPlannerExclusionsAction` - 제외일 관리
- [ ] `addPlannerAcademyScheduleAction`, `removePlannerAcademyScheduleAction`, `setPlannerAcademySchedulesAction` - 학원 일정 관리

### 2.9 시간 관리

- [ ] `addStudentAcademyScheduleForAdmin` - 관리자가 학생 시간표 설정
- [ ] `addStudentExclusionForAdmin` - 관리자가 학생 제외일 설정

### 2.10 플랜 이벤트 및 로깅

- [ ] `createPlanEvent`, `createPlanEvents`, `generateCorrelationId` - 이벤트 기록
- [ ] `getPlanEvents`, `getPlanGroupEventHistory`, `getStudentRecentEvents` - 이벤트 히스토리
- [ ] `getCorrelatedEvents`, `getEventStats` - 관련 이벤트 및 통계
- [ ] `logPlanCompleted`, `logVolumeAdjusted`, `logPlanCreated` - 특정 이벤트 로깅

### 2.11 Carry-over (계획 이월)

- [ ] `runCarryoverForStudent` - 미완료 플랜 이월
- [ ] `runBulkCarryover` - 대량 이월
- [ ] `getCarryoverPreview` - 이월 미리보기

### 2.12 컨테이너 관리

- [ ] `movePlanToContainer` - 플랜을 컨테이너로 이동
- [ ] `deletePlanWithLogging` - 로깅과 함께 플랜 삭제

### 2.13 플랜 템플릿 및 블록 세트

- [ ] `getTemplatePlanGroups` - 템플릿 기반 플랜 그룹 조회
- [ ] `blockSets` - 시간 블록 세트 관리

### 2.14 플랜 삭제 관리

- [ ] `getDeletedPlans`, `getDeletedPlanGroups` - 삭제된 플랜 조회
- [ ] `restorePlanGroup` - 삭제된 플랜 그룹 복원

### 2.15 플랜 품질 분석

- [ ] `analyzePlanQuality` - 생성된 플랜 품질 평가
- [ ] `batchPreviewPlans` - 여러 플랜 미리보기

---

## 3. 캠프 영역

**위치**: `lib/domains/camp/`

### 3.1 캠프 기본 관리

- [ ] **캠프 CRUD** (`crud.ts`)
  - `createCampTemplateAction`
  - `updateCampTemplateAction`
  - `deleteCampTemplateAction`
  - `getCampTemplateAction`

- [ ] **캠프 참여자** (`participants.ts`)
  - `sendCampInvitationsAction` - 초대 발송
  - `getCampParticipantsAction` - 참여자 조회

### 3.2 캠프 학습 추적

- [ ] `progress` - 캠프 학습 진행률 조회
- [ ] `progress/wizard` - 학습 진행 상황 업데이트
- [ ] `progress/status` - 상태 변경
- [ ] `progress/bulk` - 여러 학생 진행 상황 일괄 업데이트
- [ ] `progress/review` - 캠프 진행 상황 리뷰

### 3.3 캠프 콘텐츠 및 일정

- [ ] `contentService` - 캠프 내 콘텐츠 관리
- [ ] `slotPresets` - 캠프 시간 슬롯 프리셋 관리
- [ ] `reschedule` - 캠프 학습 일정 조정

### 3.4 캠프 블록 세트

- [ ] `blockSets` - 캠프 시간 블록 세트 관리

### 3.5 학생 캠프 액션

- [ ] `submitCampParticipation` - 캠프 참여 제출
- [ ] `getCampInvitationWithTemplate` - 템플릿 데이터 조회

---

## 4. Today/실행 영역

**위치**: `app/(student)/today/`, `lib/domains/today/`

### 4.1 타이머 기능

- [ ] `startPlan`, `startTimer` - 플랜 학습 시작
- [ ] `endTimer`, `completePlan` - 학습 일시 정지 및 완료
- [ ] `pausePlan`, `resumePlan` - 진행 중인 학습 일시정지/재개
- [ ] `postponePlan` - 학습 연기
- [ ] `resetPlanTimer` - 타이머 초기화

### 4.2 학습 완료 프로세스

- [ ] `preparePlanCompletion` - 학습 완료 전 데이터 준비
- [ ] `completePlan` - 학습 최종 완료 처리

### 4.3 실행 로그 및 분석

- [ ] `getPlanExecutionLogs`, `getTodayExecutionSummary` - 학습 실행 이력 조회
- [ ] `logPlanExecutionEvent`, `logTimerEvent` - 학습 이벤트 기록

### 4.4 메모 및 피드백

- [ ] `getPlanMemo` - 학습 중 작성한 메모 조회
- [ ] `savePlanMemo` - 학습 메모 저장

### 4.5 플랜 관리 (Today 뷰)

- [ ] `updatePlanOrder` - Today 뷰에서 플랜 순서 변경
- [ ] `adjustPlanRanges` - 플랜 학습량 실시간 조정
- [ ] `getTimeEventsByPlanNumber` - 플랜별 세션 시간 조회

### 4.6 다중 기기 동기화

- [ ] `checkDeviceConflict` - 다른 기기에서 실행 중인지 확인
- [ ] `updateSessionHeartbeat` - 현재 기기 세션 유지
- [ ] `takeoverSession` - 다른 기기 세션 강제 종료 후 인수
- [ ] `setSessionDeviceInfo` - 현재 기기 정보 저장

### 4.7 컨테이너 플랜

- [ ] `getTodayContainerPlans` - 보관 중인 플랜 조회
- [ ] `moveToDaily` - 컨테이너에서 오늘 일정으로 이동
- [ ] `moveToWeekly` - 컨테이너에서 주간 일정으로 이동
- [ ] `processEndOfDay` - 하루 종료 시 미완료 플랜 처리
- [ ] `reorderContainerPlans` - 드래그앤드롭 재정렬

### 4.8 Server Time 동기화

- [ ] `getServerTime` - 클라이언트 시간 동기화
- [ ] `syncTimerProgress` - 타이머 진행 상황 동기화

### 4.9 Ad-hoc 플랜 실행

- [ ] `startAdHocPlan` - Ad-hoc 플랜 학습 시작
- [ ] `completeAdHocPlan` - Ad-hoc 플랜 학습 완료
- [ ] `cancelAdHocPlan` - Ad-hoc 플랜 취소
- [ ] `getAdHocPlanStatus` - 현재 진행 중인 Ad-hoc 플랜 상태

---

## 5. 공통 서비스

**위치**: `lib/domains/plan/services/`, `lib/plan/`

### 5.1 일정 생성 및 스케줄러

- [ ] `adaptiveScheduler` - 학생 학습 패턴 분석 후 최적 일정 생성
- [ ] `intelligentSchedulingOrchestrator` - 여러 제약 조건 통합 고려 일정 생성
- [ ] `AutoSlotPlacementService` - 콘텐츠를 시간 슬롯에 자동 배치
- [ ] `AvailabilityAwarePlacementService` - 학생 가용 시간 고려 배치
- [ ] `AvailabilityService` - 학습 가능 시간 계산
- [ ] `1730TimetableLogic` - 6+1 학습/복습 주기 로직

### 5.2 충돌 해결 및 유효성 검사

- [ ] `conflictResolver` - 일정 충돌 자동 해결
- [ ] `planValidationService` - 생성된 플랜 유효성 검증
- [ ] `slotValidationService` - 슬롯 기반 일정 유효성 검증
- [ ] `contentValidation` - 콘텐츠 데이터 검증

### 5.3 학습 분석 및 예측

- [ ] `progressCalculator` - 플랜 진행률 계산 및 통계
- [ ] `learningPacePredictor` - 학생 학습 속도 예측
- [ ] `delayPredictionService` - 학습 지연 위험도 예측
- [ ] `fatigueModelingService` - 학생 피로도 분석
- [ ] `dynamicDifficultyService` - 학생 수준에 맞춰 난이도 동적 조정
- [ ] `learningWeightService` - 과목별/유형별 학습 가중치 계산
- [ ] `realtimeFeedbackService` - 학습 중 실시간 피드백 제공

### 5.4 LLM 및 AI 서비스

- [ ] `coldStart/pipeline` - 학습 이력 없는 신규 학생을 위한 콘텐츠 추천
- [ ] `unifiedPlanGeneration/pipeline` - AI를 활용한 학습 플랜 생성
- [ ] `llmCacheService` - LLM 응답 캐싱
- [ ] `aiUsageLogger` - AI 활용 내역 기록
- [ ] `providerSelectionService` - 최적 LLM 공급자 선택
- [ ] `tokenOptimizationService` - LLM 토큰 사용량 최적화

### 5.5 데이터 관리

- [ ] `planPayloadBuilder` - 스케줄러 입력용 플랜 데이터 구성
- [ ] `cacheInvalidation` - React Query 캐시 관리
- [ ] `planGroupDeletion` - 플랜 그룹 소프트 삭제 처리
- [ ] `exclusionProcessor` - 제외일 일정 처리
- [ ] `schedulerOptionsBuilder` - 스케줄러 옵션 구성

### 5.6 Repository & Service (Server-only)

- [ ] `repository.ts` - 데이터베이스 접근 계층
- [ ] `service.ts` - 비즈니스 로직 구현
- [ ] `transactions.ts` - 원자적 연산 (PostgreSQL RPC)

---

## 6. 데이터 레이어

**위치**: `lib/data/`, `lib/query-options/`

### 6.1 플랜 그룹 데이터

- [ ] `getPlanGroupsForStudent()` - 학생의 플랜 그룹 조회
- [ ] `getPlanGroupWithDetails()` - 플랜 그룹 + 콘텐츠 + 제외일 + 학원일정 조회
- [ ] `getPlanGroupWithDetailsForAdmin()` - 관리자용 조회

### 6.2 플랜 데이터

- [ ] `getPlansForStudent()` - 학생의 플랜 목록 조회
- [ ] `getAdHocPlansForCalendar()` - 일회성 플랜 조회

### 6.3 쿼리 옵션 (React Query)

- [ ] `planGroupsQueryOptions()` - 플랜 그룹 쿼리 설정
- [ ] `blockSetsQueryOptions()` - 블록 세트 쿼리 설정
- [ ] `studentContentsQueryOptions()` - 학생 보유 콘텐츠 쿼리 설정

---

## 7. 페이지 라우팅 정리

### 7.1 학생 플랜 경로

```
/plan                          - 플랜 목록
/plan/new-group               - 새 플랜 생성 (7단계 위자드)
/plan/create                  - 레거시 (리다이렉트)
/plan/quick-create            - 빠른 플랜 생성
/plan/group/[id]              - 플랜 상세
/plan/group/[id]/edit         - 플랜 편집
/plan/group/[id]/reschedule   - 재스케줄
/plan/group/[id]/add-content  - 콘텐츠 추가
/plan/content-add             - 콘텐츠 추가 (캘린더)
/plan/content-add/[templateId] - 템플릿 기반 추가
/plan/calendar                - 캘린더 뷰
/plan/adjust                  - 일정 조정
/plan/timezone                - 타임존 목록
/plan/timezone/new            - 타임존 생성
/plan/timezone/[id]           - 타임존 상세
/plan/stats                   - 통계 페이지
```

### 7.2 관리자 플랜 경로

```
/admin/plan-creation          - 플랜 생성 (리다이렉트)
/admin/plan-groups/[id]       - 플랜 그룹 상세
/admin/students/[id]/plans    - 학생 플랜 관리
```

### 7.3 캠프 경로

```
/camp                         - 캠프 초대 목록
/camp/[invitationId]          - 캠프 상세 → 위자드
/camp/[invitationId]/submitted - 제출 완료
/camp/calendar                - → /plan/calendar로 리다이렉트
/camp/today                   - → /today로 리다이렉트
```

### 7.4 Today 경로

```
/today                        - 메인 Today 페이지
/today/plan/[planId]          - 플랜 상세 실행
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-19 | 초안 작성 |
