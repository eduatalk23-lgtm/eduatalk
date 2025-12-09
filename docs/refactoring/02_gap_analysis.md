# 2. 영역별 갭 분석

## 작성일: 2025-12-09

---

## 📋 개요

요구서(total_refactoring_1209) vs 현재 코드 사이의 차이를 영역별로 정리합니다.

---

## 🏗 영역 1: 플랜 구조·CRUD

### 요구사항 요약

| FR | 내용 |
|----|------|
| FR-1 | 플랜그룹 상세 화면에서 논리 플랜(콘텐츠 아이템) CRUD 가능 |
| FR-2 | student_plan에서는 날짜 변경, 범위 조정, 타이머, 메모, ad-hoc 플랜만 허용 |
| FR-3 | plan_groups 삭제 시 연결된 student_plan 삭제 정책 명확화 |

### 현재 상태 vs 목표

| 항목 | 현재 상태 | 목표 | 갭 |
|-----|----------|------|-----|
| 논리 플랜 테이블 | ❌ 없음 (`plan_number`로 간접 추적) | ✅ `plan_group_items` 테이블 | **신규 구현** |
| `origin_plan_item_id` | ❌ 없음 | ✅ student_plan에 추가 | **신규 구현** |
| 플랜그룹 화면 CRUD | ⚠️ 콘텐츠 추가/삭제는 가능하나 논리 플랜 단위 관리 안됨 | ✅ 논리 플랜 CRUD + student_plan 재생성 | **수정 필요** |
| student_plan 수정 범위 | ⚠️ 제한 없음 | ✅ 정책적 제한 | **수정 필요** |
| 삭제 정책 | ⚠️ 명확하지 않음 | ✅ Repository에서 일관된 API | **수정 필요** |

### 작업 항목

| 액션 | 항목 | 상세 |
|------|-----|------|
| **신규** | `plan_group_items` 테이블 | DDL 작성 |
| **신규** | `origin_plan_item_id` 컬럼 | student_plan에 추가 |
| **수정** | 플랜그룹 상세 화면 | 논리 플랜 CRUD UI 추가 |
| **수정** | 플랜 생성 로직 | origin_plan_item_id 연결 |
| **수정** | 플랜 삭제 로직 | 일관된 cascading 정책 |
| **유지** | 기존 student_plan 구조 | 하위 호환성 유지 |

---

## ⏰ 영역 2: 타임라인·시간 배치 로직

### 요구사항 요약

| FR | 내용 |
|----|------|
| FR-4 | 타임라인 설계 옵션 정의 (기본: block_index, 고급: start_time/end_time) |
| FR-5 | calculateAvailableDates / generateTimeSlots / assignPlanTimes 역할 분리 |
| FR-6 | student_plan.start_time/end_time 사용 전략 정리 |
| FR-7 | daily_schedule 및 time_slots 책임 명확화 |

### 현재 상태 vs 목표

| 항목 | 현재 상태 | 목표 | 갭 |
|-----|----------|------|-----|
| 블록 vs 시간 모드 | ⚠️ 혼재 (둘 다 사용) | ✅ 모드별 분리 | **정리 필요** |
| 함수 역할 분리 | ⚠️ 부분적 분리 | ✅ 명확한 입출력 타입 | **수정 필요** |
| start_time/end_time | ⚠️ 선택적 사용 | ✅ NULL 허용 정책 명시 | **문서화 필요** |
| daily_schedule | ✅ JSONB로 저장 | ✅ 현재 유지 | 유지 |

### 작업 항목

| 액션 | 항목 | 상세 |
|------|-----|------|
| **수정** | `CalculateOptions` 타입 | 모드 구분 옵션 추가 |
| **수정** | 함수 시그니처 | 명확한 타입 정의 |
| **문서화** | 타임라인 사용 전략 | 언제 NULL 허용하는지 명시 |
| **유지** | 기존 함수 구조 | 리팩토링만, 재작성 아님 |

---

## 🎭 영역 3: 더미 콘텐츠 처리

### 요구사항 요약

| DR/FR | 내용 |
|-------|------|
| DR-1 | 상수 중앙 관리 (`lib/constants/plan.ts`) |
| DR-2 | student_custom_contents에 정식 더미 row 보장 |
| FR-8 | 더미 콘텐츠 예외 처리 단일화 |
| FR-9 | 비학습/자율학습 플랜 정책 정의 |

### 현재 상태 vs 목표

| 항목 | 현재 상태 | 목표 | 갭 |
|-----|----------|------|-----|
| 상수 위치 | ❌ 여러 파일에 하드코딩 | ✅ 중앙 상수 파일 | **신규 구현** |
| DB row 보장 | ❓ 불확실 | ✅ 정식 row 보장 | **확인/구현 필요** |
| 예외 처리 | ⚠️ 분산됨 | ✅ `isDummyContent()` 헬퍼 | **신규 구현** |
| 집계 정책 | ❌ 미정의 | ✅ 명확한 정책 | **정의 필요** |

### 작업 항목

| 액션 | 항목 | 상세 |
|------|-----|------|
| **신규** | `lib/constants/plan.ts` | 상수 파일 생성 |
| **신규** | `isDummyContent()` 헬퍼 | 더미 판별 유틸 |
| **수정** | 기존 하드코딩 제거 | 모든 파일에서 import로 교체 |
| **신규** | 시드 스크립트 | 더미 콘텐츠 row 보장 |
| **문서화** | 집계 정책 | 포함/제외 기준 명시 |

---

## 📱 영역 4: today/캠프 성능·UX

### 요구사항 요약

| FR | 내용 |
|----|------|
| FR-10 | /api/today/plans, getTodayPlans 최적화 |
| FR-11 | 타이머 액션 상태 전이(State machine) 문서화 |
| FR-12 | 학생 입장 기능 가이드 (할 수 있는 것/없는 것) |
| FR-13 | 캠프 모드 today 일관된 구조로 리팩토링 |

### 현재 상태 vs 목표

| 항목 | 현재 상태 | 목표 | 갭 |
|-----|----------|------|-----|
| 인덱스 | ✅ 최적화 인덱스 존재 | ✅ 현재 유지 | 유지 |
| 쿼리 패턴 | ✅ 기본 최적화 | ✅ 추가 최적화 검토 | **검토 필요** |
| 상태 전이 | ⚠️ 코드에만 존재 | ✅ 문서화 | **문서화 필요** |
| 타이머 경합 | ⚠️ 일부 처리 | ✅ 완전한 가드 | **수정 필요** |
| 캠프 모드 | ✅ 동작함 | ✅ 코드 정리 | **정리 필요** |

### 작업 항목

| 액션 | 항목 | 상세 |
|------|-----|------|
| **문서화** | 타이머 상태 전이 다이어그램 | State machine 정의 |
| **수정** | 동시 세션 방지 | 경합 조건 강화 |
| **정리** | 캠프 모드 코드 | 더미 콘텐츠 처리 일관화 |
| **유지** | 기존 인덱스 | 성능 유지 |
| **검토** | today_plans_cache | 사용 기준 명확화 |

---

## 📊 영역 5: 통계/리포트 정의

### 요구사항 요약

| FR | 내용 |
|----|------|
| FR-14 | "완료 플랜" 정의 통일 |
| FR-15 | student_plan 기반 집계 모듈 분리 |
| FR-16 | 비학습/자율학습 플랜 집계 정책 반영 |

### 현재 상태 vs 목표

| 항목 | 현재 상태 | 목표 | 갭 |
|-----|----------|------|-----|
| 완료 기준 | ❌ 불일치 (`actual_end_time` vs `completed_amount`) | ✅ 단일 기준 | **수정 필요** |
| 모듈 구조 | ✅ `lib/metrics/` 존재 | ✅ 공통 인터페이스 추가 | **수정 필요** |
| 비학습 집계 | ❌ 미정의 | ✅ 정책 반영 | **정의/구현 필요** |

### 완료 기준 후보

```typescript
// 통일 기준 제안
type CompletionCriteria = {
  // 최소 하나 만족 시 "완료"
  hasActualEndTime: boolean;      // actual_end_time IS NOT NULL
  hasPositiveProgress: boolean;   // progress >= 100
  hasCompletedAmount: boolean;    // completed_amount > 0
};

// 권장: actual_end_time IS NOT NULL (타이머 완료 = 플랜 완료)
```

### 작업 항목

| 액션 | 항목 | 상세 |
|------|-----|------|
| **정의** | 완료 기준 상수 | `PLAN_COMPLETION_CRITERIA` |
| **수정** | `todayProgress.ts` | 통일 기준 적용 |
| **수정** | `getPlanCompletion.ts` | 통일 기준 적용 |
| **신규** | `CompletionCriteria` 타입 | 공통 인터페이스 |
| **신규** | `isCompletedPlan()` 헬퍼 | 완료 판별 유틸 |
| **문서화** | 메트릭 정의 표 | 기준 필드, 조건 명시 |

---

## 🔐 영역 6: RLS/트리거

### 요구사항 요약

| FR | 내용 |
|----|------|
| FR-17 | student_plan RLS 정책 설계 |
| FR-18 | updated_at 자동 업데이트 트리거 도입 |

### 현재 상태 vs 목표

| 항목 | 현재 상태 | 목표 | 갭 |
|-----|----------|------|-----|
| RLS 정책 | ❌ 미정의 | ✅ 학생/관리자별 접근 제어 | **신규 구현** |
| updated_at 트리거 | ❌ 미정의 | ✅ 자동 업데이트 | **신규 구현** |
| 테넌트 격리 | ⚠️ 코드 레벨만 | ✅ DB 레벨 강제 | **신규 구현** |

### 작업 항목

| 액션 | 항목 | 상세 |
|------|-----|------|
| **신규** | RLS 정책 마이그레이션 | student_plan에 적용 |
| **신규** | updated_at 트리거 | BEFORE UPDATE 트리거 |
| **신규** | 테넌트 격리 RLS | tenant_id 기반 |

### RLS 정책 초안

```sql
-- 학생: 자신의 레코드만
CREATE POLICY student_plan_student_policy ON student_plan
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- 관리자: 같은 테넌트 내 레코드
CREATE POLICY student_plan_admin_policy ON student_plan
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_plan.tenant_id
    )
  );
```

---

## 📋 갭 분석 요약 표

| 영역 | 유지 | 수정 | 제거 | 신규 |
|-----|:----:|:----:|:----:|:----:|
| 1. 플랜 구조·CRUD | student_plan 기본 구조 | 플랜그룹 화면, 생성 로직, 삭제 로직 | - | plan_group_items, origin_plan_item_id |
| 2. 타임라인 | 기존 함수 구조 | 함수 시그니처, 옵션 타입 | - | 모드 구분 옵션 |
| 3. 더미 콘텐츠 | - | 하드코딩 파일들 | 분산된 상수 | 중앙 상수, 헬퍼, 시드 |
| 4. today/캠프 | 인덱스, 기본 기능 | 타이머 경합 처리, 캠프 모드 | - | 상태 전이 문서 |
| 5. 통계/리포트 | 기존 메트릭 모듈 | 완료 기준 적용 | - | 공통 인터페이스, 헬퍼 |
| 6. RLS/트리거 | - | - | - | RLS 정책, 트리거 |

---

## 🚨 위험도 분석

### 높음 (High Risk) 🔴

| 항목 | 이유 | 완화 전략 |
|-----|------|----------|
| plan_group_items 도입 | 기존 로직 대규모 변경 | Phase 2에서 점진적 도입, 하위 호환성 유지 |
| RLS 정책 적용 | 기존 쿼리 실패 가능 | 테스트 환경에서 충분히 검증 |
| 완료 기준 통일 | 기존 통계 변동 가능 | 변경 전/후 비교 리포트 생성 |

### 중간 (Medium Risk) 🟡

| 항목 | 이유 | 완화 전략 |
|-----|------|----------|
| 더미 콘텐츠 상수화 | 누락된 import 시 런타임 에러 | grep으로 전체 사용처 확인 |
| 타이머 경합 처리 강화 | 기존 UX 변경 | 사용자 피드백 수집 |

### 낮음 (Low Risk) 🟢

| 항목 | 이유 |
|-----|------|
| 타임라인 함수 정리 | 내부 리팩토링, 외부 API 유지 |
| 문서화 작업 | 코드 변경 없음 |
| updated_at 트리거 | 기존 동작 보완 |

