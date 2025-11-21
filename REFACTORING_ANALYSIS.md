# 프로젝트 리팩토링 분석 제안서

## 📋 개요

이 문서는 TimeLevelUp 프로젝트의 현재 구조를 분석하고, 개발 가이드라인 준수 및 코드 품질 개선을 위한 리팩토링 제안을 제시합니다.

**분석 일자**: 2025-01-27  
**분석 범위**: 전체 프로젝트 구조, 컴포넌트, Actions, 타입 정의

---

## 🔍 현재 상태 분석

### 1. 프로젝트 구조

```
app/
├── (admin)/          # 관리자 라우트 그룹
├── (main)/           # 메인 라우트 그룹
├── (parent)/         # 학부모 라우트 그룹
├── (student)/        # 학생 라우트 그룹 (가장 큰 규모)
├── (superadmin)/     # 슈퍼 관리자 라우트 그룹
├── actions/          # 공통 서버 액션 (일부는 re-export만)
└── api/              # API 라우트

components/
├── ui/               # 공통 UI 컴포넌트
├── navigation/       # 네비게이션 컴포넌트
└── layout/          # 레이아웃 컴포넌트

lib/
├── auth/            # 인증 관련
├── data/            # 데이터 페칭 함수
├── metrics/         # 메트릭 계산
├── recommendations/ # 추천 엔진
└── ...              # 기타 유틸리티
```

### 2. 주요 발견 사항

#### ✅ 잘 구성된 부분

1. **라우트 그룹 구조**: 역할별로 명확히 분리됨
2. **도메인별 lib 폴더**: 기능별로 잘 분리됨 (metrics, recommendations, etc.)
3. **타입 안전성**: TypeScript strict mode 사용

#### ⚠️ 개선이 필요한 부분

1. **Actions 파일 구조 혼란**
2. **컴포넌트 중복**
3. **Layout 코드 중복**
4. **타입 정의 분산**
5. **가이드라인 미준수 사례**

---

## 🎯 리팩토링 제안

### Priority 1: 긴급 (코드 품질 및 유지보수성)

#### 1.1 Actions 파일 구조 정리

**현재 문제점**:

- `app/actions/plan.ts`와 `app/actions/contents.ts`가 단순 re-export만 수행
- 실제 구현은 `app/(student)/actions/`로 이동되었지만, 루트 actions 폴더에 남아있음
- 이로 인해 import 경로 혼란 발생 가능

**제안**:

```typescript
// ❌ 현재: app/actions/plan.ts
export {
  createStudentPlan,
  updateStudentPlan,
  deleteStudentPlan,
} from "@/app/(student)/actions/planActions";

// ✅ 제안: 완전히 제거하거나 명확한 구조로 변경
// 옵션 1: 완전 제거 (권장)
// - 모든 import를 직접 경로로 변경
// - app/(student)/actions/planActions.ts에서 직접 import

// 옵션 2: 명확한 re-export 구조 유지
// app/actions/index.ts
export * from "@/app/(student)/actions/planActions";
export * from "@/app/(student)/actions/contentActions";
// 단, 이 경우 barrel export의 단점 고려 필요
```

**작업 항목**:

- [ ] `app/actions/plan.ts` 제거 또는 명확한 구조로 변경
- [ ] `app/actions/contents.ts` 제거 또는 명확한 구조로 변경
- [ ] 모든 import 경로 검색 및 업데이트
- [ ] 다른 re-export 파일들도 동일하게 처리

---

#### 1.2 EmptyState 컴포넌트 통합

**현재 문제점**:

- `components/EmptyState.tsx` (re-export만)
- `components/ui/EmptyState.tsx` (실제 구현, named export)
- `app/(student)/blocks/_components/EmptyState.tsx` (별도 구현, default export)

**제안**:

```typescript
// ✅ 통합된 EmptyState 컴포넌트
// components/ui/EmptyState.tsx

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string; // 기본값 제공
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon = "📭",
}: EmptyStateProps) {
  // 통합된 구현
}

// ❌ 제거 대상
// - components/EmptyState.tsx (re-export만)
// - app/(student)/blocks/_components/EmptyState.tsx (중복)
```

**작업 항목**:

- [ ] `components/ui/EmptyState.tsx`를 확장하여 모든 기능 포함
- [ ] `components/EmptyState.tsx` 제거
- [ ] `app/(student)/blocks/_components/EmptyState.tsx` 제거
- [ ] 모든 사용처를 `@/components/ui/EmptyState`로 변경

---

#### 1.3 Layout 컴포넌트 중복 제거

**현재 문제점**:

- `(student)`, `(admin)`, `(parent)` 레이아웃이 거의 동일한 구조
- 사이드바, 네비게이션, Breadcrumbs 코드가 반복됨
- 유지보수 시 3곳 모두 수정 필요

**제안**:

```typescript
// ✅ 공통 Layout 컴포넌트 생성
// components/layout/RoleBasedLayout.tsx

type RoleBasedLayoutProps = {
  role: "student" | "admin" | "parent";
  children: ReactNode;
  dashboardHref: string;
  roleLabel: string;
};

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
}: RoleBasedLayoutProps) {
  // 공통 레이아웃 로직
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:block w-64 border-r border-gray-200 bg-white">
        {/* 공통 사이드바 */}
      </aside>
      <main className="flex-1 flex flex-col">{/* 공통 메인 콘텐츠 */}</main>
    </div>
  );
}

// ✅ 각 레이아웃에서 사용
// app/(student)/layout.tsx
export default async function StudentLayout({ children }) {
  const { userId, role } = await getCurrentUserRole();
  if (!userId || role !== "student") redirect("/login");

  return (
    <RoleBasedLayout role="student" dashboardHref="/dashboard" roleLabel="학생">
      {children}
    </RoleBasedLayout>
  );
}
```

**작업 항목**:

- [ ] `components/layout/RoleBasedLayout.tsx` 생성
- [ ] 공통 사이드바 로직 추출
- [ ] 각 레이아웃에서 공통 컴포넌트 사용
- [ ] 중복 코드 제거

---

### Priority 2: 중요 (코드 일관성 및 가이드라인 준수)

#### 2.1 타입 정의 통합

**현재 문제점**:

- 타입이 여러 곳에 분산됨
- `app/types/`, `lib/types/`, 각 컴포넌트 파일 내부 등

**제안**:

```
lib/types/
├── index.ts              # 공통 타입
├── student.ts            # 학생 도메인 타입
├── admin.ts             # 관리자 도메인 타입
├── parent.ts            # 학부모 도메인 타입
├── content.ts           # 콘텐츠 타입
├── plan.ts              # 계획 타입
└── score.ts             # 성적 타입
```

**작업 항목**:

- [ ] 타입 정의 위치 조사
- [ ] 도메인별로 타입 파일 통합
- [ ] 중복 타입 정의 제거
- [ ] import 경로 정리

---

#### 2.2 가이드라인 준수 검토

**확인 필요 사항**:

1. **Spacing-First 정책**

   - [ ] margin 사용 대신 gap/padding 사용 여부 확인
   - [ ] 형제 요소 간격이 gap으로 관리되는지 확인

2. **Export 규칙**

   - [ ] 단일 컴포넌트는 default export 사용
   - [ ] 여러 항목은 named export 사용
   - [ ] 불필요한 barrel export 제거

3. **네이밍 규칙**

   - [ ] Common, Base, Util 접두사 사용 금지
   - [ ] 도메인별 네이밍 패턴 준수

4. **불필요한 추상화**
   - [ ] 단순 래퍼 컴포넌트 제거
   - [ ] 의미 없는 컨테이너 컴포넌트 제거

**작업 항목**:

- [ ] 전체 컴포넌트 가이드라인 준수 여부 검토
- [ ] 위반 사례 문서화
- [ ] 우선순위별 수정 계획 수립

---

### Priority 3: 개선 (성능 및 확장성)

#### 3.1 컴포넌트 구조 최적화

**제안**:

- `_components` 폴더 패턴 일관성 확보
- 페이지별 컴포넌트는 해당 페이지 폴더 내부에 배치
- 공통 컴포넌트는 `components/` 루트에 배치

#### 3.2 데이터 페칭 로직 통합

**현재 상태**:

- `lib/data/` 폴더에 데이터 페칭 함수들이 분산
- React Query 사용 여부 확인 필요

**제안**:

- React Query 훅으로 통합 (`hooks/` 폴더)
- 서버 컴포넌트용 데이터 페칭 함수는 `lib/data/` 유지
- 클라이언트 컴포넌트용은 React Query 훅 사용

---

## 📊 우선순위별 작업 계획

### Phase 1: 긴급 (1-2주)

1. Actions 파일 구조 정리
2. EmptyState 컴포넌트 통합
3. Layout 컴포넌트 중복 제거

### Phase 2: 중요 (2-3주)

1. 타입 정의 통합
2. 가이드라인 준수 검토 및 수정
3. 네이밍 규칙 통일

### Phase 3: 개선 (3-4주)

1. 컴포넌트 구조 최적화
2. 데이터 페칭 로직 통합
3. 성능 최적화

---

## 🔧 구체적인 리팩토링 예시

### 예시 1: Actions 파일 정리

**Before**:

```typescript
// app/actions/plan.ts
export {
  createStudentPlan,
  updateStudentPlan,
  deleteStudentPlan,
} from "@/app/(student)/actions/planActions";

// 사용처
import { createStudentPlan } from "@/app/actions/plan";
```

**After**:

```typescript
// app/actions/plan.ts 제거

// 사용처
import { createStudentPlan } from "@/app/(student)/actions/planActions";
```

---

### 예시 2: EmptyState 통합

**Before**:

```typescript
// components/EmptyState.tsx (re-export)
export { EmptyState } from "./ui/EmptyState";

// app/(student)/blocks/_components/EmptyState.tsx (중복)
export default function EmptyState({ icon, title, description }) {
  // 별도 구현
}
```

**After**:

```typescript
// components/ui/EmptyState.tsx (통합)
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon = "📭",
}: EmptyStateProps) {
  // 통합된 구현
}

// 사용처
import { EmptyState } from "@/components/ui/EmptyState";
```

---

### 예시 3: Layout 통합

**Before**:

```typescript
// app/(student)/layout.tsx
export default async function StudentLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:block w-64 border-r border-gray-200 bg-white">
        {/* 중복 코드 */}
      </aside>
      {/* ... */}
    </div>
  );
}

// app/(admin)/layout.tsx
export default async function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:block w-64 border-r border-gray-200 bg-white">
        {/* 거의 동일한 코드 */}
      </aside>
      {/* ... */}
    </div>
  );
}
```

**After**:

```typescript
// components/layout/RoleBasedLayout.tsx
export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
}: RoleBasedLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:block w-64 border-r border-gray-200 bg-white">
        {/* 공통 구현 */}
      </aside>
      {/* ... */}
    </div>
  );
}

// app/(student)/layout.tsx
export default async function StudentLayout({ children }) {
  return (
    <RoleBasedLayout role="student" dashboardHref="/dashboard" roleLabel="학생">
      {children}
    </RoleBasedLayout>
  );
}
```

---

## 📝 체크리스트

### Phase 1 체크리스트

- [ ] `app/actions/plan.ts` 정리
- [ ] `app/actions/contents.ts` 정리
- [ ] EmptyState 컴포넌트 통합
- [ ] Layout 컴포넌트 중복 제거
- [ ] 모든 import 경로 업데이트
- [ ] 빌드 테스트 통과

### Phase 2 체크리스트

- [ ] 타입 정의 통합
- [ ] 가이드라인 준수 검토
- [ ] 네이밍 규칙 통일
- [ ] 불필요한 추상화 제거
- [ ] Spacing-First 정책 준수 확인

### Phase 3 체크리스트

- [ ] 컴포넌트 구조 최적화
- [ ] 데이터 페칭 로직 통합
- [ ] 성능 최적화
- [ ] 문서화 업데이트

---

## 🚨 주의사항

1. **점진적 리팩토링**: 한 번에 모든 것을 변경하지 말고 단계적으로 진행
2. **테스트**: 각 단계마다 빌드 및 기능 테스트 수행
3. **백업**: 리팩토링 전 현재 상태 커밋
4. **팀 협의**: 큰 구조 변경은 팀과 논의 후 진행

---

## 📚 참고 자료

- [개발 가이드라인](./docs/README.md)
- [Next.js 15 문서](https://nextjs.org/docs)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

**작성자**: AI Assistant  
**최종 수정일**: 2025-01-27
