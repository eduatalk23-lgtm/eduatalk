# Super Admin 대시보드 라우팅 충돌 해결

## 문제 상황

Next.js 빌드 시 다음과 같은 에러가 발생했습니다:

```
You cannot have two parallel pages that resolve to the same path. 
Please check /(student)/dashboard and /(superadmin).
```

## 원인 분석

### 라우팅 충돌

Next.js의 라우트 그룹 `(superadmin)`과 `(student)`는 URL에 포함되지 않습니다. 따라서:

- `app/(superadmin)/dashboard/page.tsx` → `/dashboard`로 해석됨
- `app/(student)/dashboard/page.tsx` → `/dashboard`로 해석됨

두 페이지가 동일한 경로 `/dashboard`로 해석되어 충돌이 발생했습니다.

### 기대되는 경로

`app/(superadmin)/layout.tsx`에서 `dashboardHref="/superadmin/dashboard"`로 설정되어 있었지만, 실제 파일 구조는 `/dashboard`로 해석되고 있었습니다.

## 해결 방법

### 파일 구조 변경

`app/(superadmin)/dashboard/`를 `app/(superadmin)/superadmin/dashboard/`로 이동했습니다.

**변경 전:**
```
app/
├── (superadmin)/
│   └── dashboard/
│       └── page.tsx  → /dashboard
└── (student)/
    └── dashboard/
        └── page.tsx  → /dashboard (충돌!)
```

**변경 후:**
```
app/
├── (superadmin)/
│   └── superadmin/
│       └── dashboard/
│           └── page.tsx  → /superadmin/dashboard
└── (student)/
    └── dashboard/
        └── page.tsx  → /dashboard
```

## 변경 사항

### 파일 이동

1. `app/(superadmin)/dashboard/page.tsx` 
   → `app/(superadmin)/superadmin/dashboard/page.tsx`

### 영향받는 경로

다음 경로들이 이미 `/superadmin/dashboard`를 참조하고 있어 추가 수정이 필요 없었습니다:

- `app/(superadmin)/layout.tsx` - `dashboardHref="/superadmin/dashboard"`
- `app/page.tsx` - `redirect("/superadmin/dashboard")`
- `app/login/page.tsx` - `redirect("/superadmin/dashboard")`
- `components/navigation/global/categoryConfig.ts` - `href: "/superadmin/dashboard"`
- `app/(superadmin)/unverified-users/page.tsx` - `href="/superadmin/dashboard"`
- `app/(superadmin)/admin-users/page.tsx` - `href="/superadmin/dashboard"`

## 결과

- ✅ 라우팅 충돌 해결
- ✅ `/dashboard` → 학생 대시보드
- ✅ `/superadmin/dashboard` → Super Admin 대시보드
- ✅ 기존 링크 및 리다이렉트 경로 유지

## 참고 사항

### Next.js 라우트 그룹 동작

라우트 그룹 `(name)`은 URL에 포함되지 않습니다:
- `app/(admin)/dashboard/page.tsx` → `/dashboard`
- `app/(student)/dashboard/page.tsx` → `/dashboard` (충돌 가능)

따라서 라우트 그룹 내에서도 경로를 명시적으로 구분해야 합니다:
- `app/(admin)/admin/dashboard/page.tsx` → `/admin/dashboard`
- `app/(student)/dashboard/page.tsx` → `/dashboard`

## 작업 일시

2025-02-02

