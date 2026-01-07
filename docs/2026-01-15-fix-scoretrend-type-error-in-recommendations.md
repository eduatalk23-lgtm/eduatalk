# scoreTrend 타입 에러 수정

## 작업 일시
2026-01-15

## 문제 상황

### 에러 메시지
```
TypeError: scoreTrend.decliningSubjects is not iterable
at getSubjectRecommendations (lib/recommendations/subjectRecommendation.ts:117:38)
```

### 원인 분석
`getScoreTrend` 함수는 `MetricsResult<ScoreTrendMetrics>` 타입을 반환합니다:
- 성공 시: `{ success: true, data: ScoreTrendMetrics }`
- 실패 시: `{ success: false, error: string, ... }`

하지만 다음 파일들에서 `scoreTrend.decliningSubjects`에 직접 접근하고 있어 에러가 발생했습니다:
1. `lib/recommendations/subjectRecommendation.ts:117`
2. `lib/recommendations/planRegenerationSuggestion.ts:95`

## 수정 내용

### 1. `lib/recommendations/subjectRecommendation.ts`

**변경 사항**:
- 44번 라인: `scoreTrend` → `scoreTrendResult`로 변수명 변경
- 51-59번 라인 이후: `scoreTrendData` 변수 추가 (성공/실패 처리)
- 117번 라인: `scoreTrend.decliningSubjects` → `scoreTrendData.decliningSubjects`로 변경

**추가된 코드**:
```typescript
// 성적 추이 결과 처리
const scoreTrendData = scoreTrendResult.success
  ? scoreTrendResult.data
  : {
      hasDecliningTrend: false,
      decliningSubjects: [],
      lowGradeSubjects: [],
      recentScores: [],
    };
```

### 2. `lib/recommendations/planRegenerationSuggestion.ts`

**변경 사항**:
- 78번 라인: `scoreTrend` → `scoreTrendResult`로 변수명 변경
- 84-92번 라인 이후: `scoreTrendData` 변수 추가 (성공/실패 처리)
- 95번 라인: `scoreTrend.decliningSubjects` → `scoreTrendData.decliningSubjects`로 변경

**추가된 코드**:
```typescript
// 성적 추이 결과 처리
const scoreTrendData = scoreTrendResult.success
  ? scoreTrendResult.data
  : {
      hasDecliningTrend: false,
      decliningSubjects: [],
      lowGradeSubjects: [],
      recentScores: [],
    };
```

## 참고 패턴

`lib/risk/engine.ts`의 96-103번 라인에서 사용하는 올바른 패턴을 참고하여 동일하게 적용했습니다:

```typescript
const scoreTrend = scoreTrendResult.success
  ? scoreTrendResult.data
  : {
      hasDecliningTrend: false,
      decliningSubjects: [],
      lowGradeSubjects: [],
      recentScores: [],
    };
```

## 검증

- ✅ 린터 에러 없음
- ✅ 타입 안전성 확보
- ✅ 에러 발생 시 기본값 제공으로 안정성 향상

## 영향 범위

- `lib/recommendations/subjectRecommendation.ts`: 과목별 추천 생성 기능
- `lib/recommendations/planRegenerationSuggestion.ts`: 플랜 재생성 제안 기능

두 파일 모두 `getScoreTrend` 함수의 반환값을 올바르게 처리하도록 수정되어, 에러 발생 시에도 안정적으로 동작합니다.

