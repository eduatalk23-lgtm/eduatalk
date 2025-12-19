# Phase 3: 학생 코어 모듈 리팩토링 완료 요약

**작업 기간**: 2025-02-01 ~ 2025-02-04  
**상태**: ✅ 완료  
**목표**: 설정 중앙화, UI/Logic 분리, API 계층화, 레거시 제거

---

## 📋 개요

학생 코어 모듈의 대규모 리팩토링을 통해 코드 품질, 유지보수성, 확장성을 크게 향상시켰습니다. 매직 넘버 제거, 컴포넌트 분리, 데이터 계층 표준화, 레거시 코드 청산을 완료했습니다.

---

## 🎯 핵심 변경 사항

### 1. Config 중앙화: `lib/config/schedulerConfig.ts`

#### 배경

기존 코드에서 스케줄러 관련 설정값(매직 넘버)이 여러 파일에 하드코딩되어 있었습니다:

```typescript
// ❌ 기존: 매직 넘버 하드코딩
const reviewTimeRatio = 0.5; // 복습일 시간 감면 비율
const bookDifficultyTime = { 기본: 6, 기초: 8, 최상: 10 }; // 교재 난이도별 시간
```

#### 해결책

모든 스케줄러 설정을 중앙화된 설정 파일로 통합:

**파일**: `lib/config/schedulerConfig.ts`

```typescript
export const SCHEDULER_CONFIG = {
  REVIEW: {
    TIME_RATIO: 0.5, // 복습일 시간 감면 비율 (50%)
  },
  BOOK: {
    DIFFICULTY_TIME: {
      기본: 6,   // 기본 난이도: 6분/페이지
      기초: 8,   // 기초 난이도: 8분/페이지
      최상: 10,  // 최상 난이도: 10분/페이지
    },
    DEFAULT_TIME: 6, // 난이도 정보 없을 때 기본값
  },
  // ... 기타 설정
} as const;
```

#### 사용법

```typescript
import { SCHEDULER_CONFIG } from "@/lib/config/schedulerConfig";

// 복습일 시간 계산
const reviewTime = originalTime * SCHEDULER_CONFIG.REVIEW.TIME_RATIO;

// 교재 난이도별 시간 계산
const timePerPage = SCHEDULER_CONFIG.BOOK.DIFFICULTY_TIME[difficulty] 
  || SCHEDULER_CONFIG.BOOK.DEFAULT_TIME;
```

#### 영향 범위

- ✅ `lib/plan/assignPlanTimes.ts` - 플랜 시간 배정 로직
- ✅ `lib/plan/contentDuration.ts` - 콘텐츠 소요 시간 계산
- ✅ `lib/scheduler/calculateAvailableDates.ts` - 사용 가능한 날짜 계산

#### 장점

1. **단일 진실 공급원(Single Source of Truth)**: 설정값 변경 시 한 곳만 수정
2. **타입 안전성**: `as const`로 타입 추론 강화
3. **가독성 향상**: 매직 넘버 대신 의미 있는 상수명 사용
4. **테스트 용이성**: 설정값을 쉽게 모킹 가능

---

### 2. UI/Logic 분리: PlanGroupWizard 리팩토링

#### 배경

`PlanGroupWizard.tsx` 컴포넌트가 800줄 이상으로 거대해지며 UI 렌더링과 비즈니스 로직이 혼재되어 있었습니다.

#### 해결책

**Presentational/Container 패턴**으로 분리:

#### 2.1 BasePlanWizard (Presentational Component)

**파일**: `app/(student)/plan/new-group/_components/BasePlanWizard.tsx`

**역할**: 순수 UI 렌더링만 담당

- 단계별 컴포넌트 렌더링 (Step1~Step7)
- 진행률 표시 바
- 상단 액션 바 (취소/저장 버튼)
- 에러/경고 메시지 표시
- 하단 네비게이션 버튼 (이전/다음/완료)

**특징**:
- Props를 통해서만 데이터와 함수를 받음
- 상태 관리 없음 (Stateless)
- 재사용 가능한 순수 컴포넌트

#### 2.2 PlanGroupWizard (Container Component)

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**역할**: 비즈니스 로직 관리 및 BasePlanWizard에 Props 제공

- 상태 관리 (useState, useReducer)
- 데이터 페칭 (React Query)
- 이벤트 핸들링
- 검증 로직
- 서버 액션 호출

**특징**:
- UI 렌더링은 BasePlanWizard에 위임
- 복잡한 로직만 집중 관리
- 테스트 용이성 향상

#### 패턴 예시

```typescript
// Container Component
export default function PlanGroupWizard({ ... }) {
  // 비즈니스 로직
  const [formData, setFormData] = useState(...);
  const { data: blockSets } = useQuery(...);
  const handleNext = async () => { ... };
  
  // Presentational Component에 Props 전달
  return (
    <BasePlanWizard
      mode={mode}
      progress={progress}
      onNext={handleNext}
      // ... 기타 props
    />
  );
}
```

#### 장점

1. **관심사 분리**: UI와 로직의 명확한 분리
2. **재사용성**: BasePlanWizard를 다른 컨텍스트에서도 사용 가능
3. **테스트 용이성**: UI와 로직을 독립적으로 테스트 가능
4. **가독성 향상**: 각 컴포넌트의 책임이 명확

---

### 3. API 계층화: 직접 DB 쿼리 제거

#### 배경

레거시 대시보드에서 Supabase 클라이언트를 직접 사용하여 DB 쿼리를 수행하고 있었습니다:

```typescript
// ❌ 기존: 직접 DB 쿼리
const { data } = await supabase
  .from("student_mock_scores")
  .select("*")
  .eq("student_id", studentId);
```

#### 해결책

**표준 데이터 계층(`lib/data/...`) 사용**으로 통일:

#### 3.1 데이터 계층 구조

```
lib/data/
├── studentScores.ts      # 성적 데이터 조회
├── subjects.ts           # 교과/과목 데이터 조회
├── schedulerSettings.ts  # 스케줄러 설정 조회
└── ...
```

#### 3.2 마이그레이션 예시

**기존 코드** (`app/(student)/scores/dashboard/mock/page.tsx`):

```typescript
// ❌ 레거시: 직접 DB 쿼리
import { fetchMockScores } from "../_utils/scoreQueries";
const mockScores = await fetchMockScores(user.id);
```

**새로운 코드**:

```typescript
// ✅ 표준: 데이터 계층 사용
import { getMockScores } from "@/lib/data/studentScores";
import { getActiveCurriculumRevision, getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

const tenantContext = await getTenantContext();
const curriculumRevision = await getActiveCurriculumRevision();
const subjectHierarchy = await getSubjectHierarchyOptimized(curriculumRevision.id);
const mockScoresData = await getMockScores(user.id, tenantContext.tenantId);

// 데이터 변환 (FK → 텍스트)
const mockScores = await transformMockScoresToRows(mockScoresData, subjectHierarchy);
```

#### 3.3 API 엔드포인트 표준화

**통합 대시보드 API** 사용:

```typescript
// ✅ 표준: API 엔드포인트 사용
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";

const dashboard = await fetchScoreDashboard({
  studentId,
  tenantId,
  grade,
  semester,
});
```

#### 장점

1. **일관성**: 모든 데이터 접근이 동일한 패턴
2. **유지보수성**: 데이터 구조 변경 시 한 곳만 수정
3. **테스트 용이성**: 데이터 계층을 모킹하여 테스트 가능
4. **타입 안전성**: TypeScript 타입 정의로 안전성 보장

---

### 4. 레거시 청산

#### 4.1 삭제된 파일

1. **`app/(student)/scores/dashboard/_utils/scoreQueries.ts`**
   - 레거시 DB 쿼리 함수 제거
   - `fetchMockScores`, `fetchSchoolScores` 함수 삭제
   - 표준 데이터 계층으로 대체

2. **`_deprecated/` 폴더** (이전 작업에서 삭제)
   - 더 이상 사용하지 않는 레거시 코드

#### 4.2 타입 분리

**레거시 타입 파일 생성**: `lib/types/legacyScoreTypes.ts`

- `SchoolScoreRow`: 레거시 내신 성적 타입
- `MockScoreRow`: 레거시 모의고사 성적 타입

**목적**:
- 레거시 컴포넌트와의 호환성 유지
- 새로운 코드에서는 `lib/types/scoreDashboard.ts` 사용 권장
- 점진적 마이그레이션 지원

#### 4.3 참조 업데이트

**13개 컴포넌트**에서 타입 import 경로 변경:

- `dashboard/school/_components/*` (6개)
- `dashboard/mock/_components/*` (7개)

모두 `lib/types/legacyScoreTypes.ts`로 통일

---

## 🧪 테스트

### 단위 테스트 작성

#### 1. `__tests__/plan/contentDuration.test.ts` (확장)

**목적**: `SCHEDULER_CONFIG` 기반 콘텐츠 소요 시간 계산 검증

**테스트 케이스**:
- ✅ 교재 난이도별 시간 계산 (기초, 기본, 최상, 기본값)
- ✅ 강의 에피소드별 시간 합산
- ✅ 복습일 감면 적용
- ✅ 캐싱 메커니즘

**결과**: 12개 테스트 모두 통과

#### 2. `__tests__/lib/plan/assignPlanTimes.test.ts` (신규)

**목적**: Best Fit 알고리즘 검증

**테스트 케이스**:
- ✅ 정상 배정 (Full Allocation)
- ✅ 분할 배정 (Partial Allocation)
- ✅ Best Fit 알고리즘 (슬롯 선택)
- ✅ 경계 케이스 처리
- ✅ 복습일 시간 단축 적용

**결과**: 8개 테스트 모두 통과

### 테스트 실행 결과

```bash
npm test -- __tests__/plan/contentDuration.test.ts __tests__/lib/plan/assignPlanTimes.test.ts
```

```
✓ __tests__/plan/contentDuration.test.ts (12 tests) 2ms
✓ __tests__/lib/plan/assignPlanTimes.test.ts (8 tests) 2ms

Test Files  2 passed (2)
     Tests  20 passed (20)
  Duration  108ms
```

---

## 📊 영향 범위

### 수정된 파일

#### Config 중앙화
- `lib/config/schedulerConfig.ts` (신규)
- `lib/plan/assignPlanTimes.ts`
- `lib/plan/contentDuration.ts`
- `lib/scheduler/calculateAvailableDates.ts`

#### UI/Logic 분리
- `app/(student)/plan/new-group/_components/BasePlanWizard.tsx` (신규)
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` (리팩토링)

#### API 계층화
- `app/(student)/scores/dashboard/mock/page.tsx`
- `lib/data/studentScores.ts` (확장)
- `lib/data/subjects.ts` (확장)

#### 레거시 청산
- `lib/types/legacyScoreTypes.ts` (신규)
- 13개 컴포넌트 타입 import 경로 변경

### 삭제된 파일

- `app/(student)/scores/dashboard/_utils/scoreQueries.ts`

---

## ✅ 검증 사항

### 빌드 및 타입 안정성

- ✅ Phase 3 리팩토링 관련 빌드 에러 없음
- ✅ 타입 안전성 보장 (TypeScript strict mode)
- ⚠️ 기존 빌드 이슈 존재 (Phase 3와 무관):
  - `lib/supabase/server.ts` 클라이언트 컴포넌트에서 사용 문제
  - `formatPhoneNumber` export 문제 (수정 완료)

### 기능 검증

- ✅ 스케줄러 설정 중앙화 동작 확인
- ✅ PlanGroupWizard UI/Logic 분리 동작 확인
- ✅ 표준 데이터 계층 사용 확인
- ✅ 레거시 파일 제거 확인

---

## 📝 알려진 이슈

### 1. 빌드 에러 (Phase 3와 무관)

**문제**: `lib/supabase/server.ts`가 클라이언트 컴포넌트에서 import됨

**원인**: `lib/data/studentSearch.ts`가 `clientSelector.ts`를 통해 `server.ts`를 import하는데, 이것이 클라이언트 컴포넌트에서 사용됨

**영향**: Phase 3 리팩토링과 무관한 기존 문제

**조치**: 향후 별도 작업으로 해결 예정

---

## 🎯 달성한 목표

1. ✅ **Config 중앙화**: 매직 넘버 제거, 설정값 중앙 관리
2. ✅ **UI/Logic 분리**: Presentational/Container 패턴 적용
3. ✅ **API 계층화**: 표준 데이터 계층으로 통일
4. ✅ **레거시 청산**: 불필요한 코드 제거
5. ✅ **테스트 작성**: 핵심 로직 단위 테스트 추가

---

## 📚 참고 문서

### 관련 문서

- `docs/2025-02-04-score-queries-removal-complete.md` - scoreQueries.ts 제거 완료
- `docs/2025-02-04-plan-group-wizard-refactoring.md` - PlanGroupWizard 리팩토링
- `docs/2025-02-04-student-core-unit-tests.md` - 단위 테스트 작성
- `docs/2025-02-04-score-queries-dependency-refactoring.md` - 타입 분리 작업

### 코드 참조

- `lib/config/schedulerConfig.ts` - 스케줄러 설정 중앙화
- `app/(student)/plan/new-group/_components/BasePlanWizard.tsx` - Presentational Component
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - Container Component
- `lib/data/studentScores.ts` - 표준 데이터 계층
- `lib/types/legacyScoreTypes.ts` - 레거시 타입 정의

---

## 🚀 다음 단계

### Phase 4 준비

학생 코어 모듈 리팩토링이 완료되었으므로, 다음 단계로 **관리자/컨설턴트 모듈 리팩토링**을 진행할 수 있습니다.

### 향후 개선 사항

1. **레거시 타입 완전 제거**: `MockScoreRow` 타입을 사용하는 모든 컴포넌트를 새로운 타입으로 마이그레이션
2. **통합 대시보드 전환**: `/scores/dashboard/unified`로 완전 전환 후 레거시 대시보드 제거
3. **빌드 이슈 해결**: `lib/supabase/server.ts` 클라이언트 컴포넌트 사용 문제 해결

---

**작업 완료**: ✅ Phase 3 완료  
**다음 Phase**: Phase 4 (관리자/컨설턴트 모듈)

