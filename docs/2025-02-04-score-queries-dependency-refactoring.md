# 성적 대시보드 쿼리 의존성 정리

**작업일**: 2025-02-04  
**작업 내용**: scoreQueries.ts 파일의 타입 정의와 데이터 페칭 로직 분리

## 작업 개요

`dashboard/_utils/scoreQueries.ts` 파일에서 "직접 DB 조회 함수(Legacy)"와 "타입 정의(Shared Types)"가 섞여 있어 삭제가 불가능한 상태였습니다. 이를 물리적으로 분리하여 향후 레거시 페칭 로직 삭제 시 타입 에러를 방지하고, 개발자에게 레거시 함수 사용을 경고하는 작업을 수행했습니다.

## 작업 내용

### 1단계: 레거시 타입 파일 생성

**파일**: `lib/types/legacyScoreTypes.ts`

레거시 성적 대시보드에서 사용하는 타입 정의를 별도 파일로 분리했습니다.

#### 이동된 타입

- `SchoolScoreRow`: student_internal_scores 테이블 기반 타입
- `MockScoreRow`: student_mock_scores 테이블 기반 타입

#### 특징

- 타입 정의와 함수 로직의 물리적 분리
- 레거시 타입임을 명확히 표시하는 주석 추가
- 새로운 코드에서는 `lib/types/scoreDashboard.ts` 사용 권장

### 2단계: 참조 업데이트

프로젝트 전체에서 `dashboard/_utils/scoreQueries.ts`로부터 타입을 import하던 모든 코드를 `lib/types/legacyScoreTypes.ts`로 변경했습니다.

#### 수정된 파일 목록 (13개)

**School 컴포넌트들**:
- `dashboard/school/_components/SchoolWeakSubjectSection.tsx`
- `dashboard/school/_components/SchoolHeatmapChart.tsx`
- `dashboard/school/_components/SchoolGradeDistributionChart.tsx`
- `dashboard/school/_components/SchoolDetailedMetrics.tsx`
- `dashboard/school/_components/SchoolSummarySection.tsx`
- `dashboard/school/_components/SchoolInsightPanel.tsx`

**Mock 컴포넌트들**:
- `dashboard/_components/MockExamTrendSection.tsx`
- `dashboard/mock/_components/MockExamTypeComparisonChart.tsx`
- `dashboard/mock/_components/MockPercentileDistributionChart.tsx`
- `dashboard/mock/_components/MockWeakSubjectSection.tsx`
- `dashboard/mock/_components/MockDetailedMetrics.tsx`
- `dashboard/mock/_components/MockSummarySection.tsx`
- `dashboard/mock/_components/MockInsightPanel.tsx`

**scoreQueries.ts**:
- 타입 정의 제거 후 `lib/types/legacyScoreTypes.ts`에서 import

### 3단계: 레거시 함수 Deprecated 표시

`dashboard/_utils/scoreQueries.ts`에 남아있는 데이터 페칭 함수들에 `@deprecated` 태그와 함께 대안 API 사용 방법을 추가했습니다.

#### 업데이트된 함수

1. **fetchSchoolScores**
   - `@deprecated` 태그 추가
   - 대안: `/api/students/[id]/score-dashboard` API 사용 안내
   - `lib/api/scoreDashboard.ts`의 `fetchScoreDashboard` 사용 권장

2. **fetchMockScores**
   - `@deprecated` 태그 추가
   - 대안: `/api/students/[id]/score-dashboard` API 사용 안내
   - `lib/api/scoreDashboard.ts`의 `fetchScoreDashboard` 사용 권장

## 변경된 파일 목록

### 신규 생성
- `lib/types/legacyScoreTypes.ts` - 레거시 타입 정의 파일

### 수정
- `app/(student)/scores/dashboard/_utils/scoreQueries.ts` - 타입 정의 제거, deprecated 태그 강화
- 타입 import 경로 변경: 13개 컴포넌트 파일

## 분리 효과

### 1. 물리적 분리 달성
- 타입 정의와 함수 로직이 별도 파일로 분리됨
- 타입은 `lib/types/` 디렉토리에서 중앙 관리

### 2. 향후 삭제 시 타입 에러 방지
- 레거시 페칭 함수(`fetchSchoolScores`, `fetchMockScores`)를 삭제해도 타입 정의는 유지됨
- 컴포넌트들이 타입을 안전하게 사용 가능

### 3. 개발자 경고 효과
- `@deprecated` 태그로 IDE에서 사용 시 경고 표시
- 주석을 통해 대안 API 명확히 안내

## 현재 상태

### 타입 정의
- **위치**: `lib/types/legacyScoreTypes.ts`
- **사용처**: 레거시 대시보드 컴포넌트들 (13개 파일)
- **상태**: 유지 필요 (레거시 컴포넌트 호환성)

### 레거시 함수
- **위치**: `app/(student)/scores/dashboard/_utils/scoreQueries.ts`
- **사용처**: `dashboard/mock/page.tsx` (1개 파일)
- **상태**: `@deprecated` 표시, 향후 삭제 가능

## 향후 작업

1. **mock/page.tsx 마이그레이션**
   - `fetchMockScores` 함수를 API 기반으로 변경
   - 새로운 통합 대시보드로 완전히 전환

2. **레거시 함수 삭제**
   - 모든 레거시 컴포넌트가 마이그레이션되면 `fetchSchoolScores`, `fetchMockScores` 함수 삭제
   - `scoreQueries.ts` 파일 삭제 가능

3. **타입 정의 정리**
   - 레거시 컴포넌트들이 모두 제거되면 타입 정의도 삭제 고려
   - 또는 레거시 타입임을 명시하여 유지

## 사용 가이드

### 새로운 코드 작성 시

```typescript
// ❌ 사용 금지 (레거시)
import { fetchSchoolScores } from "@/app/(student)/scores/dashboard/_utils/scoreQueries";

// ✅ 권장 (새로운 API)
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";

const data = await fetchScoreDashboard({
  studentId: student.id,
  tenantId: effectiveTenantId,
  grade: 2,
  semester: 1,
});
```

### 레거시 타입 사용 시

```typescript
// 레거시 컴포넌트에서만 사용 (호환성 유지)
import type { SchoolScoreRow, MockScoreRow } from "@/lib/types/legacyScoreTypes";
```

## 결론

타입 정의와 데이터 페칭 로직의 물리적 분리를 통해 향후 레거시 코드 제거 시 타입 에러를 방지할 수 있는 구조를 마련했습니다. `@deprecated` 태그를 통해 개발자에게 레거시 함수 사용을 경고하고, 새로운 API 사용을 권장하는 환경을 구축했습니다.

