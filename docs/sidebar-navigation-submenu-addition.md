# 사이드 네비게이션 하위 메뉴 추가

## 작업 개요

**작업 일자**: 2024년 11월 29일  
**목표**: 학생 사이드바 네비게이션에 시간 관리와 성적 관리의 하위 메뉴를 추가하여 사용자가 각 기능에 빠르게 접근할 수 있도록 개선

## 변경 사항

### 1. 사이드바 네비게이션 메뉴 구조 업데이트

**파일**: `components/navigation/global/categoryConfig.ts`

#### 시간 관리 메뉴 확장

기존의 단일 항목 "시간 블록 설정"을 3개의 하위 메뉴로 확장:

```typescript
{
  id: "time",
  label: "시간 관리",
  icon: "⏰",
  items: [
    {
      id: "blocks-sets",
      label: "블록 세트",
      href: "/blocks?tab=blocks",
      icon: "📅",
    },
    {
      id: "blocks-exclusions",
      label: "학습 제외 일정",
      href: "/blocks?tab=exclusions",
      icon: "🗓️",
    },
    {
      id: "blocks-academy",
      label: "학원 일정",
      href: "/blocks?tab=academy",
      icon: "🏫",
    },
  ],
},
```

#### 성적 관리 메뉴 확장

기존의 단일 항목 "성적 대시보드"를 4개의 하위 메뉴로 확장:

```typescript
{
  id: "scores",
  label: "성적 관리",
  icon: "📝",
  items: [
    {
      id: "scores-dashboard",
      label: "성적 대시보드",
      href: "/scores/dashboard/unified",
      icon: "📊",
    },
    {
      id: "scores-input-internal",
      label: "내신 성적 입력",
      href: "/scores/input?tab=internal",
      icon: "✏️",
    },
    {
      id: "scores-input-mock",
      label: "모의고사 성적 입력",
      href: "/scores/input?tab=mock",
      icon: "📝",
    },
    {
      id: "scores-analysis",
      label: "상세 분석 보기",
      href: "/scores/analysis",
      icon: "📈",
    },
  ],
},
```

### 2. 시간 블록 관리 컴포넌트 쿼리 파라미터 지원 추가

**파일**: `app/(student)/blocks/_components/BlockManagementContainer.tsx`

쿼리 파라미터(`?tab=blocks|exclusions|academy`)로 초기 탭 설정 및 탭 전환 지원:

```typescript
const searchParams = useSearchParams();
const tabParam = searchParams?.get("tab");

const [activeTab, setActiveTab] = useState<ManagementTab>(() => {
  if (tabParam === "exclusions") return "exclusions";
  if (tabParam === "academy") return "academy";
  return "blocks";
});

// 쿼리 파라미터 변경 시 탭 전환
useEffect(() => {
  if (tabParam === "exclusions") setActiveTab("exclusions");
  else if (tabParam === "academy") setActiveTab("academy");
  else if (tabParam === "blocks") setActiveTab("blocks");
}, [tabParam]);
```

### 3. 성적 입력 레이아웃 쿼리 파라미터 지원 추가

**파일**: `app/(student)/scores/input/_components/ScoreInputLayout.tsx`

쿼리 파라미터(`?tab=internal|mock`)로 초기 탭 설정 및 탭 전환 지원:

```typescript
const searchParams = useSearchParams();
const tabParam = searchParams?.get("tab");

const [scoreType, setScoreType] = useState<ScoreType>(() => {
  return tabParam === "mock" ? "mock" : "internal";
});

// 쿼리 파라미터 변경 시 탭 전환
useEffect(() => {
  if (tabParam === "internal") setScoreType("internal");
  else if (tabParam === "mock") setScoreType("mock");
}, [tabParam]);
```

## 구현 방식

### URL 쿼리 파라미터 사용

기존 페이지 구조를 유지하면서 쿼리 파라미터를 통해 탭을 직접 지정하는 방식 채택:

- **장점**:
  - 새로운 페이지를 생성하지 않아도 됨
  - 기존 탭 구조와 로직 재사용 가능
  - URL로 특정 탭 상태 공유 가능
  - SEO 친화적 (쿼리 파라미터는 검색 엔진에서 인식 가능)

- **동작 방식**:
  1. 사이드바 메뉴 클릭 시 쿼리 파라미터가 포함된 URL로 이동
  2. `useSearchParams` 훅으로 쿼리 파라미터 읽기
  3. 초기 상태 설정 시 쿼리 파라미터 값 반영
  4. `useEffect`로 쿼리 파라미터 변경 감지 및 탭 전환

## 결과

### 시간 관리 메뉴

- ⏰ 시간 관리
  - 📅 블록 세트 → `/blocks?tab=blocks`
  - 🗓️ 학습 제외 일정 → `/blocks?tab=exclusions`
  - 🏫 학원 일정 → `/blocks?tab=academy`

### 성적 관리 메뉴

- 📝 성적 관리
  - 📊 성적 대시보드 → `/scores/dashboard/unified`
  - ✏️ 내신 성적 입력 → `/scores/input?tab=internal`
  - 📝 모의고사 성적 입력 → `/scores/input?tab=mock`
  - 📈 상세 분석 보기 → `/scores/analysis`

## 사용자 경험 개선

1. **빠른 접근**: 사이드바에서 원하는 기능으로 바로 이동 가능
2. **명확한 구조**: 기능별로 그룹화되어 찾기 쉬움
3. **URL 공유**: 쿼리 파라미터가 포함된 URL로 특정 탭 상태 공유 가능
4. **일관성**: 기존 페이지 구조와 디자인 유지

## 기술적 고려사항

### Next.js 클라이언트 컴포넌트 사용

쿼리 파라미터를 읽기 위해 `useSearchParams` 훅 사용:

- 클라이언트 컴포넌트에서만 사용 가능 (`"use client"` 지시어 필요)
- 서버 사이드 렌더링 시에도 초기 상태가 올바르게 설정됨
- 페이지 새로고침 시에도 탭 상태 유지

### 접근성

- 키보드 네비게이션 지원
- 아이콘과 텍스트 레이블 모두 제공
- 명확한 활성 상태 표시

## 변경된 파일 목록

1. `components/navigation/global/categoryConfig.ts` - 사이드바 메뉴 구조 업데이트
2. `app/(student)/blocks/_components/BlockManagementContainer.tsx` - 쿼리 파라미터 지원 추가
3. `app/(student)/scores/input/_components/ScoreInputLayout.tsx` - 쿼리 파라미터 지원 추가

## 테스트 확인 사항

- [x] 사이드바 메뉴에 하위 항목이 올바르게 표시됨
- [x] 각 하위 메뉴 클릭 시 해당 탭으로 이동
- [x] 쿼리 파라미터가 URL에 올바르게 반영됨
- [x] 페이지 새로고침 시 탭 상태 유지
- [x] 브라우저 뒤로가기/앞으로가기 시 탭 상태 변경
- [x] ESLint 오류 없음

## 향후 개선 사항

1. **브라우저 히스토리 관리**: 탭 전환 시 `router.push` 사용하여 브라우저 히스토리에 추가 가능
2. **애니메이션**: 탭 전환 시 부드러운 애니메이션 효과 추가
3. **분석 추적**: 사용자가 어떤 메뉴를 자주 사용하는지 추적

