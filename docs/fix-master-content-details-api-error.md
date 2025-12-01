# master-content-details API 에러 수정

## 문제 상황

`RangeSettingModal` 컴포넌트에서 `/api/master-content-details` API 호출 시 에러가 발생했습니다.

### 에러 메시지
```
[RangeSettingModal] API 호출 실패: /api/master-content-details {}
```

## 원인 분석

1. **API 라우트의 구조 분해 할당 개선 필요**
   - `getMasterBookById`와 `getMasterLectureById`의 반환값을 명시적으로 처리하도록 수정

2. **에러 응답 처리 개선 필요**
   - 빈 응답이나 파싱 실패 시 더 명확한 에러 메시지 제공
   - 서버 에러(5xx)와 클라이언트 에러(4xx) 구분

## 수정 내용

### 1. API 라우트 개선 (`app/api/master-content-details/route.ts`)

- 구조 분해 할당을 명시적으로 분리하여 에러 추적 용이성 향상
- 에러 로깅에 stack trace 추가

```typescript
// 수정 전
const { details } = await getMasterBookById(contentId);

// 수정 후
const result = await getMasterBookById(contentId);
const { details } = result;
```

### 2. RangeSettingModal 에러 처리 개선

- 빈 응답 처리 개선
- JSON 파싱 실패 시 더 명확한 에러 메시지
- HTTP 상태 코드에 따른 에러 메시지 구분
- `responseData` 초기값을 `null`로 변경하여 빈 객체와 구분

```typescript
// 수정 전
let responseData: any = {};

// 수정 후
let responseData: any = null;
```

## 테스트 방법

1. RangeSettingModal을 열어 범위 설정 시도
2. 콘솔에서 에러 로그 확인
3. 네트워크 탭에서 API 응답 확인

## 예상 결과

- API 호출 실패 시 더 명확한 에러 메시지 표시
- 서버 에러와 클라이언트 에러 구분
- 디버깅을 위한 상세한 로그 제공

## 관련 파일

- `app/api/master-content-details/route.ts`
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

