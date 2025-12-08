# 관리자 학생 관리 페이지 브레드크럼 중복 수정

## 작업 일시
2025-01-07

## 문제 상황
관리자 페이지의 학생 관리 페이지(`/admin/students/[id]`)에서 브레드크럼이 중복으로 표시되는 문제가 발생했습니다.

## 원인 분석

1. **`RoleBasedLayout` 컴포넌트** (`components/layout/RoleBasedLayout.tsx`)
   - 레이아웃 레벨에서 `Breadcrumbs` 컴포넌트를 렌더링하고 있었습니다 (107-112줄).

2. **학생 상세 페이지** (`app/(admin)/admin/students/[id]/page.tsx`)
   - 페이지 레벨에서도 `Breadcrumbs` 컴포넌트를 추가로 렌더링하고 있었습니다.

결과적으로 브레드크럼이 두 번 렌더링되어 중복으로 표시되었습니다.

## 해결 방법

### 1. 중복 브레드크럼 제거
- 학생 상세 페이지에서 직접 렌더링하던 `Breadcrumbs` 컴포넌트를 제거했습니다.
- `RoleBasedLayout`에서 제공하는 브레드크럼만 사용하도록 변경했습니다.

### 2. 동적 라벨 전달 시스템 구현

학생 이름을 브레드크럼에 표시하기 위해 Context API를 사용한 동적 라벨 전달 시스템을 구현했습니다.

#### 2.1 BreadcrumbContext 생성
- `lib/components/BreadcrumbContext.tsx` 파일 생성
- `BreadcrumbProvider`: 동적 라벨을 제공하는 Provider
- `useBreadcrumbLabels`: Context에서 동적 라벨을 가져오는 훅

#### 2.2 Breadcrumbs 컴포넌트 수정
- `components/navigation/global/Breadcrumbs.tsx` 수정
- Context에서 동적 라벨을 읽어오도록 변경
- Props로 전달된 라벨이 우선순위를 가지며, 없으면 Context에서 가져옴

#### 2.3 StudentDetailWrapper 컴포넌트 생성
- `app/(admin)/admin/students/[id]/_components/StudentDetailWrapper.tsx` 생성
- 서버 컴포넌트에서 클라이언트 Context를 사용하기 위한 래퍼 컴포넌트
- 학생 정보를 받아 `BreadcrumbProvider`로 감싸는 역할

## 수정된 파일

1. `app/(admin)/admin/students/[id]/page.tsx`
   - 중복된 `Breadcrumbs` 컴포넌트 제거
   - `StudentDetailWrapper`로 페이지 콘텐츠를 감싸도록 변경

2. `components/navigation/global/Breadcrumbs.tsx`
   - Context에서 동적 라벨을 읽어오도록 수정

3. `lib/components/BreadcrumbContext.tsx` (신규)
   - 동적 라벨을 제공하는 Context API 구현

4. `app/(admin)/admin/students/[id]/_components/StudentDetailWrapper.tsx` (신규)
   - 클라이언트 컴포넌트 래퍼
   - `BreadcrumbProvider`로 페이지 콘텐츠를 감싸는 역할

## 결과

- 브레드크럼이 한 번만 표시됩니다.
- 학생 이름이 브레드크럼에 동적으로 표시됩니다 (예: "홍길동 학생").
- 다른 페이지에서도 동일한 패턴으로 동적 라벨을 사용할 수 있습니다.

## 향후 개선 사항

다른 동적 페이지(교재 상세, 강의 상세 등)에서도 동일한 패턴을 적용하여 일관된 UX를 제공할 수 있습니다.

