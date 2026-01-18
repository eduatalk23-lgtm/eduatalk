# 성적 분석 페이지 타입 안전성 및 코드 최적화

## 작업 일자
2025-02-02

## 작업 개요
성적 분석 페이지의 타입 안전성을 개선하고, 데이터 조인 키 불일치 문제를 수정하며, 중복 코드를 제거했습니다.

## 주요 문제점

### 1. 긴급 (P0): 데이터 조인 키 불일치
- **문제**: Supabase 쿼리는 `subject:subjects(name)` 형태로 조인하지만, 컴포넌트에서 `s.subjects?.name` (복수형)로 접근
- **결과**: 모든 과목명이 "알 수 없음"으로 표시됨
- **해결**: `s.subjects?.name` → `s.subject?.name` (단수형)으로 수정

### 2. 높음 (P1): 타입 안전성 부족
- **문제**: 모든 컴포넌트에서 `any[]` 타입 사용
- **해결**: 명시적 타입 정의 및 적용

### 3. 중간 (P2): 중복 코드
- **문제**: 동일한 데이터 변환 로직이 3곳에서 반복 (`scoresWithNames` 변환)
- **해결**: 공통 유틸리티 함수로 단일화

## 변경 사항

### 신규 파일

#### 1. `lib/types/scoreAnalysis.ts`
- Supabase 조인 결과 타입 정의
  - `InternalScoreWithRelations`: 내신 성적 + 조인된 관계 데이터
  - `MockScoreWithRelations`: 모의고사 성적 + 조인된 관계 데이터
- 분석용 확장 타입
  - `EnrichedInternalScore`: 과목명 및 교과군명이 포함된 내신 성적
  - `EnrichedMockScore`: 과목명 및 교과군명이 포함된 모의고사 성적

#### 2. `lib/utils/scoreTransform.ts`
- 데이터 변환 유틸리티 함수
  - `enrichInternalScore`: 내신 성적에 과목명 및 교과군명 추가
  - `enrichMockScore`: 모의고사 성적에 과목명 및 교과군명 추가
  - `enrichInternalScores`: 내신 성적 배열 일괄 변환
  - `enrichMockScores`: 모의고사 성적 배열 일괄 변환

### 수정 파일

#### 1. `lib/data/scoreDetails.ts`
- 반환 타입을 `any[]`에서 명시적 타입으로 변경
  - `getInternalScoresByTerm`: `InternalScoreWithRelations[]` 반환
  - `getMockScoresByPeriod`: `MockScoreWithRelations[]` 반환
  - `getMockScoresByExam`: `MockScoreWithRelations[]` 반환
- `getInternalAverageBySubjectGroup` 함수에서 `any` 타입 제거

#### 2. `app/(student)/scores/analysis/_components/InternalDetailAnalysis.tsx`
- Props 타입: `any[]` → `InternalScoreWithRelations[]`
- 중복된 `scoresWithNames` 변환 로직 제거
- `enrichInternalScores` 유틸리티 함수 사용
- `s.subjects?.name` → `s.subject?.name` 수정 (키 불일치 해결)

#### 3. `app/(student)/scores/analysis/_components/MockDetailAnalysis.tsx`
- Props 타입: `any[]` → `MockScoreWithRelations[]`
- 중복된 `scoresWithNames` 변환 로직 제거
- `enrichMockScores` 유틸리티 함수 사용
- `s.subjects?.name` → `s.subject_name` 수정 (enriched 데이터 사용)

#### 4. `app/(student)/scores/analysis/_components/AnalysisLayout.tsx`
- Props 타입: `any[]` → `InternalScoreWithRelations[]`, `MockScoreWithRelations[]`

#### 5. `app/(student)/scores/analysis/_components/InternalSubjectTable.tsx`
- Props 타입: `any[]` → `InternalScoreWithRelations[]`

#### 6. `lib/analysis/scoreAnalyzer.ts`
- `InternalScoreData`, `MockScoreData` 타입 제거
- `EnrichedInternalScore`, `EnrichedMockScore` 타입 사용
- 모든 분석 함수의 파라미터 타입 개선

## 기술적 세부사항

### Supabase 조인 구문
```typescript
// Supabase 쿼리
.select(`
  *,
  subject:subjects(name),
  subject_group:subject_groups(name)
`)

// 결과는 단수형 키로 반환됨
// ❌ 잘못된 접근: score.subjects?.name
// ✅ 올바른 접근: score.subject?.name
```

### 타입 안전성 개선
- 모든 `any` 타입 제거
- 명시적 타입 정의로 IDE 자동완성 지원
- 컴파일 타임 에러 감지 가능

### 코드 중복 제거
- 이전: 각 컴포넌트에서 개별적으로 데이터 변환
- 이후: 공통 유틸리티 함수로 단일화
- `useMemo`를 통한 성능 최적화

## 테스트 결과

### 타입 체크
- ✅ TypeScript 컴파일 에러 없음
- ✅ ESLint 에러 없음
- ✅ 모든 `any` 타입 제거 확인

### 기능 테스트
- ✅ 과목명이 올바르게 표시됨 (키 불일치 해결)
- ✅ 내신/모의고사 탭 전환 정상 작동
- ✅ 데이터 변환 로직 정상 작동

## 예상 효과

1. **타입 안전성 향상**: 모든 `any` 타입 제거, 컴파일 타임 에러 감지
2. **버그 수정**: 과목명이 올바르게 표시됨
3. **코드 중복 제거**: 데이터 변환 로직 단일화
4. **유지보수성 향상**: 타입 정의로 인한 명확한 인터페이스
5. **개발 경험 개선**: IDE 자동완성 및 타입 체크 지원

## 참고 자료

- Supabase 조인 구문: `subject:subjects(name)` → 결과는 `subject` (단수) 키로 반환
- Next.js 15 모범 사례: Server Component에서 타입 안전한 데이터 페칭
- TypeScript 모범 사례: 명시적 타입 정의 및 `any` 타입 금지

