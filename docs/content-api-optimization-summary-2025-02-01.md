# 콘텐츠 API 성능 최적화 작업 요약

**작업 일자**: 2025-02-01  
**작업 내용**: 콘텐츠 API 성능 최적화 및 중복 코드 제거

## 개선 사항 요약

### 1. API 쿼리 최적화

#### 개선 전
- `books` 테이블을 3-4번 순차 조회
- `getStudentBookDetails()` 호출
- `total_pages`, `master_content_id` 조회
- `includeMetadata=true`일 때 메타데이터 별도 조회
- `master_books` fallback 조회

#### 개선 후
- `books` 테이블 조회를 단일 쿼리로 통합
- 필요한 모든 필드를 한 번에 조회: `total_pages`, `master_content_id`, `subject`, `semester`, `revision`, `difficulty_level`, `publisher`
- `getStudentBookDetails()`와 `books` 테이블 조회를 `Promise.all()`로 병렬 처리
- `master_books` fallback 조회는 조건부로 병렬 처리

**예상 성능 향상**: 3-4개 쿼리 → 1개 쿼리 (약 60% 감소), 순차 처리 → 병렬 처리 (약 40% 감소)

### 2. 배치 API 최적화

#### 개선 전
- 상세 정보와 메타데이터를 별도로 조회
- `total_pages`/`total_episodes` 정보 누락

#### 개선 후
- 상세 정보와 메타데이터를 동시에 조회 (병렬 처리)
- `total_pages`/`total_episodes` 정보 포함
- `master_books`/`master_lectures` fallback 조회 병렬 처리
- 관리자/컨설턴트의 `student_id` 파라미터 지원 추가

### 3. 클라이언트 사이드 최적화

#### 개선된 훅들
- `useContentTotals`: 순차 for 루프 → 배치 API 호출
- `useContentInfos`: 순차 for 루프 → 배치 API 호출 (학생 콘텐츠), 병렬 처리 (추천 콘텐츠)
- `useRangeEditor`: 최적화된 개별 API 사용 (단일 콘텐츠 조회)

### 4. 공통 코드 생성

#### 공통 유틸리티 (`lib/utils/contentDetailsUtils.ts`)
- 콘텐츠 타입 확인 로직
- API 엔드포인트 생성 로직
- 응답 데이터 변환 로직
- 배치 요청 생성 로직

#### 공통 훅 (`app/(student)/plan/new-group/_components/_shared/hooks/useContentDetailsBatch.ts`)
- 배치 API 호출 로직 통합
- 캐싱 로직 통합
- 에러 처리 통합
- Fallback 로직 포함

### 5. Next.js 캐싱 추가

- `app/api/student-content-details/route.ts`: `revalidate = 300` (5분 캐시)
- `app/api/student-content-details/batch/route.ts`: `revalidate = 300` (5분 캐시)

## 수정된 파일 목록

### API 라우트
1. `app/api/student-content-details/route.ts`
   - 단일 쿼리로 통합
   - 병렬 처리 적용
   - 캐싱 설정 추가

2. `app/api/student-content-details/batch/route.ts`
   - 메타데이터와 총량 정보 병렬 조회
   - `total_pages`/`total_episodes` 응답에 포함
   - 관리자/컨설턴트 `student_id` 지원
   - 캐싱 설정 추가

### 클라이언트 훅
3. `app/(student)/plan/new-group/_components/Step6FinalReview/hooks/useContentTotals.ts`
   - 배치 API 활용
   - 병렬 처리 개선

4. `app/(student)/plan/new-group/_components/Step6FinalReview/hooks/useContentInfos.ts`
   - 배치 API 활용 (학생 콘텐츠)
   - 병렬 처리 (추천 콘텐츠)

### 공통 코드
5. `lib/utils/contentDetailsUtils.ts` (신규)
   - 콘텐츠 타입 확인
   - API 엔드포인트 생성
   - 응답 데이터 변환

6. `app/(student)/plan/new-group/_components/_shared/hooks/useContentDetailsBatch.ts` (신규)
   - 배치 API 호출 로직 통합
   - 캐싱 및 에러 처리

## 예상 성능 개선

### Before
- **API 응답 시간**: 1800ms (3-4개 순차 쿼리)
- **클라이언트**: 순차 for 루프로 개별 API 호출

### After
- **API 응답 시간**: 400-600ms (병렬 처리 + 쿼리 통합)
- **클라이언트**: 배치 API 호출로 네트워크 요청 감소
- **개선율**: 약 70% 성능 향상

## 성능 테스트 가이드

### 1. API 응답 시간 측정

#### Before 측정
```bash
# 개발자 도구 Network 탭에서 확인
# 또는 curl로 측정
time curl "http://localhost:3000/api/student-content-details?contentType=book&contentId=xxx&includeMetadata=true"
```

#### After 측정
```bash
# 동일한 방법으로 측정하여 비교
time curl "http://localhost:3000/api/student-content-details?contentType=book&contentId=xxx&includeMetadata=true"
```

### 2. 배치 API 호출 테스트

```javascript
// 브라우저 콘솔에서 실행
const start = performance.now();
const response = await fetch("/api/student-content-details/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [
      { contentId: "id1", contentType: "book" },
      { contentId: "id2", contentType: "lecture" },
      // ... 더 많은 콘텐츠
    ],
    includeMetadata: true,
  }),
});
const end = performance.now();
console.log(`배치 API 응답 시간: ${end - start}ms`);
```

### 3. 캐싱 동작 확인

```bash
# 첫 번째 요청 (캐시 미스)
time curl "http://localhost:3000/api/student-content-details?contentType=book&contentId=xxx"

# 두 번째 요청 (캐시 히트 - 5분 이내)
time curl "http://localhost:3000/api/student-content-details?contentType=book&contentId=xxx"
```

### 4. 네트워크 요청 수 비교

#### Before
- 10개 콘텐츠 조회 시: 10개 개별 API 호출
- 총 네트워크 요청: 10개

#### After
- 10개 콘텐츠 조회 시: 1개 배치 API 호출
- 총 네트워크 요청: 1개

## 주의사항

1. **하위 호환성**: 기존 API 응답 형식 유지
2. **에러 처리**: 기존 에러 처리 로직 보존
3. **타입 안전성**: TypeScript 타입 정의 유지
4. **RLS 정책**: Supabase RLS 정책 준수

## 향후 개선 사항

1. **마스터 콘텐츠 배치 API**: 추천 콘텐츠도 배치로 조회 가능하도록 개선
2. **캐시 전략 조정**: 콘텐츠 업데이트 빈도에 따라 캐시 시간 조정
3. **모니터링**: API 응답 시간 모니터링 도구 도입
4. **에러 복구**: 배치 API 실패 시 개별 API로 자동 fallback (이미 구현됨)

## 참고 문서

- 원본 계획: `docs/api.plan.md`
- 프로젝트 가이드라인: `.cursor/rules/project_rule.mdc`

