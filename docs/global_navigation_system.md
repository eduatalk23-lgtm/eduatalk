# TimeLevelUp 전역 네비게이션 시스템 구축 문서

## 📋 개요

학생/관리자/학부모 IA와 통합 Depth 분석 결과를 기반으로 전역 네비게이션 시스템을 재구축했습니다.
역할별 카테고리 네비게이션과 자동 Breadcrumbs 생성 기능을 제공합니다.

---

## 🏗 컴포넌트 구조

```
components/navigation/
├── global/
│   ├── CategoryNav.tsx          # 전역 카테고리 네비게이션 컴포넌트
│   ├── Breadcrumbs.tsx          # 전역 Breadcrumbs 컴포넌트
│   ├── categoryConfig.ts        # 역할별 카테고리 설정
│   └── resolveActiveCategory.ts # 활성 카테고리 및 Breadcrumbs 해결
├── student/                     # (기존, 유지)
└── admin/                       # (향후 필요 시)
└── parent/                      # (향후 필요 시)
```

---

## 📁 파일 구조

### 1. categoryConfig.ts

**위치**: `components/navigation/global/categoryConfig.ts`

**역할**: 역할별(학생/관리자/학부모) 카테고리 설정 정의

**주요 특징**:
- Depth 1/2 구조 반영
- children을 통한 계층 구조
- 역할 기반 접근 제어
- 아이콘 및 라벨 설정

**구조**:
```typescript
export type NavigationCategory = {
  id: string;
  label: string;
  icon?: string;
  items: NavigationItem[];
  roles?: NavigationRole[];
};

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
  children?: NavigationItem[];  // Depth 2 아이템
  roles?: NavigationRole[];
  exactMatch?: boolean;
};
```

### 2. CategoryNav.tsx

**위치**: `components/navigation/global/CategoryNav.tsx`

**역할**: 사이드바 카테고리 네비게이션 컴포넌트

**주요 특징**:
- 접을 수 있는 카테고리 구조
- 현재 활성 경로 자동 하이라이트
- 동적 라우트 매칭 지원
- 모바일 반응형

### 3. Breadcrumbs.tsx

**위치**: `components/navigation/global/Breadcrumbs.tsx`

**역할**: 페이지 상단 Breadcrumbs 컴포넌트

**주요 특징**:
- Depth 구조 기반 자동 생성
- 동적 라우트 지원 (예: `/contents/books/[id]`)
- 동적 라벨 지원 (예: 책 제목 표시)
- 역할별 홈 경로 자동 설정

**사용 예시**:
```tsx
// 기본 사용
<Breadcrumbs role="student" />

// 동적 라벨 전달 (상세 페이지에서)
<Breadcrumbs 
  role="student" 
  dynamicLabels={{ 
    [`/contents/books/${bookId}`]: bookTitle 
  }} 
/>
```

### 4. resolveActiveCategory.ts

**위치**: `components/navigation/global/resolveActiveCategory.ts`

**역할**: 활성 카테고리 및 Breadcrumbs 체인 생성

**주요 함수**:
- `resolveActiveCategory()`: 현재 경로의 활성 카테고리 확인
- `getBreadcrumbChain()`: Breadcrumbs 경로 체인 생성
- `isCategoryPath()`: 경로가 카테고리에 속하는지 확인
- `matchesDynamicRoute()`: 동적 라우트 패턴 매칭

---

## 🔗 Layout 통합

### 학생 레이아웃

**파일**: `app/(student)/layout.tsx`

**변경사항**:
- 기존 `StudentShell` 제거
- `CategoryNav` 및 `Breadcrumbs` 직접 통합
- 사이드바 구조로 변경 (데스크톱)
- 모바일 상단 네비게이션 추가

### 관리자 레이아웃

**파일**: `app/(admin)/layout.tsx`

**변경사항**:
- 기존 `AdminSidebar` 제거
- `CategoryNav` 및 `Breadcrumbs` 통합
- 역할 기반 네비게이션 적용

### 학부모 레이아웃

**파일**: `app/(parent)/layout.tsx`

**변경사항**:
- 기존 `ParentSidebar` 제거
- `CategoryNav` 및 `Breadcrumbs` 통합
- 자녀 선택 기능은 페이지 내부에서 유지

---

## 📝 사용 예시

### 학생용 콘텐츠 상세 페이지

**파일**: `app/contents/books/[id]/page.tsx`

```tsx
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";

export default async function BookDetailPage({ params }) {
  const { id } = await params;
  const book = await fetchBook(id);

  // 동적 라벨 설정 (Breadcrumbs에서 사용)
  const dynamicLabels = {
    [`/contents/books/${id}`]: book.title || "책 상세",
  };

  return (
    <>
      {/* Breadcrumbs (동적 라벨 적용) */}
      <Breadcrumbs role="student" dynamicLabels={dynamicLabels} />
      
      {/* 페이지 콘텐츠 */}
      <section>
        {/* ... */}
      </section>
    </>
  );
}
```

**결과 Breadcrumbs**:
```
홈 > 콘텐츠 > 교재 > [책 제목]
```

---

## 🎯 Breadcrumbs 동작 예시

### 예시 1: 콘텐츠 목록
```
경로: /contents
Breadcrumbs: 홈 > 콘텐츠
```

### 예시 2: 교재 등록
```
경로: /contents/books/new
Breadcrumbs: 홈 > 콘텐츠 > 교재 > 책 등록
```

### 예시 3: 교재 상세 (동적 라벨)
```
경로: /contents/books/[id]
Breadcrumbs: 홈 > 콘텐츠 > 교재 > [책 제목]
```

### 예시 4: 플랜 상세
```
경로: /plan/[id]
Breadcrumbs: 홈 > 학습 계획 > 플랜 상세
```

### 예시 5: 관리자 학생 상세
```
경로: /admin/students/[id]
Breadcrumbs: 관리자 홈 > 학생 관리 > 학생 상세
```

### 예시 6: 학부모 주간 리포트
```
경로: /parent/report/weekly?studentId=[id]
Breadcrumbs: 학부모 홈 > 리포트 > 주간 리포트
```

---

## 🔧 주요 기능

### 1. 동적 라우트 매칭

**지원 패턴**:
- `/contents/books/[id]` → `/contents/books/abc123`
- `/plan/[id]` → `/plan/xyz789`
- `/admin/students/[id]` → `/admin/students/student-123`

**매칭 규칙**:
- 경로 길이 확인
- 앞부분 세그먼트 일치 확인
- 마지막 세그먼트가 ID 형태(UUID 또는 긴 문자열)인지 확인

### 2. 역할 기반 접근 제어

**설정 예시**:
```typescript
{
  id: "admin-tenant-settings",
  label: "기관 설정",
  href: "/admin/tenant/settings",
  roles: ["admin"], // admin만 접근
}
```

### 3. 동적 라벨 지원

**사용 방법**:
```tsx
<Breadcrumbs 
  role="student"
  dynamicLabels={{
    "/contents/books/123": "수학의 정석",
    "/plan/456": "2024년 겨울 방학 플랜",
  }}
/>
```

### 4. 카테고리 계층 구조

**구조 예시**:
```
콘텐츠 (Depth 1)
  ├─ 콘텐츠 목록 (Depth 2)
  ├─ 교재 (Depth 2)
  │   └─ 책 등록 (Depth 3)
  ├─ 강의 (Depth 2)
  │   └─ 강의 등록 (Depth 3)
  └─ 커스텀 (Depth 2)
      └─ 커스텀 등록 (Depth 3)
```

---

## 🔄 마이그레이션 가이드

### 기존 네비게이션 제거

**제거 대상**:
- `app/(student)/_components/PageHeader.tsx` (선택적, 필요시 유지)
- `app/(student)/_components/Breadcrumb.tsx` (교체됨)
- `app/(admin)/_components/AdminSidebar.tsx` (교체됨)
- `app/(admin)/_components/CategorySidebar.tsx` (교체됨)
- `app/(parent)/_components/ParentSidebar.tsx` (교체됨)
- `app/(parent)/_components/CategorySidebar.tsx` (교체됨)
- `components/layout/StudentShell.tsx` (교체됨)

### 새 네비게이션 사용

**레이아웃에서**:
```tsx
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";

export default function Layout({ children }) {
  return (
    <div className="flex">
      <aside>
        <CategoryNav role="student" />
      </aside>
      <main>
        <Breadcrumbs role="student" />
        {children}
      </main>
    </div>
  );
}
```

**페이지에서 (동적 라벨 전달)**:
```tsx
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";

export default function DetailPage({ params }) {
  const item = await fetchItem(params.id);
  
  return (
    <>
      <Breadcrumbs 
        role="student"
        dynamicLabels={{
          [`/path/to/${params.id}`]: item.title,
        }}
      />
      {/* 페이지 콘텐츠 */}
    </>
  );
}
```

---

## ✅ 완료된 작업

- [x] categoryConfig.ts 생성
- [x] CategoryNav.tsx 생성
- [x] Breadcrumbs.tsx 생성
- [x] resolveActiveCategory.ts 생성
- [x] student layout.tsx 수정
- [x] admin layout.tsx 수정
- [x] parent layout.tsx 수정
- [x] 학생용 콘텐츠 상세 페이지 적용 예시

---

## 📝 향후 개선 사항

1. **리포트 경로 통일**
   - 현재: `/report/weekly`, `/parent/report/weekly`
   - 개선: `/reports/weekly`, `/parent/reports/weekly`로 통일

2. **동적 라벨 자동 조회**
   - 현재: 페이지에서 직접 전달
   - 개선: Breadcrumbs 컴포넌트에서 자동 조회 (서버 컴포넌트 활용)

3. **접근성 개선**
   - ARIA 속성 추가
   - 키보드 네비게이션 지원

4. **모바일 최적화**
   - 햄버거 메뉴 개선
   - 터치 제스처 지원

---

**작성일**: 2025-01-13  
**버전**: 1.0  
**담당자**: TimeLevelUp 개발팀

