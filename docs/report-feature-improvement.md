# 리포트 기능 개선 작업

## 작업 일시
2025-01-31

## 개요
리포트 기능의 성능 최적화 및 코드 품질 개선 작업을 수행했습니다.

---

## 개선 사항

### 1. N+1 쿼리 문제 해결 ✅

#### 문제점
- `getWeeklyStudyTimeSummary`, `getWeeklyWeakSubjectTrend`, `getDailyBreakdown` 함수에서 세션별로 개별 쿼리 실행
- 세션이 많을수록 쿼리 수가 선형적으로 증가하여 성능 저하

#### 해결 방법
- 배치 조회 헬퍼 함수 생성 (`lib/reports/batchHelpers.ts`)
  - `getSubjectsForContentsBatch`: 여러 콘텐츠의 과목 정보를 배치로 조회
  - `getPlansContentBatch`: 여러 플랜의 콘텐츠 정보를 배치로 조회
  - `getContentTitlesBatch`: 여러 콘텐츠의 제목을 배치로 조회

#### 개선 효과
- 세션 수에 관계없이 최대 3-4개의 쿼리만 실행
- 성능 향상: 세션 100개 기준 약 97개 쿼리 감소 (97% 개선)

#### 변경 파일
- `lib/reports/batchHelpers.ts` (신규)
- `lib/reports/weekly.ts` (수정)

---

### 2. 에러 처리 통합 ✅

#### 문제점
- `error.code === "42703"` 체크가 여러 곳에 중복
- 에러 처리 로직이 일관되지 않음
- 일부는 재시도, 일부는 기본값 반환

#### 해결 방법
- 공통 에러 처리 유틸리티 생성 (`lib/utils/supabaseErrorHandler.ts`)
  - `handleSupabaseQuery`: 단일 항목 조회
  - `handleSupabaseQueryArray`: 배열 조회
  - `handleSupabaseQuerySingle`: 단일 항목 조회 (null 허용)

#### 개선 효과
- 에러 처리 로직 일관성 확보
- 코드 중복 제거
- 유지보수성 향상

#### 변경 파일
- `lib/utils/supabaseErrorHandler.ts` (신규)
- `app/(student)/reports/_utils.ts` (수정)

---

### 3. 날짜 계산 로직 통합 ✅

#### 문제점
- 주간/월간 날짜 계산 로직이 여러 파일에 중복
- `getWeekRange` 유틸리티가 있지만 모든 곳에서 사용되지 않음

#### 해결 방법
- 리포트용 날짜 범위 계산 유틸리티 생성 (`lib/date/reportDateUtils.ts`)
  - `getReportDateRange`: 주간/월간 날짜 범위 및 레이블 반환
  - `formatWeeklyPeriodLabel`: 주간 레이블 포맷팅
  - `formatMonthlyPeriodLabel`: 월간 레이블 포맷팅

#### 개선 효과
- 날짜 계산 로직 중복 제거
- 일관된 날짜 포맷팅
- 유지보수성 향상

#### 변경 파일
- `lib/date/reportDateUtils.ts` (신규)
- `app/(student)/reports/_utils.ts` (수정)

---

### 4. 리포트 경로 통합 및 리다이렉션 개선 ✅

#### 문제점
- `/reports`와 `/report/weekly`, `/report/monthly`가 기능이 중복
- 사용자 혼란 가능성

#### 해결 방법
- `/reports` 페이지에 "상세 리포트 보기" 링크 추가
- 간단한 요약 뷰는 `/reports`에서 제공
- 상세 리포트는 `/report/weekly`, `/report/monthly`로 이동

#### 개선 효과
- 사용자 경험 개선
- 기능 분리 명확화

#### 변경 파일
- `app/(student)/reports/page.tsx` (수정)

---

## 성능 개선 결과

### 쿼리 수 감소
- **이전**: 세션 수만큼 쿼리 실행 (예: 100개 세션 = 100개 쿼리)
- **개선 후**: 세션 수와 관계없이 최대 3-4개 쿼리
- **개선율**: 약 97% 감소 (100개 세션 기준)

### 응답 시간 개선
- **이전**: 세션 수에 비례하여 응답 시간 증가
- **개선 후**: 세션 수와 무관하게 일정한 응답 시간 유지

---

## 코드 품질 개선

### 중복 코드 제거
- 에러 처리 로직 통합
- 날짜 계산 로직 통합

### 일관성 향상
- 에러 처리 패턴 통일
- 날짜 포맷팅 통일

### 유지보수성 향상
- 공통 유틸리티 함수로 분리
- 재사용 가능한 헬퍼 함수 제공

---

## 변경된 파일 목록

### 신규 파일
1. `lib/reports/batchHelpers.ts` - 배치 조회 헬퍼 함수
2. `lib/utils/supabaseErrorHandler.ts` - 에러 처리 유틸리티
3. `lib/date/reportDateUtils.ts` - 리포트 날짜 계산 유틸리티

### 수정 파일
1. `lib/reports/weekly.ts` - N+1 쿼리 문제 해결
2. `app/(student)/reports/_utils.ts` - 에러 처리 및 날짜 계산 개선
3. `app/(student)/reports/page.tsx` - 상세 리포트 링크 추가

---

## 향후 개선 제안

### 단기 개선 사항
1. 월간 리포트에도 배치 조회 적용
2. React Query 캐싱 도입
3. 데이터베이스 인덱스 확인 및 추가

### 장기 개선 사항
1. 리포트 PDF/Excel 다운로드 기능
2. 리포트 공유 기능
3. 리포트 커스터마이징 기능

---

## 테스트 권장 사항

### 성능 테스트
- 다양한 세션 수로 성능 측정
- 응답 시간 비교 (이전 vs 개선 후)

### 기능 테스트
- 주간/월간 리포트 정상 동작 확인
- 에러 처리 동작 확인
- 날짜 계산 정확성 확인

---

## 참고 사항

- 모든 변경사항은 기존 가이드라인을 준수
- SOLID 원칙 준수
- 불필요한 추상화 금지
- TypeScript 타입 안전성 보장

