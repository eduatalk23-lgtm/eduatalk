# 학생 코어 모듈 리팩토링: scoreQueries.ts 제거 완료

**작업 일시**: 2025-02-04  
**작업자**: AI Assistant  
**목표**: 레거시 DB 쿼리 파일(`scoreQueries.ts`) 제거 및 표준 데이터 계층으로 마이그레이션

---

## 📋 작업 개요

학생 코어 모듈 리팩토링의 마지막 단계로, 레거시 대시보드에서 사용하던 `scoreQueries.ts` 파일을 제거하고 표준 데이터 계층(`lib/data/...`)을 사용하도록 변경했습니다.

---

## ✅ 완료된 작업

### 1. `app/(student)/scores/dashboard/mock/page.tsx` 수정

#### 변경 사항

1. **임포트 변경**
   - ❌ 제거: `fetchMockScores` from `../_utils/scoreQueries`
   - ✅ 추가:
     - `getMockScores` from `@/lib/data/studentScores`
     - `getActiveCurriculumRevision`, `getSubjectHierarchyOptimized` from `@/lib/data/subjects`
     - `getTenantContext` from `@/lib/tenant/getTenantContext`
     - `MockScoreRow` from `@/lib/types/legacyScoreTypes`

2. **데이터 페칭 로직 구현**
   - `getTenantContext()`로 tenantId 조회
   - `getActiveCurriculumRevision()`로 활성 개정교육과정 조회
   - `getSubjectHierarchyOptimized()`로 교과/과목 계층 구조 조회
   - `getMockScores()`로 모의고사 성적 데이터 조회

3. **데이터 변환 함수 구현**
   - `extractExamType()`: `exam_title`에서 시험 유형 추출 ("평가원", "교육청", "사설")
   - `extractExamRound()`: `exam_date`에서 회차(월) 추출 (예: "3월", "6월")
   - `transformMockScoresToRows()`: `MockScore`를 `MockScoreRow`로 변환
     - `subject_group_id` → `subject_group` (교과군 이름)
     - `subject_id` → `subject_name` (과목 이름)
     - `exam_title` → `exam_type` (시험 유형)
     - `exam_date` → `exam_round` (회차)

4. **에러 처리 추가**
   - tenantId가 없는 경우 리다이렉트
   - 활성 개정교육과정이 없는 경우 에러 메시지 표시

### 2. 레거시 파일 삭제

- ✅ `app/(student)/scores/dashboard/_utils/scoreQueries.ts` 삭제 완료

---

## 🔄 데이터 변환 로직

### MockScore → MockScoreRow 변환

```typescript
// 입력: MockScore (정규화된 FK 기반)
{
  id: string;
  subject_group_id: string; // FK
  subject_id: string; // FK
  exam_title: string; // 예: "2024학년도 3월 평가원 모의고사"
  exam_date: string; // 예: "2024-03-15"
  // ...
}

// 출력: MockScoreRow (레거시 텍스트 기반)
{
  id: string;
  subject_group: string; // 매핑된 교과군 이름
  subject_name: string; // 매핑된 과목 이름
  exam_type: string; // "평가원", "교육청", "사설"
  exam_round: string; // "3월", "6월" 등
  // ...
}
```

### 변환 규칙

1. **교과군/과목 매핑**
   - `getSubjectHierarchyOptimized()`로 조회한 계층 구조에서 ID → 이름 매핑 생성
   - `subject_group_id` → 교과군 이름
   - `subject_id` → 과목 이름

2. **시험 유형 추출**
   - `exam_title`에 "평가원" 포함 → `exam_type = "평가원"`
   - `exam_title`에 "교육청" 포함 → `exam_type = "교육청"`
   - `exam_title`에 "사설" 포함 → `exam_type = "사설"`
   - 그 외 → `exam_title` 전체 반환

3. **회차 추출**
   - `exam_date`를 파싱하여 월 추출
   - 예: "2024-03-15" → "3월"

---

## 📊 영향 범위

### 수정된 파일

- `app/(student)/scores/dashboard/mock/page.tsx`

### 삭제된 파일

- `app/(student)/scores/dashboard/_utils/scoreQueries.ts`

### 영향받는 컴포넌트

다음 컴포넌트들은 `MockScoreRow` 타입을 사용하지만, 변환 로직이 올바르게 구현되어 기존 인터페이스를 유지합니다:

- `MockSummarySection`
- `MockExamTrendSection`
- `MockDetailedMetrics`
- `MockWeakSubjectSection`
- `MockInsightPanel`
- `MockExamTypeComparisonChart`
- `MockPercentileDistributionChart`

---

## ✅ 검증 사항

- [x] `mock/page.tsx`가 더 이상 `scoreQueries.ts`를 참조하지 않음
- [x] 표준 데이터 계층(`lib/data/...`) 사용
- [x] `MockScoreRow` 타입 변환 로직 정확성
- [x] 에러 처리 및 예외 상황 대응
- [x] 린터 오류 없음
- [x] `scoreQueries.ts` 파일 삭제 완료

---

## 🎯 달성한 목표

1. ✅ 레거시 DB 쿼리 파일 제거
2. ✅ 표준 데이터 계층으로 통합
3. ✅ 기존 컴포넌트 인터페이스 유지
4. ✅ 타입 안전성 보장

---

## 📝 참고 사항

### 향후 개선 사항

1. **레거시 타입 제거**: `MockScoreRow` 타입을 사용하는 모든 컴포넌트를 새로운 타입으로 마이그레이션
2. **통합 대시보드**: `/scores/dashboard/unified`로 완전 전환 후 레거시 대시보드 제거 고려

### 관련 문서

- `docs/2025-02-04-score-queries-dependency-refactoring.md`: 의존성 리팩토링 문서
- `docs/2025-02-04-score-dashboard-api-migration-complete.md`: API 마이그레이션 문서

---

**작업 완료**: ✅  
**다음 단계**: 학생 코어 모듈 리팩토링 완료
