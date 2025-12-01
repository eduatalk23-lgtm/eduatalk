# RangeSettingModal API 에러 처리 개선

## 📋 작업 개요

`RangeSettingModal` 컴포넌트에서 `/api/master-content-details` API 호출 시 발생하는 에러를 개선했습니다.

## 🐛 문제점

1. **빈 응답 처리 부족**: API가 빈 응답을 반환할 때 적절한 에러 메시지가 표시되지 않음
2. **에러 메시지 파싱 실패**: `responseData.error?.message`가 없을 때 빈 객체 `{}`가 로그에 출력됨
3. **에러 로깅 부족**: 디버깅에 필요한 상세 정보 부족

## ✅ 개선 사항

### 1. RangeSettingModal 에러 처리 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

#### 변경 사항:
- 빈 응답 체크 추가
- 응답 파싱 실패 시 더 상세한 에러 정보 로깅
- HTTP 상태 코드 체크와 API 응답 형식 체크 분리
- 레거시 응답 형식 지원 (success 필드가 없는 경우)
- 에러 메시지 우선순위 개선:
  1. `responseData.error.message`
  2. `responseData.message`
  3. 기본 메시지

```typescript
// 빈 응답 체크
if (!responseText || responseText.trim() === "") {
  throw new Error("서버에서 빈 응답을 받았습니다.");
}

// 에러 메시지 우선순위
const errorMessage = 
  responseData?.error?.message || 
  responseData?.message ||
  `서버 오류가 발생했습니다. (${response.status})`;
```

### 2. API 라우트 에러 처리 개선

**파일**: `app/api/master-content-details/route.ts`

#### 변경 사항:
- `getMasterBookById`와 `getMasterLectureById` 호출을 try-catch로 감싸기
- 에러 발생 시 상세한 로깅 추가
- 빈 배열 기본값 제공 (`details || []`, `episodes || []`)

```typescript
try {
  const { details } = await getMasterBookById(contentId);
  return apiSuccess({ details: details || [] });
} catch (error) {
  console.error("[api/master-content-details] 교재 조회 실패:", {
    contentId,
    contentType,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error; // handleApiError에서 처리
}
```

### 3. 에러 로깅 개선

#### 변경 사항:
- 에러 타입별 상세 정보 수집
- Error 객체의 stack trace 포함
- 에러 이름, 메시지, 스택 정보 모두 로깅

```typescript
const errorDetails = {
  type: "API_ERROR",
  contentType: content.type,
  contentId: content.id,
  title: content.title,
  isRecommendedContent,
  apiPath: "...",
  errorMessage: err.message,
  errorStack: err.stack,
  errorName: err.name,
};
```

## 🔍 에러 처리 흐름

1. **API 호출**
   - `fetch(url)` 실행
   - 응답 상태 확인

2. **응답 파싱**
   - 빈 응답 체크
   - JSON 파싱 시도
   - 파싱 실패 시 에러 로깅

3. **HTTP 상태 코드 체크**
   - `!response.ok`인 경우 에러 메시지 추출
   - 상세한 에러 정보 로깅

4. **API 응답 형식 체크**
   - `responseData.success` 확인
   - 실패 시 에러 메시지 추출

5. **에러 표시**
   - 사용자에게 친화적인 에러 메시지 표시
   - 콘솔에 상세한 디버깅 정보 로깅

## 📊 개선 효과

1. **에러 메시지 명확성**: 사용자에게 더 명확한 에러 메시지 제공
2. **디버깅 용이성**: 상세한 로깅으로 문제 원인 파악 용이
3. **안정성 향상**: 빈 응답, 파싱 실패 등 다양한 에러 케이스 처리
4. **레거시 지원**: 기존 응답 형식과의 호환성 유지

## 🧪 테스트 시나리오

1. **정상 케이스**: API가 성공적으로 응답하는 경우
2. **빈 응답**: 서버가 빈 응답을 반환하는 경우
3. **파싱 실패**: 유효하지 않은 JSON 응답
4. **HTTP 에러**: 400, 401, 404, 500 등의 HTTP 에러
5. **API 에러**: `success: false`인 API 응답

## 📝 관련 파일

- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
- `app/api/master-content-details/route.ts`

## 🔗 참고

- API 응답 표준화 문서: `docs/api-response-standardization.md`
- 에러 처리 가이드: `lib/api/response.ts`

