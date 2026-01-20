# Phase 3.1: Ad-hoc 플랜 통합 구현 현황

## 완료일: 2026-01-20

## 개요

학생용 단발성(빠른 추가) 플랜을 `ad_hoc_plans` 테이블 대신 `student_plan` 테이블로 통합하여 Planner 시스템과 연동되도록 구현.

---

## 완료된 작업

### 1. createQuickPlan 통합 API (커밋: `848666a8`)

**파일**: `lib/domains/plan/actions/quickAdd.ts`

- 학생/관리자 모두 사용 가능한 빠른 플랜 생성 API
- `student_plan` 테이블에 `is_adhoc=true`로 저장
- Planner 자동 연동 (getOrCreateDefaultPlannerAction)
- Plan Group 자동 생성 (is_single_content=true)

```typescript
// 사용 예시
const result = await createQuickPlan({
  title: "수학 문제풀이",
  planDate: "2026-01-20",
  contentType: "free",
  estimatedMinutes: 30,
  containerType: "daily",
});
```

### 2. UI 마이그레이션 (커밋: `3dd6c991`)

**수정 파일**:
- `app/(student)/today/_components/EnhancedAddPlanModal.tsx`
- `app/(student)/plan/calendar/_components/QuickAddPlanModal.tsx`

**변경 내용**:
- `createStudentAdHocPlan` → `createQuickPlan` API로 교체
- 기존 `ad_hoc_plans` 생성 로직 제거

### 3. 조회 함수 통합 (커밋: `3eb02bfc`)

**신규 파일**: `lib/data/unifiedAdHocPlans.ts`

```typescript
// 통합 조회 함수
getUnifiedAdHocPlans(options)           // 메인 조회 함수
getUnifiedAdHocPlansForDate(...)        // Today 페이지용
getUnifiedAdHocPlansForDateRange(...)   // 캘린더용
getUnifiedAdHocPlanById(...)            // 단일 조회
getUnifiedAdHocPlansByContainer(...)    // 컨테이너별 조회
```

**수정 파일**:
- `lib/data/todayPlans.ts`: `getAdHocPlansForDate()` 양쪽 테이블 조회
- `lib/data/studentPlans.ts`: `getAdHocPlansForCalendar()` 양쪽 테이블 조회

### 4. 타이머 함수 통합 (커밋: `5a28f884`)

**파일**: `lib/domains/today/actions/adHocTimer.ts`

**헬퍼 함수 추가**:
```typescript
type AdHocPlanSource = "student_plan" | "ad_hoc_plans";

findAdHocPlan(supabase, planId, studentId)  // 양쪽 테이블에서 찾기
updateAdHocPlan(supabase, source, planId, studentId, updates)  // 소스별 업데이트
```

**통합된 타이머 함수**:
- `startAdHocPlan` - 타이머 시작
- `pauseAdHocPlan` - 일시정지
- `resumeAdHocPlan` - 재개 (양쪽 테이블 충돌 체크)
- `completeAdHocPlan` - 완료
- `cancelAdHocPlan` - 취소
- `getAdHocPlanStatus` - 상태 조회

### 5. DB 마이그레이션 (Supabase 적용됨)

**파일**: `supabase/migrations/20260120140000_add_adhoc_columns_to_student_plan.sql`

**추가된 컬럼** (student_plan 테이블):
| 컬럼 | 타입 | 용도 |
|------|------|------|
| `is_adhoc` | boolean | 단발성 플랜 구분 |
| `description` | text | 플랜 설명 |
| `color` | varchar(50) | UI 색상 |
| `icon` | varchar(50) | UI 아이콘 |
| `tags` | text[] | 태그 배열 |
| `priority` | integer | 우선순위 |
| `started_at` | timestamptz | 타이머 시작 |
| `completed_at` | timestamptz | 타이머 완료 |
| `actual_minutes` | integer | 실제 학습 시간 |
| `paused_at` | timestamptz | 일시정지 시간 |

**추가된 인덱스**:
- `idx_student_plan_is_adhoc`
- `idx_student_plan_student_date_adhoc`
- `idx_student_plan_student_date_container`

### 6. 타입 동기화 (커밋: `7ab95910`)

**수정 파일**:
- `lib/supabase/database.types.ts` - Supabase MCP로 재생성
- `lib/types/plan/domain.ts` - Plan 타입에 새 컬럼 추가
- `lib/data/studentPlans.ts` - select문 컬럼 추가
- `lib/data/todayPlans.ts` - Plan 매핑 필드 추가
- `lib/reschedule/patternAnalyzer.ts` - Plan 매핑 필드 추가

---

## 데이터 흐름 (현재 상태)

```
[학생 UI - 빠른 추가]
        │
        ▼
  createQuickPlan()
        │
        ▼
  student_plan (is_adhoc=true)
        │
        ├─ plan_group 자동 생성
        │
        └─ planner 자동 연동

[타이머 액션]
        │
        ▼
  findAdHocPlan()
        │
        ├─ student_plan (is_adhoc=true) 우선 조회
        │
        └─ ad_hoc_plans fallback (레거시)
        │
        ▼
  updateAdHocPlan(source, ...)
```

---

## 미완료 작업

### 1. 레거시 데이터 마이그레이션 (선택적)

기존 `ad_hoc_plans` 데이터를 `student_plan`으로 이전하는 작업.

**방안**:
- 마이그레이션 스크립트 작성
- `adhoc_source_id` 필드로 원본 추적
- 점진적 마이그레이션 또는 일괄 이전

### 2. ad_hoc_plans 테이블 Deprecation

Phase 4에서 진행 예정:
1. 신규 데이터 `student_plan`으로만 생성 (완료)
2. 기존 데이터 마이그레이션
3. `ad_hoc_plans` 테이블 deprecation
4. 레거시 코드 제거

### 3. 추가 기능

- `recurrence_rule` 지원 (반복 플랜)
- Admin 빠른 추가 API 개선
- 통합 테스트 작성

---

## 관련 파일 목록

### 핵심 파일
- `lib/domains/plan/actions/quickAdd.ts` - 통합 API
- `lib/data/unifiedAdHocPlans.ts` - 통합 조회
- `lib/domains/today/actions/adHocTimer.ts` - 타이머 함수

### 수정된 파일
- `lib/supabase/database.types.ts`
- `lib/types/plan/domain.ts`
- `lib/data/studentPlans.ts`
- `lib/data/todayPlans.ts`
- `lib/reschedule/patternAnalyzer.ts`

### UI 파일
- `app/(student)/today/_components/EnhancedAddPlanModal.tsx`
- `app/(student)/plan/calendar/_components/QuickAddPlanModal.tsx`

### 마이그레이션
- `supabase/migrations/20260120140000_add_adhoc_columns_to_student_plan.sql`

---

## 커밋 히스토리

| 커밋 | 설명 |
|------|------|
| `848666a8` | feat(plan): createQuickPlan 통합 API 구현 |
| `3dd6c991` | refactor(plan): UI 컴포넌트를 createQuickPlan으로 마이그레이션 |
| `3eb02bfc` | feat(plan): ad_hoc_plans 조회 통합 |
| `5a28f884` | refactor(timer): ad-hoc 타이머 함수 통합 |
| `7ab95910` | chore(types): Supabase 타입 동기화 및 Plan 타입 확장 |

---

## 테스트 체크리스트

- [ ] Today 페이지에서 빠른 추가 테스트
- [ ] 캘린더에서 빠른 추가 테스트
- [ ] 타이머 시작/일시정지/재개/완료 테스트
- [ ] 기존 ad_hoc_plans 데이터 표시 확인
- [ ] 새로 생성된 플랜이 student_plan에 저장되는지 확인

---

## 주의사항

1. **Push 필요**: 로컬에 14개 커밋이 쌓여있음 (`git push` 필요)
2. **transactions.ts 변경**: 별도 작업 관련 변경사항이 스테이징되지 않음
3. **Plan Group 자동 생성**: createQuickPlan 호출 시 plan_group이 자동 생성됨
