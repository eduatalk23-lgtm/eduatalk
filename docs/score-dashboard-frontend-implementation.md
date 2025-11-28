# 성적 대시보드 프론트엔드 구현 가이드

## 📋 개요

이 문서는 성적 대시보드 프론트엔드 리팩토링 작업 결과를 정리합니다.

**작업 목적**: DB 스키마가 아닌 API 응답 구조를 단일 진실 소스(Single Source of Truth)로 사용하여 프론트엔드를 구현

**기준 API**: `/api/students/[id]/score-dashboard`

---

## 🏗️ 구현 내용

### 1. 타입 정의 및 API 클라이언트

#### 📁 `lib/types/scoreDashboard.ts`

성적 대시보드 API 응답 구조를 정의하는 타입 파일입니다.

**주요 타입**:
- `StudentProfile`: 학생 기본 정보
- `InternalAnalysis`: 내신 분석 결과
- `MockAnalysis`: 모의고사 분석 결과
- `StrategyResult`: 수시/정시 전략 분석
- `ScoreDashboardResponse`: 전체 API 응답 타입
- `StrategyType`: 전략 유형 유니온 타입 (`"BALANCED" | "MOCK_ADVANTAGE" | "INTERNAL_ADVANTAGE"`)

**타입 안정성**:
- 문자열 상수는 유니온 타입으로 관리하여 오타 위험 제거
- null 가능 필드는 명시적으로 `| null` 표시

#### 📁 `lib/api/scoreDashboard.ts`

API 호출을 위한 클라이언트 유틸리티 함수입니다.

**주요 함수**:

```typescript
// API 호출 함수
export async function fetchScoreDashboard(
  params: ScoreDashboardParams
): Promise<ScoreDashboardResponse>

// React Query 키 생성 함수
export const scoreDashboardQueryKey = (params: ScoreDashboardParams) => [...]
```

**기능**:
- URL 생성 및 쿼리 파라미터 처리
- 에러 핸들링 (상세한 에러 메시지 포함)
- SSR 환경 고려 (`window` 객체 체크)

---

### 2. UI 페이지 및 컴포넌트

#### 📁 `app/(student)/scores/dashboard/unified/page.tsx`

통합 성적 대시보드 메인 페이지입니다.

**주요 기능**:
1. 인증 확인 (미로그인 시 로그인 페이지로 리다이렉트)
2. Tenant 및 학생 정보 조회
3. API 호출을 통한 대시보드 데이터 가져오기
4. 로딩/에러/데이터 없음 상태 처리
5. 4개 카드 섹션 렌더링

**렌더링 구조**:
```
- 헤더 (제목, 설명)
- 학생 프로필 카드
- 2열 레이아웃 (내신 + 모의고사)
  - 내신 분석 카드
  - 모의고사 분석 카드
- 수시/정시 전략 카드
- 추가 액션 (성적 입력, 상세 분석 링크)
```

---

#### 📁 `_components/StudentProfileCard.tsx`

학생 기본 정보를 표시하는 카드 컴포넌트입니다.

**표시 정보**:
- 이름
- 학년
- 학교 유형 (schoolType - school_info.school_property 값)
- 학기 정보 (학년 + 학기)
- 학교 연도

**특징**:
- 4열 그리드 레이아웃 (반응형)
- null 값은 "N/A" 표시

---

#### 📁 `_components/InternalAnalysisCard.tsx`

내신 성적 분석을 표시하는 카드 컴포넌트입니다.

**표시 정보**:
1. **전체 지표** (2열 그리드)
   - 전체 GPA (indigo 배경)
   - Z-Index (purple 배경)

2. **교과군별 평점**
   - GPA 높은 순으로 정렬
   - 교과군명 + GPA 표시

**특징**:
- 데이터 없을 시 안내 메시지 표시
- 배경색으로 시각적 구분

---

#### 📁 `_components/MockAnalysisCard.tsx`

모의고사 성적 분석을 표시하는 카드 컴포넌트입니다.

**표시 정보**:
1. **최근 시험 정보** (파란색 배경)
   - 시험명
   - 시험 날짜

2. **주요 지표** (3개 행)
   - 평균 백분위
   - 표준점수 합계
   - 상위 3개 등급 합

**특징**:
- recentExam이 null이면 "데이터 없음" 표시
- 각 지표는 흰색 카드로 구분

---

#### 📁 `_components/StrategyCard.tsx`

수시/정시 전략 분석을 표시하는 카드 컴포넌트입니다.

**표시 정보**:
1. **전략 유형 배지**
   - BALANCED: 녹색
   - MOCK_ADVANTAGE: 파란색
   - INTERNAL_ADVANTAGE: 보라색

2. **전략 메시지**
   - 회색 배경에 텍스트 표시

3. **비교 데이터** (3열 그리드)
   - 내신 환산 백분위
   - 모의고사 평균 백분위
   - 백분위 차이 (양수: 파란색, 음수: 보라색)

4. **안내 문구**
   - 파란색 배경 정보 박스

**특징**:
- 전략 유형별로 색상 자동 변경
- 차이 값에 따른 색상 구분
- 타입 안전성 보장 (StrategyType 유니온)

---

## 🔄 기존 코드 정리

### 레거시 표시 및 주석 추가

다음 파일들에 레거시 경고 주석을 추가했습니다:

1. **`app/(student)/scores/dashboard/_utils/scoreQueries.ts`**
   - `fetchSchoolScores()`, `fetchMockScores()` 함수에 `@deprecated` 태그 추가
   - 새로운 API 사용 권장 주석 추가

2. **`lib/data/studentScores.ts`**
   - `getSchoolScores()` 함수에 경고 로그 추가
   - student_school_scores → student_internal_scores 테이블명 수정

### 유지된 파일

다음 파일들은 현재 스키마를 올바르게 사용하고 있어 유지:
- 현재 student_internal_scores, student_mock_scores 테이블을 사용하는 코드
- subject_groups 테이블을 참조하는 코드 (정상)

---

## 📊 데이터 흐름

```
[Client/Server Component]
         ↓
  fetchScoreDashboard()
  (lib/api/scoreDashboard.ts)
         ↓
  GET /api/students/[id]/score-dashboard
  (app/api/students/[id]/score-dashboard/route.ts)
         ↓
  [Internal Services]
  - getInternalAnalysis()
  - getMockAnalysis()
  - analyzeAdmissionStrategy()
         ↓
  [Database Tables]
  - student_internal_scores
  - student_mock_scores
  - student_terms
  - subject_groups
         ↓
  ScoreDashboardResponse
         ↓
  [UI Components]
  - StudentProfileCard
  - InternalAnalysisCard
  - MockAnalysisCard
  - StrategyCard
```

---

## 🧪 테스트 방법

### 1. API 테스트 (백엔드)

```bash
# 더미 데이터 생성
npx tsx scripts/seedScoreDashboardDummy.ts

# API 호출 테스트
npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> [grade] [semester]
```

### 2. UI 테스트 (프론트엔드)

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 브라우저에서 접속:
   ```
   http://localhost:3000/scores/dashboard/unified
   ```

3. 확인 사항:
   - [ ] 학생 프로필 정보가 올바르게 표시되는가?
   - [ ] 내신 분석 데이터가 정상적으로 보이는가?
   - [ ] 모의고사 분석이 제대로 렌더링되는가?
   - [ ] 전략 카드의 배지 색상이 전략 유형에 맞게 나오는가?
   - [ ] 데이터가 없을 때 적절한 안내 메시지가 표시되는가?
   - [ ] 에러 발생 시 에러 화면이 나오는가?

---

## 📝 사용 방법

### 새로운 성적 관련 기능 구현 시

```typescript
// ✅ 권장: API 기반 접근
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import type { ScoreDashboardResponse } from "@/lib/types/scoreDashboard";

const data = await fetchScoreDashboard({
  studentId: "...",
  tenantId: "...",
  grade: 2,
  semester: 1,
});

// data.studentProfile
// data.internalAnalysis
// data.mockAnalysis
// data.strategyResult
```

```typescript
// ❌ 비권장: DB 직접 조회
import { fetchSchoolScores } from "@/app/(student)/scores/dashboard/_utils/scoreQueries";
const scores = await fetchSchoolScores(studentId); // Deprecated!
```

### React Query 사용 예시 (클라이언트 컴포넌트)

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchScoreDashboard,
  scoreDashboardQueryKey,
} from "@/lib/api/scoreDashboard";

export function MyComponent({ studentId, tenantId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: scoreDashboardQueryKey({ studentId, tenantId }),
    queryFn: () => fetchScoreDashboard({ studentId, tenantId }),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;

  return <div>{/* 데이터 렌더링 */}</div>;
}
```

---

## 🚀 향후 개선 사항

### 1. 기존 대시보드 마이그레이션

현재 `/scores/dashboard` 경로는 레거시 코드를 사용합니다.
다음 단계로 통합 대시보드(`/unified`)로 전환을 고려해야 합니다.

**마이그레이션 계획**:
1. 사용자 피드백 수집
2. 기능 비교 및 누락 기능 보완
3. `/scores/dashboard` → `/scores/dashboard/unified` 리다이렉트
4. 레거시 코드 제거

### 2. 클라이언트 사이드 렌더링 최적화

현재 페이지는 서버 컴포넌트로 구현되어 있습니다.
필요시 React Query를 활용한 클라이언트 사이드 구현 고려:
- 실시간 업데이트
- 낙관적 업데이트 (Optimistic Updates)
- 캐싱 전략

### 3. 차트 추가

현재는 숫자 위주의 정보 표시입니다.
시각화 라이브러리(recharts)를 활용하여 차트 추가 고려:
- 내신 GPA 트렌드 라인 차트
- 모의고사 백분위 추이 그래프
- 교과군별 레이더 차트

### 4. 필터링 기능

학기별 필터링, 기간 선택 등의 기능 추가

---

## 📚 참고 문서

- [API 구현 문서](./score-dashboard-api-implementation.md)
- [더미 데이터 생성 가이드](./score-dashboard-dummy-data.md)
- [스키마 정리 문서](./score-dashboard-schema-alignment.md)

---

**작성일**: 2024-11-28  
**작성자**: AI Assistant  
**프로젝트**: TimeLevelUp (EduaTalk)

