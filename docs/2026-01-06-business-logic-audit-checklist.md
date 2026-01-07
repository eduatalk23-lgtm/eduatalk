# 비즈니스 로직 점검 체크리스트

**작성일**: 2026-01-06  
**목적**: 비즈니스 로직의 안정성, 일관성, 유지보수성 점검 및 개선 사항 도출

---

## 📋 목차

1. [전체 개요](#1-전체-개요)
2. [트랜잭션 처리](#2-트랜잭션-처리)
3. [데이터 일관성](#3-데이터-일관성)
4. [동시성 제어](#4-동시성-제어)
5. [타입 안전성](#5-타입-안전성)
6. [에러 처리](#6-에러-처리)
7. [비즈니스 규칙 검증](#7-비즈니스-규칙-검증)
8. [성능 및 최적화](#8-성능-및-최적화)
9. [미완료 작업](#9-미완료-작업)
10. [우선순위별 개선 계획](#10-우선순위별-개선-계획)

---

## 1. 전체 개요

### 1.1 점검 범위

이 문서는 다음 영역의 비즈니스 로직을 점검합니다:

- **플랜 생성 및 관리**: 플랜 그룹, 플랜, 단발성 플랜
- **스케줄링**: 1730 타임테이블, 기본 스케줄러
- **학습 세션**: 타이머, 세션 관리
- **성적 관리**: 성적 입력, 분석
- **캠프 관리**: 캠프 생성, 진행 관리
- **배치 처리**: 대량 플랜 생성, 일괄 작업

### 1.2 심각도 분류

| 심각도 | 설명 | 조치 시기 |
|--------|------|----------|
| **🔴 CRITICAL** | 즉시 수정 필요, 데이터 손실/불일치 위험 | 즉시 |
| **🟠 HIGH** | 빠른 시일 내 수정 권장, 사용자 경험에 큰 영향 | 1주일 내 |
| **🟡 MEDIUM** | 중기 개선 권장, 점진적 개선 가능 | 1개월 내 |
| **🟢 LOW** | 장기 개선, 우선순위 낮음 | 3개월 내 |

---

## 2. 트랜잭션 처리

### 2.1 현재 상태

#### ✅ 잘 구현된 부분

1. **원자적 트랜잭션 (RPC 함수)**
   - `create_plan_group_atomic`: 플랜 그룹 생성 시 관련 테이블 모두 트랜잭션 처리
   - `generate_plans_atomic`: 플랜 생성 시 삭제/삽입/상태 업데이트 원자적 처리
   - `complete_plan_atomic`: 플랜 완료 시 세션 종료와 플랜 상태 업데이트 원자적 처리
   - **위치**: `lib/domains/plan/transactions.ts`, `lib/domains/today/transactions.ts`

2. **배치 작업 유틸리티**
   - `withBatchOperations`: 순차 실행 + 에러 추적 + 롤백 힌트
   - `createTransactionContext`: 트랜잭션 컨텍스트 생성
   - **위치**: `lib/supabase/transaction.ts`

3. **재조정 트랜잭션**
   - `executeRescheduleTransaction`: 플랜 그룹 단위 락 획득 후 작업 실행
   - **위치**: `lib/reschedule/transaction.ts`

#### ⚠️ 개선 필요 사항

1. **DELETE → INSERT 패턴 사용** 🟡 MEDIUM

   **위치**: 
   - `lib/domains/camp/actions/student.ts` (745줄, 1070-1073줄, 1178-1181줄)
   - `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts` (504줄)

   **문제**:
   ```typescript
   // 현재: DELETE 후 INSERT (트랜잭션 없음)
   await supabase.from("plan_contents").delete().eq("plan_group_id", groupId);
   await supabase.from("plan_contents").insert(newContents);
   ```

   **위험**:
   - DELETE 성공 후 INSERT 실패 시 데이터 손실
   - 중간 상태에서 다른 요청이 조회하면 데이터 불일치

   **개선 방안**:
   ```typescript
   // 옵션 1: RPC 함수로 트랜잭션 처리
   await supabase.rpc("upsert_plan_contents", {
     p_group_id: groupId,
     p_contents: newContents
   });

   // 옵션 2: 배치 작업으로 순차 실행
   await withBatchOperations([
     { name: "Delete old", execute: () => deleteOld() },
     { name: "Insert new", execute: () => insertNew() }
   ]);
   ```

2. **트랜잭션 범위 불명확** 🟡 MEDIUM

   **위치**: 
   - `lib/domains/plan/llm/actions/generatePlan.ts` (306줄)
   - `lib/domains/admin-plan/actions/planTemplates.ts` (249줄)

   **문제**:
   - 플랜 생성 시 여러 테이블 업데이트가 개별 쿼리로 실행
   - 일부 성공/일부 실패 시 데이터 불일치 가능

   **개선 방안**:
   - `generate_plans_atomic` RPC 함수 사용 또는
   - 배치 작업으로 묶어서 처리

3. **롤백 로직 부재** 🟠 HIGH

   **위치**: `lib/supabase/transaction.ts`

   **문제**:
   - `withBatchOperations`는 롤백 힌트만 제공
   - 실제 롤백은 수동으로 처리해야 함
   - 복잡한 트랜잭션에서 롤백 누락 가능

   **개선 방안**:
   ```typescript
   // 롤백 함수 자동 실행
   const result = await withBatchOperations(operations);
   if (!result.success && result.rollbackIds) {
     await rollbackUpdates(supabase, tableName, result.rollbackIds, rollbackData);
   }
   ```

---

## 3. 데이터 일관성

### 3.1 현재 상태

#### ✅ 잘 구현된 부분

1. **중복 방지**
   - 기간 중복 검증 (`checkPlanPeriodOverlap`)
   - Draft 중복 생성 방지 (`findExistingDraftPlanGroup`)
   - Unique constraint로 DB 레벨 중복 방지

2. **상태 관리**
   - `PlanStatusManager`로 상태별 권한 체크
   - 상태 전이 규칙 명확화

3. **제외일 검증**
   - 플랜 이동 시 제외일 검증 (`checkExclusionDate`)
   - **위치**: `lib/domains/plan/actions/calendarDrag.ts` (112줄)

#### ⚠️ 개선 필요 사항

1. **콘텐츠 업데이트 방식** 🟡 MEDIUM

   **위치**: `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`

   **문제**:
   - 기존 삭제 후 재생성 (DELETE → INSERT)
   - 삭제/생성 사이에 데이터 불일치 가능

   **개선 방안**:
   - UPSERT 패턴 사용 또는
   - 트랜잭션 내 처리

2. **제외일/학원 일정 중복 관리** 🟡 MEDIUM

   **위치**: 플랜 그룹별로 독립 관리

   **문제**:
   - 플랜 그룹 간 중복 허용으로 인한 데이터 중복
   - 학생별 전역 관리 필요

   **개선 방안**:
   - 학생별 전역 관리로 전환 (Phase 2 계획)

3. **플랜 상태와 진행률 불일치** 🟠 HIGH

   **위치**: `lib/domains/plan/actions/core.ts`

   **문제**:
   - `status` 필드와 `completed_at` 필드 일관성 부족
   - 진행률 계산 로직 표준화 필요

   **개선 방안**:
   ```typescript
   // 상태 업데이트 시 진행률 자동 계산
   function updatePlanStatus(plan: Plan, status: PlanStatus) {
     if (status === "completed") {
       plan.completed_at = new Date();
       plan.progress = 100;
     } else if (status === "in_progress") {
       plan.progress = calculateProgress(plan);
     }
   }
   ```

---

## 4. 동시성 제어

### 4.1 현재 상태

#### ✅ 잘 구현된 부분

1. **타이머 Race Condition 방지** ✅

   **위치**: `lib/domains/today/actions/timer.ts` (134-168줄)

   **구현**:
   - 애플리케이션 레벨: activeSessions, activeAdHocPlans 검사 (1차 방어선)
   - DB 레벨: `idx_unique_active_session_per_student` 유니크 제약 (2차 백업 방어선)
   - 동시 요청 시 1차 방어선을 통과해도 2차에서 차단

   ```typescript
   // [경합 방지 규칙 1] 동시 실행 금지
   const conflictCheck = await checkForConflictingTimers(user.userId, {
     excludePlanId: planId,
   });

   // Race Condition 방지 전략:
   // 1. 애플리케이션 레벨: 위에서 activeSessions, activeAdHocPlans 검사
   // 2. DB 레벨: idx_unique_active_session_per_student 유니크 제약
   ```

2. **재조정 락 메커니즘** ✅

   **위치**: `lib/reschedule/transaction.ts` (41-70줄)

   **구현**:
   - 플랜 그룹 단위 락 획득 (`acquirePlanGroupLock`)
   - 동시 재조정 방지

#### ⚠️ 개선 필요 사항

1. **플랜 생성 동시성 제어 부재** 🟠 HIGH

   **위치**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

   **문제**:
   - 동일 플랜 그룹에 대한 동시 생성 요청 시 중복 생성 가능
   - 플랜 그룹 상태 업데이트 시 Race Condition 가능

   **개선 방안**:
   ```typescript
   // 플랜 그룹 락 획득
   const lockAcquired = await acquirePlanGroupLock(supabase, groupId);
   if (!lockAcquired) {
     throw new Error("플랜 생성이 이미 진행 중입니다.");
   }

   try {
     // 플랜 생성 로직
   } finally {
     await releasePlanGroupLock(supabase, groupId);
   }
   ```

2. **플랜 수정 동시성 제어 부재** 🟡 MEDIUM

   **위치**: `lib/domains/plan/actions/calendarDrag.ts`

   **문제**:
   - 동일 플랜에 대한 동시 수정 요청 시 마지막 요청만 반영
   - Optimistic Locking 미적용

   **개선 방안**:
   ```typescript
   // Optimistic Locking 적용
   const { data, error } = await supabase
     .from("student_plan")
     .update({ ... })
     .eq("id", planId)
     .eq("updated_at", lastUpdatedAt); // 버전 체크

   if (!data || data.length === 0) {
     throw new Error("플랜이 이미 수정되었습니다. 새로고침 후 다시 시도해주세요.");
   }
   ```

---

## 5. 타입 안전성

### 5.1 현재 상태

#### ✅ 잘 구현된 부분

1. **타입 정의 체계화**
   - 도메인별 타입 파일 분리 (`lib/domains/*/types.ts`)
   - Zod 스키마와 타입 동기화

2. **타입 가드 함수**
   - `isRecoverableError`, `isTimeoutError` 등

#### ⚠️ 개선 필요 사항

1. **`any` 타입 사용** 🟡 MEDIUM

   **위치**:
   - `lib/domains/plan/actions/calendarDrag.ts` (105줄, 143줄, 425줄)
   - `lib/domains/plan/actions/contentIndividualization.ts` (176줄, 256줄, 316줄, 380줄)
   - `lib/domains/gamification/services/gamificationService.ts` (111줄)
   - `lib/domains/habit/actions/crud.ts` (115줄)
   - `lib/domains/habit/actions/logging.ts` (232줄)
   - `lib/domains/plan/llm/providers/gemini.ts` (610줄)

   **문제**:
   ```typescript
   // ❌ 나쁜 예
   const isOwner = (existingPlan as any).plan_groups?.student_id === user.userId;
   const studentId = (planContent as any).plan_groups?.student_id;
   ```

   **개선 방안**:
   ```typescript
   // ✅ 좋은 예: 타입 정의
   interface PlanWithGroup extends Plan {
     plan_groups?: {
       student_id: string;
     };
   }

   const planWithGroup = existingPlan as PlanWithGroup;
   const isOwner = planWithGroup.plan_groups?.student_id === user.userId;
   ```

2. **Null 체크 부족** 🟡 MEDIUM

   **위치**: Supabase 쿼리 결과 처리

   **문제**:
   - `data`가 `null`일 수 있는데 체크 없이 접근
   - Optional Chaining 미사용

   **개선 방안**:
   ```typescript
   // ✅ 좋은 예
   const { data, error } = await supabase.from("students").select("*");
   if (error) throw error;
   const studentList = data ?? []; // null 체크
   ```

---

## 6. 에러 처리

### 6.1 현재 상태

#### ✅ 잘 구현된 부분

1. **표준 에러 처리**
   - `AppError` 클래스로 일관된 에러 형식
   - `ErrorCode` enum으로 에러 분류
   - **위치**: `lib/errors/handler.ts`

2. **에러 복구 가이드**
   - `recoveryGuide.ts`로 복구 방법 제공
   - **위치**: `lib/errors/recoveryGuide.ts`

3. **도메인별 에러 처리**
   - `PlanGroupError`, `CampError` 등 도메인별 에러 클래스
   - **위치**: `lib/errors/planGroupErrors.ts`, `lib/domains/camp/errors.ts`

#### ⚠️ 개선 필요 사항

1. **에러 메시지 일관성** 🟡 MEDIUM

   **위치**: 여러 액션 파일

   **문제**:
   - 에러 메시지 형식이 일관되지 않음
   - 사용자 친화적 메시지와 기술적 메시지 혼재

   **개선 방안**:
   ```typescript
   // 표준 에러 메시지 포맷
   throw new AppError(
     "플랜 생성에 실패했습니다.", // 사용자 메시지
     ErrorCode.BUSINESS_LOGIC_ERROR,
     400,
     true, // 사용자에게 표시
     { reason: 'insufficient_study_days' } // 기술적 정보
   );
   ```

2. **에러 로깅 부족** 🟡 MEDIUM

   **위치**: 일부 액션 파일

   **문제**:
   - 에러 발생 시 로깅이 누락되거나 불충분
   - 디버깅이 어려움

   **개선 방안**:
   ```typescript
   // 모든 에러 로깅
   catch (error) {
     logActionError("플랜 생성 실패", {
       action: "generatePlan",
       groupId,
       error: error instanceof Error ? error : new Error(String(error)),
     });
     throw error;
   }
   ```

---

## 7. 비즈니스 규칙 검증

### 7.1 현재 상태

#### ✅ 잘 구현된 부분

1. **Wizard 검증**
   - `WizardValidator`로 단계별 검증
   - Zod 스키마 + 비즈니스 로직 검증
   - **위치**: `lib/validation/wizardValidator.ts`

2. **플랜 검증**
   - `PlanValidationService`로 플랜 검증
   - `validatePlansEnhanced`로 AI 생성 플랜 검증
   - **위치**: `lib/domains/plan/services/planValidationService.ts`

3. **슬롯 검증**
   - `SlotValidationService`로 슬롯 검증
   - **위치**: `lib/domains/plan/services/slotValidationService.ts`

#### ⚠️ 개선 필요 사항

1. **검증 로직 분산** 🟡 MEDIUM

   **위치**: 여러 파일에 검증 로직 분산

   **문제**:
   - 동일한 검증 로직이 여러 곳에 중복
   - 검증 규칙 변경 시 여러 파일 수정 필요

   **개선 방안**:
   - 검증 로직을 Service 레이어로 통합
   - 단일 진실의 원천(Single Source of Truth) 유지

2. **검증 실패 시 복구 로직 부재** 🟡 MEDIUM

   **위치**: 검증 실패 시 단순 에러 반환

   **문제**:
   - 검증 실패 시 사용자가 수정할 수 있는 가이드 부족
   - 자동 복구 로직 없음

   **개선 방안**:
   ```typescript
   // 검증 실패 시 복구 제안
   const validation = validatePlans(plans);
   if (!validation.isValid) {
     const suggestions = generateRecoverySuggestions(validation.errors);
     return {
       success: false,
       errors: validation.errors,
       suggestions, // 복구 제안
     };
   }
   ```

---

## 8. 성능 및 최적화

### 8.1 현재 상태

#### ✅ 잘 구현된 부분

1. **캐싱 전략**
   - React Query 캐싱
   - Episode Map 캐싱 (SchedulerEngine)
   - **위치**: `lib/scheduler/SchedulerEngine.ts`

2. **배치 처리**
   - `useBatchProcessor` 훅으로 대량 처리
   - 순차/병렬 처리 지원
   - **위치**: `app/(admin)/admin/plan-creation/_hooks/useBatchProcessor.ts`

#### ⚠️ 개선 필요 사항

1. **N+1 쿼리 문제** 🟠 HIGH

   **위치**: 플랜 생성 시 콘텐츠 조회

   **문제**:
   - 각 플랜마다 콘텐츠 조회 쿼리 실행
   - 대량 플랜 생성 시 성능 저하

   **개선 방안**:
   ```typescript
   // ✅ 좋은 예: 배치 조회
   const contentIds = plans.map(p => p.content_id);
   const contents = await getContentsBatch(contentIds);
   const contentMap = new Map(contents.map(c => [c.id, c]));
   ```

2. **불필요한 재계산** 🟡 MEDIUM

   **위치**: `lib/scheduler/SchedulerEngine.ts`

   **문제**:
   - Episode Map을 매번 생성하여 중복 작업 발생
   - 이미 해결됨 (캐싱 적용)

3. **타임라인 성능** 🟠 HIGH

   **위치**: `app/(student)/plan/calendar/_utils/timelineUtils.ts`

   **문제**:
   - 대량 플랜 처리 시 성능 저하
   - 가상화 미적용

   **개선 방안**:
   - 가상화(Virtualization) 적용
   - 메모이제이션 강화

---

## 9. 미완료 작업

### 9.1 TODO 주석 정리

#### 🔴 CRITICAL (즉시 처리 필요)

1. **학원 일정 로드 미구현** 🟠 HIGH

   **위치**: `lib/domains/admin-plan/actions/batchPreviewPlans.ts` (414줄)

   ```typescript
   academySchedules: [], // TODO: 학원 일정 로드
   ```

   **영향**:
   - 배치 미리보기에서 학원 일정이 반영되지 않음
   - 플랜 생성 시 시간 충돌 가능

   **개선 방안**:
   ```typescript
   const academySchedules = await getAcademySchedules(studentId, period);
   ```

2. **블록 정보 로드 미구현** 🟠 HIGH

   **위치**: `lib/domains/admin-plan/actions/batchPreviewPlans.ts` (415줄)

   ```typescript
   blockSets: [], // TODO: 블록 정보 로드
   ```

   **영향**:
   - 배치 미리보기에서 블록셋 정보가 반영되지 않음
   - 가용 시간 계산 부정확

   **개선 방안**:
   ```typescript
   const blockSets = await getBlockSets(studentId);
   ```

#### 🟡 MEDIUM (중기 개선)

1. **콘텐츠 제목 조인 미구현**

   **위치**: 
   - `lib/domains/plan/actions/content-calendar.ts` (558줄)
   - `lib/domains/plan/actions/timezone.ts` (347줄)

   ```typescript
   content_title: "", // TODO: 콘텐츠 제목 조인
   ```

2. **시계열 분석 미구현**

   **위치**: `lib/domains/plan/actions/statistics.ts` (263줄)

   ```typescript
   trend: "stable" as const, // TODO: 시계열 분석
   ```

3. **블록셋 기반 계산 미구현**

   **위치**: `lib/domains/plan/actions/timezone.ts` (385줄)

   ```typescript
   total_study_hours: studyDays * 8, // TODO: 블록셋 기반 계산
   ```

4. **실제 평점 시스템 연동 미구현**

   **위치**: `lib/domains/content/actions/recommendations.ts` (497줄)

   ```typescript
   averageRating: 4.0 + Math.random() * 0.9, // TODO: 실제 평점 시스템 연동
   ```

5. **알림 전송 구현 미구현**

   **위치**: `lib/domains/analysis/services/earlyWarningService.ts` (423줄)

   ```typescript
   // TODO: 실제 알림 전송 구현 (이메일, 푸시 등)
   ```

---

## 10. 우선순위별 개선 계획

### 10.1 🔴 CRITICAL (즉시 처리)

1. **트랜잭션 처리 개선** (예상 소요: 2-3일)
   - DELETE → INSERT 패턴을 UPSERT 또는 트랜잭션으로 변경
   - 롤백 로직 자동화
   - **파일**: `lib/domains/camp/actions/student.ts`, `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`

2. **플랜 생성 동시성 제어** (예상 소요: 1-2일)
   - 플랜 그룹 락 메커니즘 적용
   - **파일**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

3. **학원 일정/블록 정보 로드** (예상 소요: 1일)
   - 배치 미리보기에서 학원 일정 및 블록셋 정보 로드
   - **파일**: `lib/domains/admin-plan/actions/batchPreviewPlans.ts`

### 10.2 🟠 HIGH (1주일 내)

1. **플랜 상태와 진행률 일관성** (예상 소요: 2-3일)
   - 상태 업데이트 시 진행률 자동 계산
   - `status`와 `completed_at` 일관성 확보
   - **파일**: `lib/domains/plan/actions/core.ts`

2. **N+1 쿼리 문제 해결** (예상 소요: 2-3일)
   - 배치 조회로 변경
   - 콘텐츠 조회 최적화

3. **타임라인 성능 최적화** (예상 소요: 3-4일)
   - 가상화 적용
   - 메모이제이션 강화

4. **플랜 수정 동시성 제어** (예상 소요: 1-2일)
   - Optimistic Locking 적용
   - **파일**: `lib/domains/plan/actions/calendarDrag.ts`

### 10.3 🟡 MEDIUM (1개월 내)

1. **타입 안전성 개선** (예상 소요: 3-4일)
   - `any` 타입 제거
   - 명시적 타입 정의
   - **파일**: `lib/domains/plan/actions/calendarDrag.ts`, `lib/domains/plan/actions/contentIndividualization.ts`

2. **에러 처리 표준화** (예상 소요: 2-3일)
   - 에러 메시지 일관성 확보
   - 에러 로깅 강화

3. **검증 로직 통합** (예상 소요: 3-4일)
   - 검증 로직을 Service 레이어로 통합
   - 단일 진실의 원천 유지

4. **콘텐츠 업데이트 방식 개선** (예상 소요: 2-3일)
   - UPSERT 패턴 적용
   - 트랜잭션 내 처리

### 10.4 🟢 LOW (3개월 내)

1. **제외일/학원 일정 전역 관리** (예상 소요: 5-7일)
   - 학생별 전역 관리로 전환
   - 플랜 그룹 간 중복 제거

2. **미완료 TODO 작업 완료** (예상 소요: 5-7일)
   - 콘텐츠 제목 조인
   - 시계열 분석
   - 블록셋 기반 계산
   - 평점 시스템 연동
   - 알림 전송 구현

---

## 11. 관련 파일 목록

### 트랜잭션 처리
- `lib/supabase/transaction.ts` - 배치 작업 유틸리티
- `lib/reschedule/transaction.ts` - 재조정 트랜잭션
- `lib/domains/plan/transactions.ts` - 플랜 트랜잭션
- `lib/domains/today/transactions.ts` - 학습 세션 트랜잭션

### 동시성 제어
- `lib/domains/today/actions/timer.ts` - 타이머 Race Condition 방지
- `lib/reschedule/transaction.ts` - 재조정 락 메커니즘

### 타입 안전성
- `lib/domains/plan/actions/calendarDrag.ts` - `any` 타입 사용
- `lib/domains/plan/actions/contentIndividualization.ts` - `any` 타입 사용

### 에러 처리
- `lib/errors/handler.ts` - 표준 에러 처리
- `lib/errors/planGroupErrors.ts` - 플랜 그룹 에러
- `lib/domains/camp/errors.ts` - 캠프 에러

### 검증
- `lib/validation/wizardValidator.ts` - 위저드 검증
- `lib/domains/plan/services/planValidationService.ts` - 플랜 검증
- `lib/domains/plan/services/slotValidationService.ts` - 슬롯 검증

---

## 12. 다음 단계

1. **즉시 시작 가능한 작업**:
   - 학원 일정/블록 정보 로드 (배치 미리보기)
   - 트랜잭션 처리 개선 (DELETE → INSERT 패턴)

2. **단기 계획 (1-2주)**:
   - 플랜 생성 동시성 제어
   - 플랜 상태와 진행률 일관성
   - N+1 쿼리 문제 해결

3. **중기 계획 (1-2개월)**:
   - 타입 안전성 개선
   - 에러 처리 표준화
   - 검증 로직 통합

4. **장기 계획 (3개월 이상)**:
   - 제외일/학원 일정 전역 관리
   - 미완료 TODO 작업 완료

---

**마지막 업데이트**: 2026-01-06

