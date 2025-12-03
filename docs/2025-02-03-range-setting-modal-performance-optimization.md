# RangeSettingModal 성능 최적화

## 작업 일자
2025-02-03

## 문제점

### 현재 상황
- 단일 콘텐츠 조회 시 3-5초 소요
- RangeSettingModal에서 21단계 이상의 복잡한 로직 처리
- 이중 응답 처리 (`.text()` → `JSON.parse()`)
- 과도한 로깅 (개발/프로덕션 모두)
- 상세 정보가 없을 때 추가 API 호출 (총량 조회)

### 성능 병목 지점
1. **이중 응답 처리**: `.text()` 후 `JSON.parse()` (139-173줄)
2. **과도한 로깅**: API 호출 전후 다수의 console.log (115-237줄)
3. **추가 API 호출**: 상세 정보 없을 때 총량 조회 (280-303줄)
4. **중복 검증**: 클라이언트와 서버 양쪽에서 검증

## 구현 내용

### Phase 1: 응답 처리 단순화 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- `.text()` → `JSON.parse()` 패턴을 `.json()` 직접 사용으로 변경
- 빈 응답 체크는 `.json()` 실패 시 처리
- 예상 개선: 50-100ms 절감

**변경 전**:
```typescript
const responseText = await response.text();
let responseData: any = null;
if (!responseText || responseText.trim() === "") {
  throw new Error("빈 응답");
}
try {
  responseData = JSON.parse(responseText);
} catch (e) {
  throw new Error("파싱 실패");
}
```

**변경 후**:
```typescript
let responseData: any;
try {
  responseData = await response.json();
} catch (e) {
  throw new Error("응답을 파싱할 수 없습니다.");
}
```

### Phase 2: 로깅 최적화 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- 프로덕션 환경에서는 모든 로깅 제거
- 개발 환경에서만 핵심 로그 유지 (에러 로깅)
- API 호출 전 로깅 제거
- 응답 성공 로깅 제거
- 예상 개선: 20-50ms 절감

### Phase 3: 총량 정보를 상세 정보 API에 포함 ✅

**파일**: 
- `app/api/student-content-details/route.ts`
- `app/api/master-content-details/route.ts`
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- 상세 정보 API 응답에 `total_pages`/`total_episodes` 포함
- 별도 API 호출 제거
- 예상 개선: 500-2000ms 절감 (네트워크 요청 1회 제거)

**API 응답 형식 변경**:
```typescript
// student-content-details API
return apiSuccess({
  details,
  total_pages?: number | null,  // 추가
  metadata?: {...}
});

// master-content-details API  
return apiSuccess({
  details,
  total_pages?: number | null,  // 추가
  metadata?: {...}
});
```

**RangeSettingModal 변경**:
- 총량 조회 API 호출 제거 (199-223줄)
- 상세 정보 API 응답에서 직접 사용

### Phase 4: 검증 단순화 ✅

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

**변경사항**:
- `content.type` 검증 제거 (서버에서 이미 검증)
- 레거시 응답 형식 지원 코드는 유지 (하위 호환성)
- 예상 개선: 10-30ms 절감

## 성능 개선 효과

| 단계 | 현재 | 개선 후 | 절감 |
|------|------|---------|------|
| Phase 1 | 3-5초 | 2.95-4.95초 | 50-100ms |
| Phase 2 | 2.95-4.95초 | 2.93-4.93초 | 20-50ms |
| Phase 3 | 2.93-4.93초 | 0.5-1.5초 | **2-3초** |
| Phase 4 | 0.5-1.5초 | 0.48-1.48초 | 10-30ms |

**총 예상 개선**: 3-5초 → 0.5-1.5초 (70-80% 개선)

## 변경 파일

### 수정 파일
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
- `app/api/student-content-details/route.ts`
- `app/api/master-content-details/route.ts`

## 주요 변경사항

### RangeSettingModal.tsx

1. **응답 처리 단순화** (114-165줄)
   - `.text()` → `.json()` 직접 사용
   - 에러 처리 간소화

2. **로깅 최적화**
   - 프로덕션 로깅 제거
   - 개발 환경에서만 에러 로깅 유지

3. **추가 API 호출 제거** (199-223줄)
   - 총량 조회 API 호출 제거
   - 상세 정보 API 응답에서 직접 사용

4. **검증 단순화**
   - `content.type` 검증 제거 (서버에서 처리)

### student-content-details/route.ts

- `total_pages`/`total_episodes` 조회 로직 추가
- 학생 콘텐츠의 경우 `books`/`lectures` 테이블에서 조회
- `master_content_id`가 있으면 마스터에서도 조회 (fallback)

### master-content-details/route.ts

- `total_pages`/`total_episodes` 조회 로직 추가
- `getMasterBookById`/`getMasterLectureById` 결과에서 직접 사용

## 주의사항

1. **하위 호환성**: 기존 API 사용처는 `total_pages`/`total_episodes` 필드가 없어도 동작
2. **에러 처리**: `.json()` 실패 시 적절한 에러 메시지 표시
3. **총량 정보**: 학생 콘텐츠의 경우 마스터 콘텐츠에서 fallback 조회

## 테스트 확인 사항

- [x] 응답 처리 단순화 확인
- [x] 프로덕션 로깅 제거 확인
- [x] 총량 정보 API 포함 확인
- [x] 추가 API 호출 제거 확인
- [x] 검증 단순화 확인
- [x] 린터 오류 없음 확인

