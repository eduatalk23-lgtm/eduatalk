# 플랜 그룹 생성 시 콘텐츠 선택 및 상세 정보 로딩 최적화

**작업 일자**: 2025-02-02  
**작업 범위**: Phase 1-3 (필수 최적화)  
**예상 성능 개선**: 70-95% (900ms → 50-150ms)

## 개요

플랜 그룹 생성 시 콘텐츠 선택 및 상세 정보 불러오기 성능을 최적화하여 사용자 경험을 크게 개선했습니다.

### 문제점

- **순차적 API 호출**: `for` 루프로 콘텐츠를 하나씩 조회하여 9개 선택 시 900-1800ms 소요
- **네트워크 요청 수**: 콘텐츠 개수만큼 HTTP 요청 발생
- **데이터베이스 쿼리**: 각 콘텐츠별로 개별 쿼리 실행

## 구현 내용

### Phase 1: 클라이언트 사이드 병렬 처리 ✅

**파일**: `app/(student)/plan/new-group/_components/Step3Contents.tsx`

- `for` 루프를 `Promise.all` 패턴으로 변경하여 모든 API 호출을 병렬 처리
- 로딩 상태 관리 개선 (각 콘텐츠별 점진적 UI 업데이트)
- 캐시 확인 로직을 병렬 처리 전에 한 번에 수행

**주요 변경사항**:

- 113-166줄의 순차적 `for` 루프를 병렬 처리로 변경
- 캐시된 콘텐츠는 먼저 처리하고, 나머지만 API 호출
- 개별 콘텐츠 조회 완료 시마다 상태 업데이트로 즉각적인 피드백 제공

### Phase 2: 배치 조회 함수 추가 ✅

**파일**: `lib/data/contentMasters.ts`

- `getStudentBookDetailsBatch()`: 여러 교재의 상세 정보를 한 번의 쿼리로 조회
- `getStudentLectureEpisodesBatch()`: 여러 강의의 에피소드를 한 번의 쿼리로 조회
- `WHERE IN` 절을 사용하여 데이터베이스 쿼리 최소화
- 결과를 `Map<string, Detail[]>` 형태로 반환하여 클라이언트에서 쉽게 접근

**주요 변경사항**:

- 1318줄 이후에 배치 조회 함수 2개 추가
- 빈 배열 입력 시 빈 Map 반환 (안전성)
- 결과가 없는 콘텐츠도 빈 배열로 초기화하여 일관성 유지

### Phase 3: 배치 API 엔드포인트 생성 및 통합 ✅

**신규 파일**: `app/api/student-content-details/batch/route.ts`

- `POST /api/student-content-details/batch` 엔드포인트 생성
- 여러 콘텐츠를 한 번의 요청으로 조회
- 메타데이터 포함 옵션 지원
- 최대 20개까지 배치 조회 허용 (서버 부하 방지)

**Step3Contents 통합**:

- 배치 API를 우선 사용
- 배치 API 실패 시 개별 API로 자동 폴백 (하위 호환성)
- 네트워크 요청 횟수를 N번 → 1번으로 감소

**주요 변경사항**:

- 배치 API 요청 형식: `{ contents: [{ contentId, contentType }], includeMetadata?: boolean }`
- 배치 API 응답 형식: `{ [contentId]: { details/episodes, metadata? } }`
- 기존 단일 API 엔드포인트 하위 호환성 유지

## 성능 개선 효과

### 예상 성능 지표

| 항목             | 최적화 전  | Phase 1   | Phase 2+3 | 개선율     |
| ---------------- | ---------- | --------- | --------- | ---------- |
| 콘텐츠 1개       | 100ms      | 100ms     | 50ms      | 50%        |
| 콘텐츠 5개       | 500ms      | 100-150ms | 50-100ms  | 80-90%     |
| 콘텐츠 9개       | 900-1800ms | 100-300ms | 50-150ms  | **90-95%** |
| 네트워크 요청 수 | N개        | N개       | 1개       | **90%+**   |

### 주요 개선 사항

1. **응답 시간**: 900ms → 50-150ms (90-95% 개선)
2. **네트워크 요청**: N번 → 1번 (배치 API 사용 시)
3. **데이터베이스 쿼리**: N번 → 2-3번 (배치 쿼리 사용)

## 사용 방법

### 개발자 관점

배치 API는 자동으로 사용되며, 클라이언트 코드 변경 없이 기존 로직과 호환됩니다.

```typescript
// 자동으로 배치 API 사용
// 실패 시 개별 API로 자동 폴백
const response = await fetch("/api/student-content-details/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [
      { contentId: "id1", contentType: "book" },
      { contentId: "id2", contentType: "lecture" },
    ],
    includeMetadata: true,
  }),
});
```

### 사용자 관점

- 콘텐츠 선택 시 즉각적인 반응 (로딩 시간 대폭 단축)
- 여러 콘텐츠를 빠르게 선택 가능
- 점진적 UI 업데이트로 부드러운 사용자 경험

## 기술 세부사항

### 배치 API 엔드포인트

**엔드포인트**: `POST /api/student-content-details/batch`

**요청**:

```json
{
  "contents": [
    { "contentId": "book-123", "contentType": "book" },
    { "contentId": "lecture-456", "contentType": "lecture" }
  ],
  "includeMetadata": true
}
```

**응답**:

```json
{
  "success": true,
  "data": {
    "book-123": {
      "details": [...],
      "metadata": { ... }
    },
    "lecture-456": {
      "episodes": [...],
      "metadata": { ... }
    }
  }
}
```

### 배치 조회 함수

```typescript
// 교재 상세 정보 배치 조회
const bookDetailsMap = await getStudentBookDetailsBatch(bookIds, studentId);
// 결과: Map<bookId, BookDetail[]>

// 강의 에피소드 배치 조회
const episodesMap = await getStudentLectureEpisodesBatch(lectureIds, studentId);
// 결과: Map<lectureId, Episode[]>
```

## 주의사항

1. **배치 API 제한**: 한 번에 최대 20개까지 조회 가능 (서버 부하 방지)
2. **하위 호환성**: 기존 단일 API 엔드포인트는 그대로 유지
3. **에러 처리**: 배치 API 실패 시 자동으로 개별 API로 폴백
4. **캐싱**: 기존 캐싱 로직(`cachedDetailsRef`) 유지

## 향후 개선 방안

### Phase 4: React Query 도입 (선택적)

- `useQueries` 훅을 사용하여 여러 콘텐츠를 병렬로 조회
- 자동 캐싱 및 백그라운드 리프레시 지원
- 반복 조회 시 즉시 응답 (캐시 히트)

**구현 시 고려사항**:

- 프로젝트에 이미 `@tanstack/react-query` 설치됨
- 기존 `useEffect` 패턴을 `useQueries`로 마이그레이션
- 캐시 키 전략: `['content-details', contentId]`
- Stale time: 5분

## 관련 파일

### 수정된 파일

- `app/(student)/plan/new-group/_components/Step3Contents.tsx` (105-214줄)
- `lib/data/contentMasters.ts` (1318줄 이후 배치 함수 추가)

### 신규 파일

- `app/api/student-content-details/batch/route.ts`

### 참고 파일

- `app/api/student-content-details/route.ts` (기존 단일 조회 API)
- `lib/data/contentMetadata.ts` (배치 조회 패턴 참고)

## 테스트 권장사항

1. **성능 테스트**: 브라우저 DevTools Network 탭으로 네트워크 요청 시간 측정
2. **콘텐츠 개수별 테스트**: 1개, 5개, 9개 콘텐츠 선택 시 성능 비교
3. **에러 처리 테스트**: 배치 API 실패 시 개별 API 폴백 동작 확인
4. **캐싱 테스트**: 동일한 콘텐츠 재선택 시 캐시 사용 확인

## 완료 상태

- ✅ Phase 1: 클라이언트 사이드 병렬 처리
- ✅ Phase 2: 배치 조회 함수 추가
- ✅ Phase 3: 배치 API 엔드포인트 생성 및 통합
- ⏸️ Phase 4: React Query 도입 (선택적, 미구현)
