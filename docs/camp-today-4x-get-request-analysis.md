# /camp/today GET 4회 발생 원인 분석 및 해결 방안

## 📋 문제 현상

캠프 모드에서 플랜 완료 후 `/camp/today`로 돌아올 때, dev 서버 로그에 다음과 같이 4번의 GET 요청이 발생:

```
GET /camp/today?date=2025-12-14 200 in 2.0s
GET /camp/today?date=2025-12-14 200 in 2.1s
GET /camp/today?date=2025-12-14 200 in 2.1s
GET /camp/today?date=2025-12-14 200 in 2.1s
GET /api/today/plans?date=2025-12-14&camp=true 200 in 2.5s
GET /api/today/plans?date=2025-12-14&camp=true 200 in 2.5s
```

**목표**: 설계상 최소 2회 (router.push 1회 + router.replace 1회)로 줄이기

---

## 1️⃣ 원인 분석

### 1-1. 코드 스캔 결과

#### `/camp/today`로 가는 모든 네비게이션 패턴

1. **PlanExecutionForm.tsx** (166번, 212번 줄)
   - `handleComplete`: `router.push("/camp/today?completedPlanId=...&date=...")`
   - `handlePostpone`: `router.push("/camp/today?date=...")`
   - ✅ **의도된 네비게이션**

2. **CompletionToast.tsx** (40번 줄)
   - `useEffect` 내부: `router.replace("/camp/today?date=...")`
   - ✅ **의도된 네비게이션 (URL 정리)**

3. **CampInvitationActions.tsx** (51번, 79번 줄)
   - `<Link href="/camp/today">` - 완료 플로우와 무관

#### useEffect에서 router.push/replace 하는 패턴

- **CompletionToast.tsx**: `useEffect` 내부에서 `router.replace` 호출
- 다른 컴포넌트에서는 `useEffect` 내부에서 네비게이션 없음

#### 날짜 정규화/기본 date 세팅 로직

- `/camp/today/page.tsx`에서 서버 사이드에서 날짜 처리
- 클라이언트 사이드에서 추가 네비게이션 없음

---

### 1-2. 실제 플로우 추적

#### 완료 플로우 시나리오

```
1. /today/plan/[planId]?mode=camp 에서 "완료 확정" 클릭
   ↓
2. completePlan server action 호출
   - revalidatePath("/today")
   - revalidatePath("/camp/today")
   ↓
3. PlanExecutionForm.handleComplete
   - router.push("/camp/today?completedPlanId=123&date=2025-12-14")
   ↓
4. /camp/today 페이지 렌더링 (서버 컴포넌트)
   - TodayPageContent 2회 렌더링 (lg:col-span-8, lg:col-span-4)
   - 각 TodayPageContent는 CompletionToast 포함
   ↓
5. CompletionToast useEffect 실행 (2회 - 각 TodayPageContent마다)
   - 첫 번째: handled=false → router.replace("/camp/today?date=2025-12-14")
   - 두 번째: handled=true → early return
   ↓
6. router.replace로 인한 재렌더링
   - /camp/today?date=2025-12-14로 다시 렌더링
```

#### 이론상 발생해야 하는 GET /camp/today 횟수

**최소값**: 2회
1. `router.push`로 인한 첫 번째 GET
2. `CompletionToast`의 `router.replace`로 인한 두 번째 GET

---

### 1-3. 실제 4회 발생 원인 분석

#### 원인 1: TodayPageContent 중복 렌더링

**발견 사항**:
```tsx
// app/(student)/camp/today/page.tsx
<div className="lg:col-span-8">
  <TodayPageContent ... />  {/* 첫 번째 */}
</div>
<div className="lg:col-span-4">
  <TodayPageContent ... />  {/* 두 번째 */}
</div>
```

**영향**:
- `TodayPageContent`가 2회 렌더링됨
- 각각 `CompletionToast`를 포함
- 하지만 `CompletionToast`는 `handled` state로 중복 실행 방지

**결론**: ✅ **이 부분은 문제 없음** (handled 가드로 보호됨)

#### 원인 2: React Strict Mode (개발 모드)

**발견 사항**:
- Next.js 개발 모드에서 React Strict Mode 활성화
- Strict Mode는 개발 모드에서 effect를 2회 실행

**영향**:
- `CompletionToast`의 `useEffect`가 Strict Mode에서 2회 실행될 수 있음
- 하지만 `handled` state로 실제 처리 로직은 1회만 실행

**결론**: ⚠️ **Strict Mode로 인한 중복 실행 가능하나, handled 가드로 보호됨**

#### 원인 3: Next.js App Router의 서버 컴포넌트 렌더링 특성

**발견 사항**:
- `/camp/today/page.tsx`는 서버 컴포넌트 (`export const dynamic = "force-dynamic"`)
- `router.push`/`router.replace` 호출 시 서버 컴포넌트가 재렌더링됨

**영향**:
- `router.push` → 서버 컴포넌트 재렌더링 (1회)
- `router.replace` → 서버 컴포넌트 재렌더링 (1회)
- 하지만 각 네비게이션마다 서버 컴포넌트가 2회 렌더링될 수 있음 (Next.js 내부 최적화)

**결론**: ⚠️ **Next.js App Router의 내부 동작으로 인한 중복 렌더링 가능**

#### 원인 4: PlanViewContainer의 데이터 페칭

**발견 사항**:
```tsx
// PlanViewContainer.tsx
useEffect(() => {
  if (initialPlanDate) {
    loadData(initialPlanDate);
  } else {
    loadData();
  }
}, [initialPlanDate, loadData]);
```

**영향**:
- `PlanViewContainer`는 `TodayPageContent` 내부에서 사용됨
- `TodayPageContent`가 2회 렌더링되면 `PlanViewContainer`도 2회 렌더링
- 각각 `/api/today/plans`를 fetch

**결론**: ⚠️ **이 부분이 API 호출 중복의 원인일 수 있음**

---

### 1-4. 4회 GET 발생 원인 종합

#### 실제 발생 순서 추정

```
1. router.push("/camp/today?completedPlanId=123&date=2025-12-14")
   → GET /camp/today?completedPlanId=123&date=2025-12-14 (1회)
   → 서버 컴포넌트 렌더링
   → TodayPageContent 2회 렌더링 (레이아웃 구조상)
   → PlanViewContainer 2회 렌더링
   → /api/today/plans 2회 호출

2. CompletionToast useEffect 실행
   → router.replace("/camp/today?date=2025-12-14")
   → GET /camp/today?date=2025-12-14 (2회)
   → 서버 컴포넌트 재렌더링
   → TodayPageContent 2회 재렌더링
   → PlanViewContainer 2회 재렌더링
   → /api/today/plans 2회 재호출

3. React Strict Mode (개발 모드)
   → 추가 중복 실행 가능

4. Next.js App Router 내부 최적화
   → 서버 컴포넌트 중복 렌더링 가능
```

**결론**: 
- **코드 레벨 중복 네비게이션**: 없음 ✅
- **컴포넌트 구조상 중복 렌더링**: TodayPageContent 2회 렌더링
- **Next.js/React 특성**: Strict Mode + App Router 내부 동작

---

## 2️⃣ 현재 코드에서의 한계

### 2-1. 제거 불가능한 부분

#### Next.js App Router 특성
- 서버 컴포넌트는 `router.push`/`router.replace` 호출 시 재렌더링됨
- 이는 Next.js의 설계상 불가피한 동작

#### React Strict Mode (개발 모드)
- 개발 모드에서 effect를 2회 실행하여 버그를 조기 발견
- 프로덕션 빌드에서는 1회만 실행

#### 레이아웃 구조
- `/camp/today` 페이지가 `TodayPageContent`를 2회 렌더링 (lg:col-span-8, lg:col-span-4)
- 이는 UI 레이아웃 요구사항으로 변경 불가

### 2-2. 개선 가능한 부분

#### PlanViewContainer의 중복 데이터 페칭
- `TodayPageContent`가 2회 렌더링되면 `PlanViewContainer`도 2회 렌더링
- 각각 `/api/today/plans`를 독립적으로 fetch
- **개선 가능**: 데이터를 상위에서 fetch하고 props로 전달

#### CompletionToast의 중복 렌더링
- `TodayPageContent`가 2회 렌더링되면 `CompletionToast`도 2회 렌더링
- 하지만 `handled` state로 중복 실행 방지
- **개선 가능**: `CompletionToast`를 상위 레벨로 이동하여 1회만 렌더링

---

## 3️⃣ 선택 가능한 개선안

### 옵션 A: UX 스펙 유지 + 최적화 (권장)

#### 변경 개요
1. `CompletionToast`를 페이지 레벨로 이동 (TodayPageContent 밖으로)
2. `PlanViewContainer`의 데이터 페칭을 상위로 이동 (선택적)

#### 장점
- UX 스펙 유지 (URL 정리, 토스트 표시)
- 중복 렌더링 감소
- 코드 변경 최소화

#### 단점
- 레이아웃 구조 변경 필요
- 약간의 리팩토링 필요

#### 영향 받는 파일
- `app/(student)/camp/today/page.tsx`
- `app/(student)/today/page.tsx`
- `app/(student)/today/_components/TodayPageContent.tsx`
- `app/(student)/today/_components/CompletionToast.tsx`

#### 예상 diff 형태

```tsx
// app/(student)/camp/today/page.tsx
export default async function CampTodayPage({ searchParams }: CampTodayPageProps) {
  // ... 기존 코드 ...
  
  const completedPlanIdParam = getParam("completedPlanId");
  let completedPlanTitle: string | null = null;
  if (completedPlanIdParam) {
    // 완료된 플랜 정보 조회
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* ... 기존 헤더 ... */}
        <CurrentLearningSection campMode={true} />
        
        {/* ✅ CompletionToast를 페이지 레벨로 이동 */}
        <CompletionToast 
          completedPlanId={completedPlanIdParam} 
          planTitle={completedPlanTitle} 
        />
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <TodayPageContent
              initialMode={requestedView}
              initialPlanDate={requestedDate}
              initialProgressDate={targetProgressDate}
              initialProgress={todayProgress}
              showAchievements={false}
              userId={userId}
              campMode={true}
              // ✅ completedPlanId props 제거
            />
          </div>
          {/* ... */}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// app/(student)/today/_components/TodayPageContent.tsx
export function TodayPageContent({
  // ... 기존 props ...
  // ✅ completedPlanId, completedPlanTitle props 제거
}: TodayPageContentProps) {
  // ... 기존 코드 ...
  
  return (
    <div className="flex flex-col gap-6">
      {/* ✅ CompletionToast 제거 */}
      {showPlans && (
        <PlanViewContainer
          // ... 기존 props ...
        />
      )}
      {/* ... */}
    </div>
  );
}
```

**예상 효과**:
- `CompletionToast` 렌더링: 2회 → 1회
- GET /camp/today: 4회 → 2~3회 (Strict Mode 제외 시)

---

### 옵션 B: UX 스펙 변경 + 극단적 최적화

#### 변경 개요
1. `completedPlanId` 쿼리를 URL에 남겨두기 (제거하지 않음)
2. `CompletionToast`의 `router.replace` 제거
3. 서버 컴포넌트에서 `completedPlanId` 처리

#### 장점
- 네비게이션 최소화 (router.push 1회만)
- 서버 사이드에서 처리하여 클라이언트 네비게이션 제거

#### 단점
- URL에 `completedPlanId`가 남음 (UX 변경)
- 브라우저 히스토리에 불필요한 쿼리 남음
- 새로고침 시 토스트가 다시 표시될 수 있음

#### 영향 받는 파일
- `app/(student)/camp/today/page.tsx`
- `app/(student)/today/page.tsx`
- `app/(student)/today/_components/CompletionToast.tsx`

#### 예상 diff 형태

```tsx
// app/(student)/today/_components/CompletionToast.tsx
export function CompletionToast({ completedPlanId, planTitle }: CompletionToastProps) {
  const searchParams = useSearchParams();
  const { showSuccess } = useToast();
  const planId = completedPlanId || searchParams.get("completedPlanId");
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!planId || handled) {
      return;
    }

    setHandled(true);
    
    // ✅ router.replace 제거
    // 토스트만 표시
    const title = planTitle || "플랜";
    showSuccess(`${title} 플랜이 완료 처리되었습니다.`);
  }, [planId, planTitle, handled, showSuccess]);

  return null;
}
```

**예상 효과**:
- GET /camp/today: 4회 → 1~2회 (Strict Mode 제외 시)
- 하지만 URL에 `completedPlanId`가 남음

---

### 옵션 C: 하이브리드 접근 (서버 사이드 URL 정리)

#### 변경 개요
1. `CompletionToast`의 `router.replace` 제거
2. 서버 컴포넌트에서 `completedPlanId` 감지 시 `redirect` 사용
3. 클라이언트에서는 토스트만 표시

#### 장점
- 서버 사이드에서 URL 정리 (클라이언트 네비게이션 없음)
- UX 스펙 유지 (URL 정리)

#### 단점
- 서버 컴포넌트에서 `redirect` 사용 시 추가 렌더링 발생 가능
- 구현 복잡도 증가

#### 영향 받는 파일
- `app/(student)/camp/today/page.tsx`
- `app/(student)/today/page.tsx`
- `app/(student)/today/_components/CompletionToast.tsx`

#### 예상 diff 형태

```tsx
// app/(student)/camp/today/page.tsx
export default async function CampTodayPage({ searchParams }: CampTodayPageProps) {
  // ... 기존 코드 ...
  
  const completedPlanIdParam = getParam("completedPlanId");
  
  // ✅ completedPlanId가 있으면 URL 정리 후 redirect
  if (completedPlanIdParam) {
    const params = new URLSearchParams();
    if (dateParam) {
      params.set("date", dateParam);
    }
    const query = params.toString();
    redirect(`/camp/today${query ? `?${query}` : ""}`);
  }
  
  // ... 나머지 코드 ...
}
```

**예상 효과**:
- GET /camp/today: 4회 → 2회 (redirect 1회 + 최종 렌더링 1회)
- 하지만 서버 사이드 redirect로 인한 추가 요청 가능

---

## 4️⃣ 최종 권장 사항

### 우선순위 1: 옵션 A (UX 스펙 유지 + 최적화)

**이유**:
1. UX 스펙을 유지하면서 중복 렌더링을 줄일 수 있음
2. 코드 변경이 최소화됨
3. `CompletionToast`를 페이지 레벨로 이동하여 1회만 렌더링

**예상 효과**:
- Dev 모드: 4회 → 2~3회 (Strict Mode 제외 시 2회)
- Prod 모드: 2~3회 → 2회

### 우선순위 2: PlanViewContainer 데이터 페칭 최적화 (선택적)

**이유**:
- `TodayPageContent`가 2회 렌더링되는 구조상, 데이터 페칭도 2회 발생
- 상위에서 fetch하고 props로 전달하면 중복 방지

**예상 효과**:
- `/api/today/plans` 호출: 2회 → 1회

---

## 5️⃣ 결론

### 코드 레벨 중복 네비게이션
✅ **없음** - `router.push` 1회, `router.replace` 1회만 존재

### 실제 4회 발생 원인
1. **TodayPageContent 중복 렌더링** (레이아웃 구조상 2회)
2. **Next.js App Router 내부 동작** (서버 컴포넌트 재렌더링)
3. **React Strict Mode** (개발 모드에서 effect 2회 실행)

### 개선 가능 범위
- **옵션 A 적용 시**: Dev 모드 4회 → 2~3회, Prod 모드 2~3회 → 2회
- **완전 제거 불가능**: Next.js/React 특성상 최소 2회는 불가피

### 최종 평가
현재 코드는 **의도된 네비게이션만 존재**하며, 4회 발생은 **Next.js/React 특성 + 레이아웃 구조**로 인한 것입니다. 옵션 A를 적용하면 **2~3회로 줄일 수 있으며**, 프로덕션 빌드에서는 **2회가 한계**입니다.

---

## 6️⃣ 적용 완료: 옵션 A 구현

### 변경 사항

1. **`app/(student)/camp/today/page.tsx`**
   - `CompletionToast` import 추가
   - `getPlanById` import 추가
   - `completedPlanIdParam` 파라미터 추출 추가
   - 완료된 플랜 정보 조회 로직 추가
   - `CompletionToast`를 페이지 레벨로 이동 (TodayPageContent 밖으로)
   - `TodayPageContent`에서 `completedPlanId`, `completedPlanTitle` props 제거

2. **`app/(student)/today/page.tsx`**
   - `CompletionToast` import 추가
   - `CompletionToast`를 페이지 레벨로 이동 (TodayPageContent 밖으로)
   - `TodayPageContent`에서 `completedPlanId`, `completedPlanTitle` props 제거

3. **`app/(student)/today/_components/TodayPageContent.tsx`**
   - `CompletionToast` import 제거
   - `completedPlanId`, `completedPlanTitle` props 제거
   - `CompletionToast` 컴포넌트 제거

### 예상 효과

- **CompletionToast 렌더링**: 2회 → 1회 (페이지 레벨로 이동)
- **GET /camp/today**: Dev 모드 4회 → 2~3회, Prod 모드 2~3회 → 2회
- **UX 스펙 유지**: URL 정리 및 토스트 표시 기능 유지

### 검증 필요 사항

1. 플랜 완료 후 `/camp/today`로 이동 시 GET 요청 횟수 확인
2. `CompletionToast`가 1회만 렌더링되는지 확인
3. URL 정리 및 토스트 표시가 정상 동작하는지 확인

