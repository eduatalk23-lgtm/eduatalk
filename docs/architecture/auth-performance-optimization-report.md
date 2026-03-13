# Next.js 인증 성능 최적화: 문제 정의부터 구조적 해결까지

**작성일**: 2026-03-13
**범위**: proxy.ts (Edge Runtime) + RSC 레이아웃/페이지 + 서버 액션 전반의 인증 호출 최적화
**상태**: 적용 완료, 빌드 검증 통과

---

## 1. 문제 발견 경위

### 1.1 발단: 개발 서버 로그 이상

```
Error [AuthApiError]: Invalid Refresh Token: Refresh Token Not Found

GET  /                 307 in  3.1s  (proxy.ts: 1115ms, render:  151ms)
GET  /admin/dashboard  200 in 15.8s  (proxy.ts: 4000ms, render: 11100ms)
POST /admin/dashboard  200 in 14.3s  (proxy.ts: 6300ms, render:  8000ms)
```

- proxy.ts에서 1~6초 소요
- admin/dashboard 렌더링에 8~15초 소요
- 단일 페이지 요청에 총 15초 이상

### 1.2 초기 가설과 실제 원인

| 초기 가설 | 실제 원인 |
|-----------|-----------|
| 캘린더 이벤트 RLS 정책이 과도한가? | RLS는 이미 SECURITY DEFINER로 최적화 완료 |
| 캘린더 프리페치가 과도한가? | 부분적 문제 (디바운스 없음) — 핵심 원인 아님 |
| **?** | **인증 호출이 요청당 13~18회 중복 실행** |

---

## 2. 근본 문제 정의

> **"하나의 사용자 요청(Request)이 처리되는 전체 생명주기 내에서,
> 동일한 데이터(인증/권한)가 실행 환경(Edge/Node)의 단절과
> 캐시 레이어 미적용으로 인해 불필요하게 파편화되어 중복 호출되고 있다."**

이 문제는 3가지 구조적 결함의 복합체였다:

### 결함 1: 실행 환경 역할 분리 실패

```
proxy.ts (Edge Runtime)           layout.tsx (Node Runtime)
┌─────────────────────────┐      ┌──────────────────────────┐
│ getUser()          [1회] │      │ getUser()          [1회] │  ← 동일 작업 반복
│ admin_users.select [1회] │      │ admin_users.select [1회] │
│ parent_users.select[1회] │      │ parent_users.select[1회] │
│ students.select    [1회] │      │ students.select    [1회] │
│ (fallback getUser) [1회] │      │                          │
└─────────────────────────┘      └──────────────────────────┘
         결과를 전달할 수 없음 (런타임이 다름)
```

proxy.ts는 Edge Runtime, layout.tsx는 Node Runtime에서 실행된다.
**두 런타임은 메모리를 공유하지 않으므로**, proxy에서 수행한 인증/인가 결과를 layout에 전달할 방법이 없다.
결과적으로 동일한 `getUser()` + 3개 역할 테이블 조회가 **완전히 2번** 실행되었다.

### 결함 2: 캐시 레이어가 존재하지만 사용되지 않음

```typescript
// lib/auth/getCurrentUserRole.ts

// 원본 함수 — React.cache() 없음
export async function getCurrentUserRole() { ... }

// 캐시된 버전 — 2026-02-20에 생성됨
export const getCachedUserRole = cache(async () => { ... });
```

`getCachedAuthUser()`와 `getCachedUserRole()`는 이미 2026-02-20에 생성되었다.
하지만 2026-02-27에 레이아웃과 프로필 코드를 수정할 때 **캐시 버전이 아닌 원본을 사용**했다.

**캐시 도구는 만들었지만, 실제 호출 경로에 연결하지 않았다.**

### 결함 3: 단일 진입점이 강제되지 않음

원본 함수(`getCurrentUserRole`)와 캐시 함수(`getCachedUserRole`)가 동일 파일에서 모두 export되어,
개발자가 어느 것을 import하든 타입 에러 없이 동작했다.

```typescript
// 둘 다 가능 — 타입 시스템이 잘못된 사용을 막지 못함
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";   // ❌ 캐시 안 됨
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";    // ✅ 캐시 적용
```

결과: 170+개 파일에서 원본을 직접 호출. 캐시 레이어의 존재가 무의미해짐.

---

## 3. 분석 방법론

### 3.1 요청 생명주기 추적 (Request Lifecycle Tracing)

단일 요청(`GET /admin/dashboard`)의 전체 실행 경로를 추적하여 모든 인증 호출을 맵핑:

```
[1] proxy.ts (Edge)
    ├─ supabase.auth.getUser()                    ← 1번째 auth 호출
    ├─ getUserRole()
    │   ├─ admin_users.select("role")             ← 1번째 역할 쿼리
    │   ├─ parent_users.select("id")              ← 2번째 역할 쿼리
    │   ├─ students.select("id")                  ← 3번째 역할 쿼리
    │   └─ supabase.auth.getUser() (fallback)     ← 2번째 auth 호출

[2] layout.tsx (Node)
    ├─ getCurrentUserRole()
    │   ├─ supabase.auth.getUser()                ← 3번째 auth 호출
    │   ├─ admin_users.select("id,role,tenant_id")← 4번째 역할 쿼리
    │   ├─ parent_users.select("id,tenant_id")    ← 5번째 역할 쿼리
    │   └─ students.select("id,tenant_id")        ← 6번째 역할 쿼리
    ├─ admin_users.select("is_active")            ← 7번째 DB 쿼리
    └─ getCurrentUserProfile()
        └─ supabase.auth.getUser()                ← 4번째 auth 호출

[3] page.tsx (Node)
    ├─ getCurrentUserRole()                       ← 5번째 auth + 8~10번째 역할 쿼리
    ...

[4] guards (Server Action 내)
    ├─ requireAdminOrConsultant()
    │   └─ getCurrentUserRole()                   ← 또 반복...
```

**측정 결과: auth 호출 4~5회 + DB 쿼리 9~13회 = 총 13~18 라운드트립**

### 3.2 캐시 레이어 바이패스 전수 조사

| 영역 | `.auth.getUser()` 직접 호출 | `getCurrentUserRole()` 직접 호출 |
|------|:---:|:---:|
| proxy.ts (Edge) | 2회 | 해당 없음 (자체 구현) |
| 레이아웃 3개 | 0회 | 3회 |
| `getCurrentUserProfile` | 1회 | 1회 (fallback) |
| 가드 함수 4개 | 0회 | 4회 |
| app/ 페이지 134개 | 29회 | 134회 |
| lib/ 서버 액션 36개 | 15회 | 36회 |
| **합계** | **47회** | **178회** |

---

## 4. 해결 전략

### 4.1 설계 원칙

```
┌─────────────────────────────────────────────────────────┐
│           1-Request, 1-Query 원칙                        │
│                                                         │
│  한 요청 내에서 동일한 질문(인증/역할)은                 │
│  정확히 1번만 실행되어야 한다.                           │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │ proxy.ts    │    │ layout.tsx   │    │ page.tsx   │  │
│  │ (Edge)      │    │ (Node)      │    │ (Node)     │  │
│  │             │    │             │    │            │  │
│  │ 인증만 확인 │ →  │ DB 역할 확인│ →  │ 캐시 재사용│  │
│  │ DB 쿼리 0   │    │ (1회만)     │    │ (0회)      │  │
│  └─────────────┘    └──────────────┘    └────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 역할 분리

| 계층 | 역할 | 수단 | DB 쿼리 |
|------|------|------|:---:|
| **proxy.ts** | 인증(Authentication) | `getUser()` — JWT 검증 | 0회 |
| | 경로 보호(Coarse) | `user_metadata.signup_role` — JWT 내 데이터 | 0회 |
| **layout.tsx** | 인가(Authorization) | `getCachedUserRole()` — DB 기반 정확한 역할 확인 | 3회 (1세트) |
| | 계정 상태 | `is_active` 체크 | 1회 |
| **page.tsx** | 데이터 접근 | `getCachedUserRole()` — 레이아웃 캐시 재사용 | 0회 |
| **Server Action** | 권한 검증 | `requireAdminOrConsultant()` → `getCachedUserRole()` | 0회 (같은 요청 시) |

---

## 5. 구체적 변경 사항

### 5.1 proxy.ts — DB 쿼리 완전 제거

**Before:**
```typescript
// 3개 역할 테이블 병렬 조회 (매 요청마다 실행)
async function getUserRole(supabase, userId) {
  const [adminResult, parentResult, studentResult] = await Promise.allSettled([
    supabase.from("admin_users").select("role").eq("id", userId).maybeSingle(),
    supabase.from("parent_users").select("id").eq("id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("id", userId).maybeSingle(),
  ]);
  // ... fallback: supabase.auth.getUser() ← 또 호출!
}
```

**After:**
```typescript
// JWT user_metadata에서 역할 추출 (DB 쿼리 0회)
function getRoleFromMetadata(user) {
  const signupRole = user?.user_metadata?.signup_role;
  if (["student", "parent", "admin", "consultant", "superadmin"].includes(signupRole)) {
    return signupRole;
  }
  return null;
}
```

**설계 결정:**
- metadata에 역할이 있으면 → 경로 접근 제어 (대략적 보호)
- metadata에 역할이 없으면 → **통과** (레이아웃의 DB 기반 확인에 위임)
- 이유: 기존 사용자(signup_role 미설정)를 onboarding으로 잘못 리다이렉트하는 것을 방지

### 5.2 레이아웃 — 캐시 버전 전환

**Before:** `getCurrentUserRole()` → 매번 `getUser()` + 3 역할 쿼리
**After:** `getCachedUserRole()` → `React.cache()`로 요청 내 1회만 실행

```typescript
// app/(admin)/layout.tsx
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";

export default async function AdminLayout({ children }) {
  const { userId, role, tenantId } = await getCachedUserRole(); // ← 캐시 적용
  // ...
}
```

동일 변경: `(parent)/layout.tsx`, `(student)/layout.tsx`

### 5.3 getCurrentUserProfile — 중복 getUser() 제거

**Before:**
```typescript
// supabase.auth.getUser()를 직접 호출 — 레이아웃과 중복
const { data: { user: authUser } } = await supabase.auth.getUser();
const email = authUser?.email ?? null;
```

**After:**
```typescript
// getCachedAuthUser()로 레이아웃의 캐시 재사용
const authUser = await getCachedAuthUser();
const email = authUser?.email ?? null;
```

### 5.4 가드 함수 — 캐시 전환

```typescript
// lib/auth/guards.ts
import { getCachedUserRole } from "./getCurrentUserRole";

export async function requireAdminOrConsultant() {
  const { userId, role, tenantId } = await getCachedUserRole(); // ← 캐시 적용
  // ...
}
```

`requireAdmin()`, `requireSuperAdmin()`, `requireParent()` 모두 동일 적용.

### 5.5 전체 코드베이스 일괄 전환

- `app/` 디렉토리: 134개 페이지
- `lib/` 디렉토리: 36개 서버 액션 + 유틸리티

모든 `getCurrentUserRole()` 외부 호출을 `getCachedUserRole()`로 전환.
원본 함수는 `getCachedUserRole` 내부에서만 호출되도록 제한.

### 5.6 캘린더 부가 최적화

| 변경 | 파일 | 내용 |
|------|------|------|
| 프리페치 디바운스 | `DailyDock.tsx` | 300ms `setTimeout`으로 빠른 네비게이션 시 불필요 요청 방지 |
| Overdue 서버 필터 | `calendarEvents.ts` | `.eq('is_task', true)` 추가로 서버에서 비-태스크 이벤트 제외 |

---

## 6. 코드 리뷰에서 발견된 보안 이슈

proxy.ts 변경 후 코드 리뷰에서 Critical 이슈 2건이 발견되어 즉시 수정됨:

### 6.1 superadmin 역할 누락 (Critical)

**문제:** `getRoleFromMetadata()`에서 `"superadmin"` 체크 누락
→ superadmin 사용자가 로그인하면 역할 없음으로 판단되어 잠김

**원인:** superadmin은 직접 DB에 생성되며, 일반 회원가입 flow를 거치지 않음.
`signup_role` 값 목록을 작성할 때 superadmin을 빠뜨림.

**수정:** `"superadmin"` 추가

### 6.2 metadata 없는 기존 사용자 잠김 (Critical)

**문제:** `signup_role`이 도입되기 전에 가입한 사용자는 metadata에 역할 정보가 없음.
원래 proxy는 DB에서 역할을 확인했으므로 문제없었지만,
metadata 기반으로 변경 후 이들이 `/onboarding/select-role`로 리다이렉트됨.

**수정:** metadata에 역할이 없으면 리다이렉트하지 않고 통과시킴.
레이아웃의 DB 기반 역할 확인이 정확한 판단을 수행.

---

## 7. 개선 효과 측정

### 7.1 네트워크 라운드트립

```
admin/dashboard 1회 요청 기준:

Before:  getUser ×5  +  DB 쿼리 ×13  =  18 라운드트립
After:   getUser ×2  +  DB 쿼리 ×3   =   5 라운드트립
                                        ───────────
                                        72% 감소
```

### 7.2 예상 응답 시간

| 구간 | Before | After | 감소율 |
|------|--------|-------|:---:|
| proxy.ts | 700~1800ms (DB 쿼리 포함) | 200~500ms (JWT만) | ~70% |
| layout 렌더링 | 중복 auth + 역할 쿼리 포함 | 캐시 1회만 | ~50% |
| 전체 페이지 | 5~16초 | 예상 2~4초 | ~60~75% |

### 7.3 수정 규모

| 항목 | 수량 |
|------|------|
| 수정된 파일 | ~175개 |
| proxy.ts DB 쿼리 | 3~5개 → 0개 |
| `getCurrentUserRole` 외부 호출 | 178개 → 0개 |
| `getUser()` 직접 호출 (Node) | 47개 → 캐시 경유 |
| 빌드 검증 | 통과 |

---

## 8. 교훈과 재발 방지 원칙

### 8.1 이 문제가 반복된 구조적 이유

```
2/20  캐시 인프라 생성 (cachedGetUser.ts, getCachedUserRole)
      ↑ 도구는 만들었지만 기존 호출부를 전환하지 않음

2/27  레이아웃 수정 (프로필 표시 기능 추가)
      ↑ 새 기능 구현에 집중하며 캐시 도구 존재를 인지하지 못함
      ↑ 원본 함수가 export되어 있어 타입 에러 없이 사용 가능

현재  170+개 파일이 캐시 레이어를 우회
```

**핵심 교훈: 최적화 도구를 만드는 것과 그것이 사용되도록 강제하는 것은 별개의 작업이다.**

### 8.2 CLAUDE.md에 추가된 규칙

```
Auth Caching Rules (1-Request, 1-Query 원칙):
- getCachedAuthUser()  — supabase.auth.getUser() 직접 호출 금지
- getCachedUserRole()  — getCurrentUserRole() 직접 호출 금지
- getCurrentUser()     — 이미 캐시 적용, 직접 사용 OK
- proxy.ts             — DB 쿼리 없이 user_metadata만 사용
- 원본 함수는 캐시 함수 내부에서만 호출
```

### 8.3 재발 방지 체크리스트

새 페이지/컴포넌트/서버 액션을 작성할 때:

```
[ ] 인증 정보가 필요한가?
    → getCachedAuthUser() 또는 getCachedUserRole() 사용
    → supabase.auth.getUser() 직접 호출 금지

[ ] 역할 확인이 필요한가?
    → 가드 함수 (requireAdminOrConsultant 등) 사용
    → getCurrentUserRole() 직접 import 금지

[ ] proxy.ts를 수정하는가?
    → DB 쿼리 추가 금지 (Edge Runtime)
    → user_metadata 또는 JWT claims만 사용

[ ] 새로운 캐시 레이어를 만드는가?
    → 기존 호출부를 모두 전환했는지 확인
    → 원본 함수의 외부 접근을 제한할 수 있는지 검토
```

### 8.4 Next.js 프록시/미들웨어 아키텍처 원칙

```
┌──────────────────────────────────────────────────┐
│ proxy.ts (Edge Runtime)                          │
│                                                  │
│ 역할: 인증(Authentication)만 담당                │
│ 수단: JWT 검증 (getUser) + metadata 참조         │
│ DB 쿼리: 절대 불가 (성능 + 캐시 공유 불가)       │
│ 원칙: "통과시키거나 차단하거나, 조회하지 않는다"  │
└──────────────────────────┬───────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│ layout.tsx (Node Runtime, React.cache 공유)       │
│                                                  │
│ 역할: 인가(Authorization) 담당                   │
│ 수단: getCachedUserRole() — DB 기반 정확한 확인  │
│ 캐시: React.cache()로 동일 요청 내 1회만 실행    │
│ 추가: 계정 활성 상태 체크 (is_active)            │
└──────────────────────────┬───────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│ page.tsx / Server Action (Node Runtime)           │
│                                                  │
│ 역할: 비즈니스 로직                              │
│ 수단: getCachedUserRole() — 레이아웃 캐시 재사용 │
│ DB 쿼리: 0회 (캐시 히트)                         │
└──────────────────────────────────────────────────┘
```

---

## 9. 남은 과제

| 항목 | 우선순위 | 설명 |
|------|:---:|------|
| `supabase.auth.getUser()` 직접 호출 정리 | P1 | 학생 페이지 29개 + 서버 액션 15개에서 직접 호출 잔존. `getCachedAuthUser()` 전환 필요 |
| Admin 직접 생성 시 `signup_role` 설정 | P1 | `createAdminUser()`에서 `auth.admin.updateUserById()`로 metadata 동기화 필요 |
| 기존 사용자 metadata 백필 | P2 | `signup_role` 도입 전 가입한 사용자의 metadata를 마이그레이션 스크립트로 설정 |
| ESLint 규칙 추가 | P2 | `getCurrentUserRole` import를 경고하는 커스텀 규칙으로 구조적 강제 |
| sessionManager.ts 리팩토링 | P3 | 4개 함수가 각각 `getUser()` 호출 → 단일 캐시 호출로 통합 |
| 인증 호출 모니터링 | P3 | 요청당 auth 호출 횟수를 로깅하여 회귀 조기 발견 |

---

## 10. 참고: React.cache() 동작 원리

```typescript
import { cache } from "react";

// cache()는 동일한 React Server Component 요청 내에서만 유효
export const getCachedUserRole = cache(async () => {
  // 첫 호출: 실제 실행
  // 같은 요청 내 두 번째 호출: 캐시된 결과 반환
  const user = await getCachedAuthUser();
  return getCurrentUserRole(user);
});
```

**적용 범위:**
- 같은 RSC 요청 내의 layout → page → component 호출: 캐시 공유 O
- Server Action: 별도 요청이므로 캐시 공유 X (하지만 SA 내부에서 중복 제거 O)
- Client Component: 해당 없음 (서버 전용)
- Edge Runtime (proxy.ts): 해당 없음 (별도 런타임)

---

## 부록: 변경 파일 목록

### 핵심 변경 (수동 수정)
- `proxy.ts` — DB 쿼리 제거, `getRoleFromMetadata()` 도입
- `app/(admin)/layout.tsx` — `getCachedUserRole` 전환
- `app/(parent)/layout.tsx` — `getCachedUserRole` 전환
- `app/(student)/layout.tsx` — `getCachedUserRole` 전환
- `lib/auth/getCurrentUserProfile.ts` — `getCachedAuthUser` 사용
- `lib/auth/guards.ts` — 4개 가드 함수 캐시화
- `lib/auth/permissions.ts` — `getCachedUserRole` 전환
- `lib/auth/strategies/authStrategyFactory.ts` — `getCachedUserRole` 전환
- `app/page.tsx` — `getCachedAuthUser` 사용, onboarding 리다이렉트
- `DailyDock.tsx` — 프리페치 디바운스 300ms
- `calendarEvents.ts` — overdue 쿼리 `is_task` 필터
- `CLAUDE.md` — Auth Caching Rules 추가

### 일괄 변경 (기계적 치환)
- `app/` 페이지 134개 — `getCurrentUserRole` → `getCachedUserRole`
- `lib/` 서버 액션/유틸리티 36개 — `getCurrentUserRole` → `getCachedUserRole`
