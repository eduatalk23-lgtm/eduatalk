# 성적 대시보드 API 마이그레이션 완료

**작업일**: 2025-02-04  
**작업 내용**: dashboard/_utils/scoreQueries.ts의 직접 DB 조회 함수들을 API 기반으로 전환 완료 확인

## 작업 개요

학생 코어 모듈 리팩토링 3단계 작업으로, `dashboard/_utils/scoreQueries.ts`의 직접 DB 조회 함수들을 `/api/students/[id]/score-dashboard` API를 사용하는 방식으로 전환하는 작업을 확인 및 문서화했습니다.

## 현재 상태

### ✅ 완료된 작업

1. **API 클라이언트 함수**
   - `lib/api/scoreDashboard.ts` 파일에 `fetchScoreDashboard` 함수가 이미 구현되어 있음
   - `ScoreDashboardParams`, `ScoreDashboardResponse` 타입 정의 완료
   - 서버 컴포넌트에서 쿠키 전달 지원

2. **unified/page.tsx 마이그레이션**
   - `app/(student)/scores/dashboard/unified/page.tsx`는 이미 `fetchScoreDashboard` API를 사용 중
   - 직접 DB 조회 함수(`fetchSchoolScores`, `fetchMockScores`)를 사용하지 않음

### ⚠️ 레거시 사용처

다음 파일에서 여전히 `scoreQueries.ts`의 함수/타입을 사용 중:

1. **mock/page.tsx**
   - `fetchMockScores` 함수 사용 중
   - 레거시 모의고사 대시보드 페이지 (deprecated)

2. **타입 정의 사용처**
   - 여러 컴포넌트에서 `SchoolScoreRow`, `MockScoreRow` 타입 사용 중
   - 타입 정의는 레거시 컴포넌트와의 호환성을 위해 유지 필요

## API 클라이언트 함수

### fetchScoreDashboard

**파일**: `lib/api/scoreDashboard.ts`

```typescript
export async function fetchScoreDashboard(
  params: ScoreDashboardParams,
  options?: {
    cookies?: Awaited<ReturnType<typeof cookies>>;
  }
): Promise<ScoreDashboardResponse>
```

**파라미터**:
- `studentId`: 학생 ID (필수)
- `tenantId`: 테넌트 ID (필수)
- `termId`: 학기 ID (선택)
- `grade`: 학년 (선택, termId가 없을 때)
- `semester`: 학기 (선택, termId가 없을 때)

**리턴 타입**: `ScoreDashboardResponse`
- `studentProfile`: 학생 프로필 정보
- `internalAnalysis`: 내신 분석 결과
- `mockAnalysis`: 모의고사 분석 결과
- `strategyResult`: 수시/정시 전략 분석 결과

**에러 처리**:
- API 호출 실패 시 적절한 에러를 throw
- 상태 코드에 따른 에러 메시지 반환

## unified/page.tsx 구현 확인

`app/(student)/scores/dashboard/unified/page.tsx` 파일은 이미 다음과 같이 올바르게 구현되어 있습니다:

```typescript
// ✅ API 함수 사용
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";

// ✅ API 호출
const cookieStore = await cookies();
dashboardData = await fetchScoreDashboard(
  {
    studentId: student.id,
    tenantId: effectiveTenantId,
    grade: studentWithGrade?.grade || undefined,
    semester: 1,
  },
  {
    cookies: cookieStore,
  }
);
```

**구현 특징**:
- `fetchScoreDashboard` API 사용
- 쿠키 전달로 인증 처리
- 에러 처리 및 사용자 피드백 제공
- `InternalAnalysisCard`, `MockAnalysisCard`, `StrategyCard` 컴포넌트에 데이터 전달

## scoreQueries.ts 상태

**파일**: `app/(student)/scores/dashboard/_utils/scoreQueries.ts`

### 함수 상태

| 함수 | 상태 | 사용처 |
|------|------|--------|
| `fetchSchoolScores` | ⚠️ Deprecated | 사용처 없음 (school/page.tsx는 redirect만) |
| `fetchMockScores` | ⚠️ Deprecated | `mock/page.tsx`에서 사용 중 |

### 타입 상태

| 타입 | 상태 | 사용처 |
|------|------|--------|
| `SchoolScoreRow` | 유지 필요 | 여러 레거시 컴포넌트에서 사용 중 |
| `MockScoreRow` | 유지 필요 | 여러 레거시 컴포넌트에서 사용 중 |

## 권장 사항

### 즉시 적용 가능

1. **unified/page.tsx**
   - 이미 올바르게 구현되어 있음 ✅
   - 추가 작업 불필요

### 향후 작업

1. **mock/page.tsx 마이그레이션**
   - `fetchMockScores` 함수를 API 기반으로 변경
   - 새로운 통합 대시보드로 완전히 전환 시 삭제 고려

2. **scoreQueries.ts 정리**
   - 레거시 컴포넌트들이 모두 마이그레이션되면 함수 삭제
   - 타입 정의는 레거시 컴포넌트와의 호환성을 위해 별도 파일로 분리 고려

## 변경된 파일

### 확인 완료 (변경 불필요)
- `app/(student)/scores/dashboard/unified/page.tsx` - 이미 API 사용 중

### 유지 필요
- `app/(student)/scores/dashboard/_utils/scoreQueries.ts` - 레거시 컴포넌트 호환성 유지

## API 사용 예시

### unified/page.tsx에서의 사용

```typescript
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { cookies } from "next/headers";

// 서버 컴포넌트에서 사용
const cookieStore = await cookies();
const dashboardData = await fetchScoreDashboard(
  {
    studentId: student.id,
    tenantId: effectiveTenantId,
    grade: studentWithGrade?.grade || undefined,
    semester: 1,
  },
  {
    cookies: cookieStore,
  }
);

// 데이터 사용
const { studentProfile, internalAnalysis, mockAnalysis, strategyResult } = dashboardData;
```

## 결론

`dashboard/unified/page.tsx`는 이미 API 기반으로 올바르게 구현되어 있으며, 직접 DB 조회 함수를 사용하지 않습니다. 

레거시 대시보드(`mock/page.tsx`)에서 여전히 `fetchMockScores`를 사용하고 있으나, 이는 별도의 레거시 페이지이므로 unified 페이지와는 독립적으로 관리됩니다.

**목표 달성**: ✅ unified 페이지는 API 계층을 통한 데이터 접근으로 전환 완료

