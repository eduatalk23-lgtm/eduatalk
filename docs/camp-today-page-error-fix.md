# 캠프 투데이 페이지 에러 수정

## 수정 일자
2024년 12월

## 문제점

### 1. console.time() 중복 경고
- `perfTime` 함수가 같은 라벨로 여러 번 호출될 때 경고 발생
- 서버 컴포넌트에서 각 요청마다 새로운 컨텍스트가 생성되어 `activeTimers` Map이 공유되지 않음
- React Strict Mode에서 컴포넌트가 두 번 렌더링될 때도 문제 발생

**에러 메시지:**
```
(node:39199) Warning: Label '[camp/today] render - page' already exists for console.time()
(node:39199) Warning: Label '[camp/today] data - todayPlans' already exists for console.time()
```

### 2. supabase is not defined 에러
- `lib/data/todayPlans.ts:337`에서 `supabase` 변수가 스코프 밖에 있음
- `supabase` 변수가 `if (contentKeys.size > 0)` 블록 안에서만 정의되어, 특정 조건에서 접근 불가

**에러 메시지:**
```
Switched to client rendering because the server rendering errored:
supabase is not defined
    at getTodayPlans (lib/data/todayPlans.ts:337:29)
```

### 3. 중복 코드 및 성능 문제
- `supabase` 클라이언트가 여러 곳에서 중복 생성됨
- 캐시 조회, 진행률 조회, 캐시 저장에서 각각 `createSupabaseServerClient()` 호출

## 수정 내용

### 1. perfTime 함수 개선 (`lib/utils/perfLog.ts`)

**변경 전:**
- `activeTimers` Map을 사용하여 중복 라벨 관리
- 서버 컴포넌트 환경에서 Map이 공유되지 않아 문제 발생

**변경 후:**
- 항상 고유한 라벨 생성 (타임스탬프 + 랜덤 문자열)
- `activeTimers` Map 의존성 제거
- 서버 컴포넌트 환경에서도 안전하게 동작

```typescript
// 변경 전
const activeCount = activeTimers.get(label) || 0;
const uniqueLabel = activeCount > 0 
  ? `${label}_${activeCount + 1}`
  : label;

// 변경 후
const timestamp = Date.now();
const randomStr = Math.random().toString(36).substring(2, 9);
const uniqueLabel = `${label}_${timestamp}_${randomStr}`;
```

### 2. supabase 스코프 문제 수정 (`lib/data/todayPlans.ts`)

**변경 전:**
- `supabase` 클라이언트가 각 블록에서 개별 생성
- 스코프 문제로 인해 접근 불가능한 경우 발생

**변경 후:**
- 함수 시작 부분에서 `supabase` 클라이언트를 한 번만 생성
- 모든 블록(캐시 조회, 진행률 조회, 캐시 저장)에서 동일한 클라이언트 재사용

```typescript
// 변경 전
if (useCache) {
  const supabase = await createSupabaseServerClient();
  // ...
}

if (contentKeys.size > 0) {
  const supabase = await createSupabaseServerClient();
  // ...
}

if (useCache && result) {
  const supabase = await createSupabaseServerClient();
  // ...
}

// 변경 후
const supabase = await createSupabaseServerClient();

if (useCache) {
  // supabase 재사용
}

if (contentKeys.size > 0) {
  // supabase 재사용
}

if (useCache && result) {
  // supabase 재사용
}
```

## 수정 결과

1. ✅ console.time() 중복 경고 완전 제거
2. ✅ supabase is not defined 에러 해결
3. ✅ 성능 개선 (중복 클라이언트 생성 제거)
4. ✅ 코드 가독성 및 유지보수성 향상

## 테스트

- [x] 린터 에러 확인 (에러 없음)
- [x] 타입 체크 확인
- [x] 코드 리뷰 완료

## 관련 파일

- `lib/utils/perfLog.ts` - perfTime 함수 개선
- `lib/data/todayPlans.ts` - supabase 클라이언트 스코프 수정
- `app/(student)/camp/today/page.tsx` - 영향 없음 (perfTime 사용은 유지)

