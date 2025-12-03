# 상세정보 로딩 추가 최적화

**작업 일자**: 2025-12-03  
**작업 범위**: Phase 5-8 (추가 최적화)  
**문제**: 1개 콘텐츠 선택 시에도 3-5초 소요되는 성능 문제

## 개요

이전 최적화(Phase 1-4) 후에도 1개 콘텐츠 선택 시 3-5초가 소요되는 심각한 성능 문제가 발생하여 추가 최적화를 수행했습니다.

## 구현 내용

### Phase 5: 메타데이터 조회 제거 ✅

**파일**: `app/(student)/plan/new-group/_components/Step3Contents.tsx` (164줄, 212줄)

**변경사항**:

- `includeMetadata: true` → `false`로 변경
- 목차 로딩에 불필요한 메타데이터 조회 제거
- 추가 쿼리 2개(books, lectures 테이블) 제거

**주요 변경사항**:

- 배치 API 호출 시 `includeMetadata: false` 설정
- 폴백 개별 API 호출 시에도 `includeMetadata=false` 설정

**예상 개선**: 50-150ms 절감 (추가 쿼리 제거)

### Phase 6: 성능 로깅 추가 ✅

**파일**: `app/(student)/plan/new-group/_components/Step3Contents.tsx`

**변경사항**:

- 배치 API 호출 전후 시간 측정
- 각 단계별 소요 시간 기록:
  - 타입 확인 시간
  - 네트워크 요청 시간
  - JSON 파싱 시간
  - 데이터 처리 시간
  - 총 소요 시간
- 개발 환경에서만 콘솔 로그 출력

**주요 변경사항**:

- `performance.now()`를 사용한 정밀 시간 측정
- 배치 API 성공/실패 시 각각 다른 로깅
- 콘텐츠 개수별 평균 시간 계산

**예상 효과**: 병목 지점 파악으로 추가 최적화 방향 제시

### Phase 7: 데이터베이스 쿼리 최적화 확인 ✅

**파일**: `lib/data/contentMasters.ts` (1403-1413줄, 1457-1467줄)

**변경사항**:

- 쿼리 실행 시간 측정 추가
- 개발 환경에서 쿼리 성능 로깅
- 결과 개수 및 평균 시간 계산

**주요 변경사항**:

- `getStudentBookDetailsBatch()` 함수에 성능 로깅 추가
- `getStudentLectureEpisodesBatch()` 함수에 성능 로깅 추가
- 쿼리 실행 시간, 결과 개수, 콘텐츠당 평균 시간 로깅

**예상 효과**: 데이터베이스 쿼리 성능 모니터링 가능

### Phase 8: 네트워크 요청 최적화 확인 ✅

**파일**: `app/(student)/plan/new-group/_components/Step3Contents.tsx`

**변경사항**:

- 배치 API 사용 여부 명확히 표시
- 폴백 발생 시 상세 정보 로깅
- 응답 상태 코드 및 상태 텍스트 로깅

**주요 변경사항**:

- 배치 API 성공 시 `apiUsed: "batch"` 표시
- 폴백 발생 시 응답 상태 코드 및 상태 텍스트 로깅
- 콘텐츠당 평균 시간 계산

**예상 효과**: 네트워크 요청 패턴 파악 및 최적화 방향 제시

## 성능 로깅 예시

### 배치 API 성공 시

```
[Step3Contents] 배치 API 성능 측정: {
  contentCount: 1,
  typeCheckTime: "0.15ms",
  networkTime: "2500.00ms",
  parseTime: "2.50ms",
  processTime: "1.20ms",
  totalTime: "2503.85ms",
  avgTimePerContent: "2503.85ms",
  apiUsed: "batch"
}
```

### 데이터베이스 쿼리 성능

```
[getStudentBookDetailsBatch] 쿼리 성능: {
  bookCount: 1,
  resultCount: 150,
  queryTime: "120.50ms",
  avgTimePerBook: "120.50ms"
}
```

### 폴백 발생 시

```
[Step3Contents] 배치 API 실패, 개별 API로 폴백 {
  status: 500,
  statusText: "Internal Server Error",
  contentCount: 1
}
```

## 성능 개선 효과

### 예상 성능 지표

| 단계    | 현재 (1개)  | 개선 후     | 절감      |
| ------- | ----------- | ----------- | --------- |
| Phase 5 | 3-5초       | 2.85-4.85초 | 50-150ms  |
| Phase 6 | 2.85-4.85초 | 2.85-4.85초 | 측정 가능 |
| Phase 7 | 2.85-4.85초 | 2.85-4.85초 | 모니터링  |
| Phase 8 | 2.85-4.85초 | 2.85-4.85초 | 분석 가능 |

**주요 개선 사항**:

1. **메타데이터 조회 제거**: 불필요한 쿼리 2개 제거
2. **성능 모니터링**: 실제 병목 지점 파악 가능
3. **쿼리 성능 측정**: 데이터베이스 쿼리 성능 확인 가능

## 사용 방법

### 개발자 관점

1. **성능 로깅 확인**: 브라우저 콘솔에서 성능 로그 확인
2. **병목 지점 파악**: 각 단계별 소요 시간으로 병목 지점 식별
3. **추가 최적화**: 로그를 기반으로 추가 최적화 방향 결정

### 사용자 관점

- 메타데이터가 UI에 표시되지 않음 (목차만 표시)
- 성능 로깅은 개발 환경에서만 활성화되어 사용자 경험에 영향 없음

## 기술 세부사항

### 성능 측정 지점

1. **타입 확인**: 콘텐츠 타입 수집 시간
2. **네트워크 요청**: 배치 API 호출 시간
3. **JSON 파싱**: 응답 파싱 시간
4. **데이터 처리**: 결과 처리 및 상태 업데이트 시간
5. **데이터베이스 쿼리**: 실제 쿼리 실행 시간

### 로깅 조건

- 개발 환경(`NODE_ENV === "development"`)에서만 활성화
- 프로덕션 환경에서는 성능 오버헤드 없음

## 주의사항

1. **메타데이터 제거**: UI에 subject, semester 등이 표시되지 않음. 필요 시 별도 API로 분리
2. **성능 로깅**: 개발 환경에서만 활성화되어 프로덕션 성능에 영향 없음
3. **하위 호환성**: 배치 API는 기존 단일 API와 호환되도록 유지

## 다음 단계

성능 로깅 결과를 기반으로 추가 최적화 방향 결정:

1. **네트워크 지연이 주요 원인인 경우**:

   - API 응답 압축
   - CDN 활용
   - 캐싱 전략 개선

2. **데이터베이스 쿼리가 주요 원인인 경우**:

   - 쿼리 실행 계획 분석 (EXPLAIN)
   - 인덱스 최적화
   - 쿼리 구조 개선

3. **클라이언트 처리가 주요 원인인 경우**:
   - 데이터 처리 로직 최적화
   - 메모이제이션 활용
   - 가상 스크롤링 적용

## 관련 파일

### 수정된 파일

- `app/(student)/plan/new-group/_components/Step3Contents.tsx` (Phase 5, 6, 8, 9)
- `lib/data/contentMasters.ts` (Phase 7, 9)
- `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx` (Phase 10)
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx` (Phase 10)

### Phase 9: 상세정보 없음 디버깅 로그 추가 (우선순위 5)

**파일**: `app/(student)/plan/new-group/_components/Step3Contents.tsx`, `lib/data/contentMasters.ts`

**문제점**:

- 목차 정보가 없는 경우 원인 파악 어려움
- 데이터베이스에 실제로 데이터가 없는지, 조회가 실패했는지 구분 불가
- 배치 API 응답에서 contentData가 없는 경우 추적 어려움

**해결방안**:

- 배치 API 응답 처리 시 상세정보가 없는 경우 상세 로깅 추가
- 데이터베이스 쿼리 결과에서 목차/회차가 없는 콘텐츠 ID 목록 로깅
- contentData가 없는 경우 경고 로깅 추가

**변경사항**:

- `Step3Contents.tsx`: 배치 API 응답 처리 시 상세정보 없음 로깅 추가
- `getStudentBookDetailsBatch()`: 목차가 없는 교재 ID 목록 로깅 추가
- `getStudentLectureEpisodesBatch()`: 회차가 없는 강의 ID 목록 로깅 추가

**주요 변경사항**:

- 배치 API 응답에서 `details.length === 0`인 경우 상세 정보 로깅
- 데이터베이스 쿼리 결과에서 빈 배열인 콘텐츠 ID 목록 로깅
- 개발 환경에서만 활성화하여 프로덕션 성능에 영향 없음

### Phase 10: 중복 로그 방지 (우선순위 6)

**파일**: `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`, `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**문제점**:

- `ContentRangeInput`과 `RangeSettingModal`에서 상세정보 없음 로그가 리렌더링마다 반복 출력
- 동일한 콘텐츠에 대해 여러 번 로그가 출력되어 콘솔이 지저분해짐
- 불필요한 로그로 인해 실제 중요한 로그를 찾기 어려움

**해결방안**:

- `useRef`를 사용하여 각 컴포넌트 인스턴스당 한 번만 로그 출력
- `details`가 변경되면 로그 플래그 리셋하여 새로운 콘텐츠 로드 시 다시 로그 출력 가능
- 모달이 닫히면 로그 플래그 리셋

**변경사항**:

- `ContentRangeInput`: `useRef`로 중복 로그 방지, `details.length` 변경 시 플래그 리셋
- `RangeSettingModal`: `useRef`로 중복 로그 방지, 모달 닫힐 때 플래그 리셋

**주요 변경사항**:

- 각 컴포넌트 인스턴스당 한 번만 "상세정보 없음" 로그 출력
- 콘텐츠가 변경되면 다시 로그 출력 가능 (새로운 콘텐츠 확인)
- 개발 환경에서만 활성화

## 완료 상태

- ✅ Phase 5: 메타데이터 조회 제거
- ✅ Phase 6: 성능 로깅 추가
- ✅ Phase 7: 데이터베이스 쿼리 최적화 확인
- ✅ Phase 8: 네트워크 요청 최적화 확인
- ✅ Phase 9: 상세정보 없음 디버깅 로그 추가
- ✅ Phase 10: 중복 로그 방지
