# Phase 5: 데이터 페칭 및 API 최적화 초기 진단

**작성일**: 2024-12-20  
**작업 범위**: 데이터 페칭 레이어 분석 및 최적화 계획 수립  
**상태**: 🔍 분석 완료

---

## 📋 분석 개요

Phase 5는 데이터 페칭 및 API 레이어의 성능과 구조를 개선하기 위한 종합적인 분석입니다.

**분석 대상**:
- `lib/api/` (5개 파일): API 클라이언트 함수들
- `lib/data/` (50+ 파일): 서버 측 데이터 조회 함수들
- `app/api/` (40+ 파일): Next.js API Routes
- `lib/hooks/` (17개 파일): 커스텀 훅 (useQuery 등)

**분석 파일**: `repomix-phase5-data-fetching.xml` (845KB, 115개 파일, 208,543 토큰)

---

## 🔍 1. 중복 페칭 (Duplicate Fetching) 분석

### 1.1 발견된 패턴

#### ✅ 양호한 패턴
- **React Query 캐싱 활용**: 대부분의 훅에서 `useQuery`를 사용하여 자동 캐싱
- **캐시 상수 정의**: `lib/constants/queryCache.ts`에서 데이터 유형별 캐시 전략 정의

#### ⚠️ 개선 필요 패턴

**1. 사용자 정보 중복 조회**
```typescript
// 여러 컴포넌트에서 개별적으로 호출
const user = await getCurrentUser();
const { role } = await getCurrentUserRole();
const tenantContext = await getTenantContext();
```
- **문제점**: 거의 모든 API Route와 Server Action에서 반복 호출
- **영향**: 불필요한 데이터베이스 쿼리 증가
- **해결 방안**: Context API 또는 React Query로 중앙화

**2. 테넌트 컨텍스트 중복 조회**
- `getTenantContext()`가 여러 함수에서 개별 호출
- 캐싱되지 않아 매번 쿼리 실행

**3. 콘텐츠 메타데이터 중복 조회**
- `getStudentBookDetails`, `getStudentLectureEpisodes` 등이 여러 곳에서 호출
- 동일한 콘텐츠에 대해 중복 조회 가능

### 1.2 중복 페칭 우선순위

| 우선순위 | 패턴 | 빈도 | 영향도 |
|---------|------|------|--------|
| 🔴 높음 | 사용자 정보 조회 | 매우 높음 | 높음 |
| 🟡 중간 | 테넌트 컨텍스트 조회 | 높음 | 중간 |
| 🟢 낮음 | 콘텐츠 메타데이터 조회 | 중간 | 낮음 |

---

## 📐 2. API 표준화 (Standardization) 분석

### 2.1 현재 상태

#### API Route (`app/api/`) 사용 사례
- **외부 시스템 연동**: SMS 발송 (`/api/purio/send`), 크론 작업 (`/api/cron/*`)
- **클라이언트 컴포넌트에서 호출**: `fetch()`를 사용하는 경우
- **실시간 데이터**: WebSocket, Server-Sent Events
- **공개 API**: 인증 없이 접근 가능한 엔드포인트

**예시**:
```typescript
// app/api/student-content-details/route.ts
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  // ... 로직
  return apiSuccess(data);
}
```

#### Server Action (`app/actions/`) 사용 사례
- **폼 제출**: 사용자 입력 처리
- **서버 컴포넌트에서 직접 호출**: `await actionFunction()`
- **트랜잭션 처리**: 복잡한 비즈니스 로직

**예시**:
```typescript
// app/actions/campTemplateActions.ts
export const createCampTemplateAction = withErrorHandling(async (formData: FormData) => {
  await requireAdminOrConsultant();
  // ... 로직
});
```

### 2.2 혼용 패턴 발견

#### ⚠️ 문제점

**1. 동일 기능의 중복 구현**
- 콘텐츠 상세 정보 조회:
  - API Route: `/api/student-content-details`
  - API Route: `/api/master-content-details`
  - Server Action: `lib/data/contentMasters.ts`의 함수들
- **문제**: 클라이언트에서 `fetch()`로 호출하는 경우와 서버에서 직접 호출하는 경우가 혼재

**2. 에러 처리 불일치**
- API Route: `handleApiError()` 사용 (일부)
- API Route: `console.error()` + 직접 에러 반환 (일부)
- Server Action: `withErrorHandling()` + `AppError` 사용

**3. 응답 형식 불일치**
- API Route: `{ success: true, data: ... }` 또는 `{ success: false, error: ... }`
- Server Action: `{ success: true, ... }` 또는 `throw AppError`

### 2.3 표준화 필요 영역

| 영역 | 현재 상태 | 권장 방향 |
|------|----------|----------|
| 에러 처리 | 혼재 | `handleApiError()` 통일 |
| 응답 형식 | 혼재 | `apiSuccess()` / `apiError()` 통일 |
| 인증/권한 | 혼재 | `requireAdminOrConsultant()` 등 통일 |
| 로깅 | `console.error` 혼재 | `logError()` 통일 |

---

## 💾 3. 캐싱 전략 (Caching) 분석

### 3.1 React Query 캐싱

#### ✅ 잘 구성된 부분

**캐시 상수 정의** (`lib/constants/queryCache.ts`):
```typescript
// Static Data: 마스터 콘텐츠, 메타데이터 (5분)
export const CACHE_STALE_TIME_STATIC = 1000 * 60 * 5;

// Stable Data: 블록 세트, 플랜 그룹 메타데이터 (5분)
export const CACHE_STALE_TIME_STABLE = 1000 * 60 * 5;

// Dynamic Data: 플랜 목록, 스케줄 결과 (1분)
export const CACHE_STALE_TIME_DYNAMIC = 1000 * 60;

// Realtime Data: 활성 플랜, 세션 (10초)
export const CACHE_STALE_TIME_REALTIME = 1000 * 10;
```

**기본 설정** (`lib/providers/QueryProvider.tsx`):
```typescript
defaultOptions: {
  queries: {
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
}
```

#### ⚠️ 개선 필요 부분

**1. 캐시 전략 미적용 훅**
- 일부 훅에서 `staleTime` 미설정 (기본값 0 사용)
- 데이터 유형에 맞는 캐시 전략 미적용

**2. 캐시 무효화 전략 부재**
- `queryClient.invalidateQueries()` 사용 패턴 불일치
- 뮤테이션 후 관련 쿼리 무효화 누락 가능성

**3. 중복 쿼리 키 패턴**
- 동일한 데이터를 다른 쿼리 키로 조회하는 경우 존재

### 3.2 Next.js 캐싱

#### ✅ 사용 중인 패턴

**1. Route Segment Config**
```typescript
// app/api/student-content-details/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5분
```

**2. 데이터베이스 레벨 캐싱**
```typescript
// lib/data/todayPlans.ts
// today_plans_cache 테이블 사용
const { data: cacheRow } = await supabase
  .from("today_plans_cache")
  .select("*")
  .eq("student_id", studentId)
  .gt("expires_at", new Date().toISOString());
```

#### ⚠️ 개선 필요 부분

**1. `unstable_cache` 미사용**
- Next.js의 `unstable_cache`를 사용한 서버 사이드 캐싱 미활용
- 대부분의 `lib/data/` 함수에서 캐싱 없음

**2. 캐시 전략 불일치**
- API Route: `revalidate` 설정 (일부)
- Server Action: 캐싱 없음
- `lib/data/` 함수: 캐싱 없음 (일부 제외)

---

## 🛡 4. 에러 핸들링 (Error Handling) 분석

### 4.1 현재 상태

#### ✅ 표준화된 패턴

**Server Action** (`app/actions/`):
```typescript
export const actionFunction = withErrorHandling(async (...args) => {
  await requireAdminOrConsultant();
  // ... 로직
  throw new AppError("메시지", ErrorCode.XXX, 500, true);
});
```

**일부 API Route**:
```typescript
// app/api/subject-hierarchy/route.ts
export async function GET(request: NextRequest) {
  try {
    // ... 로직
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "[api/subject-hierarchy]");
  }
}
```

#### ⚠️ 비표준 패턴

**1. 직접 에러 처리** (일부 API Route):
```typescript
// app/api/subjects/route.ts
try {
  // ... 로직
} catch (error) {
  console.error("[api/subjects] 조회 실패:", error);
  return NextResponse.json({
    success: false,
    error: error instanceof Error ? error.message : "과목 목록 조회에 실패했습니다.",
  }, { status: 500 });
}
```

**2. 에러 로깅 누락**
- 일부 API Route에서 `console.error`만 사용
- `logError()` 미사용

**3. 에러 응답 형식 불일치**
- `{ success: false, error: string }`
- `{ success: false, error: { code, message } }`
- `{ error: "Forbidden", details: ... }`

### 4.2 표준화 필요 영역

| 영역 | 현재 상태 | 권장 방향 |
|------|----------|----------|
| 에러 로깅 | `console.error` 혼재 | `logError()` 통일 |
| 에러 응답 | 형식 불일치 | `handleApiError()` 통일 |
| 에러 타입 | `Error` 직접 사용 | `AppError` 사용 |
| 에러 코드 | 하드코딩 | `ErrorCode` enum 사용 |

---

## 📊 분석 통계

### 파일 분포
- **lib/api/**: 5개 파일
- **lib/data/**: 50+ 파일
- **app/api/**: 40+ 파일
- **lib/hooks/**: 17개 파일

### 코드 복잡도
- **가장 큰 파일**: `planGroups.ts` (19,431 토큰)
- **두 번째**: `contentMasters.ts` (18,499 토큰)
- **세 번째**: `campTemplates.ts` (8,333 토큰)

### React Query 사용
- **useQuery**: 6개 훅에서 사용
- **useMutation**: 1개 훅에서 사용
- **캐시 전략 적용**: 4개 훅에서 명시적 설정

---

## 🎯 Phase 5 최적화 계획

### 우선순위 1: 중복 페칭 제거 (High Priority)

**목표**: 사용자 정보 및 테넌트 컨텍스트 중복 조회 제거

**작업**:
1. 사용자 정보 Context API 또는 React Query로 중앙화
2. 테넌트 컨텍스트 캐싱 전략 수립
3. 공통 데이터 페칭 훅 생성

**예상 효과**: 데이터베이스 쿼리 30-50% 감소

### 우선순위 2: API 표준화 (Medium Priority)

**목표**: API Route와 Server Action 사용 기준 명확화

**작업**:
1. API Route vs Server Action 사용 가이드라인 작성
2. 에러 처리 통일 (`handleApiError()` 사용)
3. 응답 형식 통일 (`apiSuccess()` / `apiError()` 사용)
4. 로깅 통일 (`logError()` 사용)

**예상 효과**: 코드 일관성 향상, 유지보수성 개선

### 우선순위 3: 캐싱 전략 강화 (Medium Priority)

**목표**: React Query 및 Next.js 캐싱 최적화

**작업**:
1. 모든 훅에 적절한 `staleTime` 설정
2. `unstable_cache`를 사용한 서버 사이드 캐싱 도입
3. 캐시 무효화 전략 수립
4. 중복 쿼리 키 정리

**예상 효과**: 네트워크 요청 20-30% 감소, 응답 시간 개선

### 우선순위 4: 에러 핸들링 표준화 (Low Priority)

**목표**: 모든 API Route에서 일관된 에러 처리

**작업**:
1. 모든 API Route에 `handleApiError()` 적용
2. `logError()` 사용 통일
3. 에러 응답 형식 통일

**예상 효과**: 디버깅 효율성 향상, 사용자 경험 개선

---

## 📝 다음 단계

### 1단계: 중복 페칭 제거 (1-2주)
- [ ] 사용자 정보 Context API 구현
- [ ] 테넌트 컨텍스트 캐싱 전략 수립
- [ ] 공통 데이터 페칭 훅 생성

### 2단계: API 표준화 (1-2주)
- [ ] API Route vs Server Action 가이드라인 작성
- [ ] 에러 처리 통일
- [ ] 응답 형식 통일

### 3단계: 캐싱 전략 강화 (2-3주)
- [ ] React Query 캐시 전략 적용
- [ ] Next.js `unstable_cache` 도입
- [ ] 캐시 무효화 전략 수립

### 4단계: 에러 핸들링 표준화 (1주)
- [ ] 모든 API Route 표준화
- [ ] 에러 로깅 통일
- [ ] 문서화

---

## 📚 참고 자료

- [React Query 공식 문서](https://tanstack.com/query/latest)
- [Next.js Caching 문서](https://nextjs.org/docs/app/building-your-application/caching)
- [Phase 4 관리자 모듈 리팩토링](./architecture/phase4-admin-module-summary.md)

---

**작성자**: AI Assistant  
**검토자**: (대기 중)  
**승인자**: (대기 중)

