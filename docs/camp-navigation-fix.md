# 캠프 페이지 네비게이션 수정

## 🔍 문제 상황

캠프 목록 페이지(`/camp`)에서 "플랜 보기" 버튼을 클릭했을 때, 플랜 그룹 상세 페이지가 일반 모드로 표시되어 네비게이션이 혼란스러웠습니다.

### 문제점

1. **CampInvitationActions 컴포넌트**에서 "플랜 보기" 링크가 `?camp=true` 쿼리 파라미터 없이 이동
   - 결과: 캠프 컨텍스트에서 왔지만 일반 모드로 표시
   - 뒤로가기 버튼이 `/plan`으로 이동 (캠프 목록이 아님)

2. **플랜 그룹 상세 페이지**에서 URL 쿼리 파라미터를 확인하지 않음
   - `plan_type`만으로 캠프 모드 판단
   - URL에서 명시적으로 캠프 모드를 지정할 수 없음

## 🛠 수정 내용

### 1. CampInvitationActions.tsx 수정

**파일**: `app/(student)/camp/_components/CampInvitationActions.tsx`

**변경 사항**:
- 모든 "플랜 보기" 링크에 `?camp=true` 쿼리 파라미터 추가
- 105번 라인: `paused` 상태일 때의 "플랜 보기" 버튼
- 114번 라인: 기타 상태일 때의 "플랜 보기" 버튼

**변경 전**:
```tsx
<Link
  href={`/plan/group/${invitation.planGroupId}`}
  ...
>
  플랜 보기
</Link>
```

**변경 후**:
```tsx
<Link
  href={`/plan/group/${invitation.planGroupId}?camp=true`}
  ...
>
  플랜 보기
</Link>
```

### 2. Plan Group Detail Page 수정

**파일**: `app/(student)/plan/group/[id]/page.tsx`

**변경 사항**:
1. `searchParams` prop 추가
2. 캠프 모드 판단 로직 강화

**변경 전**:
```tsx
type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanGroupDetailPage({
  params,
}: PlanGroupDetailPageProps) {
  // ...
  const isCampMode = group.plan_type === "camp";
}
```

**변경 후**:
```tsx
type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ camp?: string }>;
};

export default async function PlanGroupDetailPage({
  params,
  searchParams,
}: PlanGroupDetailPageProps) {
  // ...
  // plan_type을 우선으로 하되, URL 쿼리 파라미터도 확인하여 명시적으로 캠프 모드 강제 가능
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const campParam = resolvedSearchParams?.camp;
  const isCampMode = group.plan_type === "camp" || campParam === "true";
}
```

## ✅ 수정 결과

### 정상 동작 확인

1. **캠프 목록에서 카드 클릭** (이미 정상)
   - `/plan/group/{id}?camp=true`로 이동
   - 캠프 모드로 표시
   - "목록으로" 버튼이 `/camp`로 이동 ✅

2. **캠프 목록에서 "플랜 보기" 버튼 클릭** (수정됨)
   - `/plan/group/{id}?camp=true`로 이동
   - 캠프 모드로 표시
   - "목록으로" 버튼이 `/camp`로 이동 ✅

3. **일반 모드에서 플랜 그룹 상세 접근**
   - `/plan/group/{id}`로 이동 (쿼리 파라미터 없음)
   - `plan_type`이 "camp"가 아니면 일반 모드로 표시
   - "목록으로" 버튼이 `/plan`으로 이동 ✅

## 🔗 관련 파일

- `app/(student)/camp/_components/CampInvitationActions.tsx` - 수정됨
- `app/(student)/plan/group/[id]/page.tsx` - 수정됨
- `app/(student)/camp/page.tsx` - 이미 정상 동작 (참고용)

## 📝 참고 사항

### 캠프 모드 판단 우선순위

1. **주요 판단 기준**: `group.plan_type === "camp"`
   - 데이터베이스의 플랜 그룹 타입이 최종 판단 기준

2. **보조 판단 기준**: URL 쿼리 파라미터 `camp=true`
   - 네비게이션 및 UI 결정을 위해 명시적으로 캠프 모드 강제 가능
   - `plan_type`이 "camp"가 아니어도 `camp=true`가 있으면 캠프 모드로 표시

### 네비게이션 경로 정리

| 출발 페이지 | 버튼/액션 | 이동 경로 | 모드 |
|-----------|---------|----------|-----|
| `/camp` | 카드 클릭 (플랜 있음) | `/plan/group/{id}?camp=true` | 캠프 ✅ |
| `/camp` | "플랜 보기" (paused) | `/plan/group/{id}?camp=true` | 캠프 ✅ |
| `/camp` | "플랜 보기" (기타) | `/plan/group/{id}?camp=true` | 캠프 ✅ |
| `/camp` | "학습 시작하기" | `/camp/today` | 캠프 ✅ |
| `/camp` | "학습 재개하기" | `/camp/today` | 캠프 ✅ |
| `/plan` | 플랜 그룹 클릭 | `/plan/group/{id}` | 일반 ✅ |

---

**작업 날짜**: 2025년 1월 27일  
**작업자**: AI Assistant

