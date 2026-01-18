# 클라이언트-서버 Import 에러 수정

## 작업 일시
2024-12-15

## 문제 상황

Next.js 빌드 시 다음과 같은 에러가 발생했습니다:

```
Ecmascript file had an error
./lib/supabase/server.ts:3:1
import { cookies } from "next/headers";
You're importing a component that needs "next/headers". That only works in a Server Component which is not supported in the pages/ directory.
```

**원인:**
- 클라이언트 컴포넌트 `CampParticipantsList.tsx`에서 `loadCampParticipants` 함수를 호출
- `loadCampParticipants`가 `includeStats: true` 옵션을 사용할 때 서버 전용 함수들을 동적 import
- Turbopack이 정적 분석을 통해 동적 import 내부의 모듈도 클라이언트 번들에 포함시킴
- 결과적으로 `lib/supabase/server.ts`가 클라이언트 번들에 포함되어 에러 발생

## 해결 방법

### 1. 클라이언트에서 서버 전용 import 제거

`lib/data/campParticipants.ts`에서:
- 사용하지 않는 `createSupabaseServerClient` import 제거
- `includeStats` 옵션의 통계 정보 로드 로직 제거 (서버 전용 함수 호출 제거)

### 2. 동적 import 제거

`lib/data/campParticipantStats.ts`에서:
- `campTemplates.ts`, `campAttendance.ts`, `campLearningStats.ts`를 정적 import에서 동적 import로 변경 시도했으나, Turbopack이 여전히 추적함
- 최종적으로 통계 정보 로드는 클라이언트에서 제거

### 3. 클라이언트 컴포넌트 수정

`CampParticipantsList.tsx`에서:
- `includeStats: true` 옵션 제거
- 통계 정보는 현재 표시하지 않음 (향후 API 엔드포인트나 서버 액션으로 분리 필요)

## 수정된 파일

1. `lib/data/campParticipants.ts`
   - 서버 클라이언트 import 제거
   - 통계 정보 로드 로직 제거

2. `lib/data/campParticipantStats.ts`
   - 서버 클라이언트 import 제거 (사용하지 않았음)
   - 주석 추가 (서버 전용 함수임을 명시)

3. `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx`
   - `includeStats: true` 옵션 제거

4. `app/(admin)/actions/campTemplateActions.ts`
   - 타입 에러 수정 (`role`, `tenantId` 변수)
   - 알림 타입 수정 (`camp_plan_created` → `plan_created`)

## 향후 개선 사항

1. **통계 정보 로드 분리**
   - API 엔드포인트 생성 (`/api/camp-templates/[id]/participants/stats`)
   - 또는 서버 액션으로 분리
   - 클라이언트에서 별도로 호출

2. **데이터 페칭 패턴 개선**
   - 서버 컴포넌트에서 데이터 페칭
   - 클라이언트 컴포넌트는 표시만 담당
   - React Query를 사용한 클라이언트 사이드 캐싱

## 참고사항

- Next.js 16 (Turbopack)은 정적 분석을 통해 동적 import 내부의 모듈도 추적함
- 클라이언트 컴포넌트에서 서버 전용 함수를 호출하지 않도록 주의 필요
- `next/headers`는 서버 컴포넌트, Server Actions, Route Handlers에서만 사용 가능

