# 컴포넌트 구조 개선 가이드

## 서버/클라이언트 컴포넌트 경계 명확화

### 원칙

1. **서버 컴포넌트 우선**: 기본적으로 서버 컴포넌트로 작성
2. **클라이언트 컴포넌트는 인터랙션만**: 상태 관리, 이벤트 핸들러, 브라우저 API 사용 시에만 클라이언트 컴포넌트 사용
3. **데이터 페칭은 서버에서**: 서버 컴포넌트에서 데이터 페칭 후 props로 전달

### 서버 컴포넌트 사용 시기

- 데이터 페칭 (Supabase 쿼리)
- 정적 콘텐츠 렌더링
- SEO가 중요한 콘텐츠
- 서버 사이드 로직 실행

### 클라이언트 컴포넌트 사용 시기

- 사용자 인터랙션 (onClick, onChange 등)
- 상태 관리 (useState, useReducer)
- 브라우저 API 사용 (localStorage, window 등)
- React Hooks 사용 (useEffect, useCallback 등)
- Context API 사용
- 실시간 업데이트 (WebSocket, Supabase Realtime)

### 현재 구조 분석

#### ✅ 잘 적용된 예시

1. **`app/(student)/today/page.tsx`** (서버 컴포넌트)
   - 서버에서 `todayProgress` 계산
   - 클라이언트 컴포넌트에 props로 전달

2. **`app/(student)/today/_components/TodayPlanList.tsx`** (서버 컴포넌트)
   - 서버에서 데이터 페칭
   - 정적 렌더링

3. **`app/(student)/today/_components/TodayRecommendations.tsx`** (서버 컴포넌트)
   - 서버에서 추천 데이터 조회
   - 정적 렌더링

#### ⚠️ 개선 가능한 영역

1. **`app/(student)/today/_components/PlanViewContainer.tsx`** (클라이언트 컴포넌트)
   - 실시간 업데이트가 필요하므로 클라이언트 컴포넌트 유지 필요
   - 하지만 초기 데이터는 서버에서 가져올 수 있음

2. **`app/(student)/today/_components/TodayPageContent.tsx`** (클라이언트 컴포넌트)
   - 사용자 인터랙션이 많으므로 클라이언트 컴포넌트 유지 필요
   - 초기 데이터는 서버에서 가져오고 있음 (잘 적용됨)

### 권장 패턴

#### 패턴 1: 서버 컴포넌트에서 데이터 페칭 후 클라이언트 컴포넌트에 전달

```tsx
// app/page.tsx (서버 컴포넌트)
export default async function Page() {
  const data = await fetchData();
  return <ClientComponent initialData={data} />;
}

// components/ClientComponent.tsx (클라이언트 컴포넌트)
"use client";
export function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData);
  // 인터랙션 로직
}
```

#### 패턴 2: 서버 컴포넌트와 클라이언트 컴포넌트 분리

```tsx
// components/ServerDataFetcher.tsx (서버 컴포넌트)
export async function ServerDataFetcher() {
  const data = await fetchData();
  return <ClientInteractiveComponent data={data} />;
}

// components/ClientInteractiveComponent.tsx (클라이언트 컴포넌트)
"use client";
export function ClientInteractiveComponent({ data }) {
  // 인터랙션 로직
}
```

### 불필요한 "use client" 제거 체크리스트

- [ ] 단순히 스타일링만 하는 컴포넌트
- [ ] 서버에서 데이터를 가져올 수 있는 컴포넌트
- [ ] 정적 콘텐츠만 렌더링하는 컴포넌트
- [ ] 인터랙션이 없는 컴포넌트

### 현재 상태

- 대부분의 컴포넌트가 적절하게 서버/클라이언트로 분리되어 있음
- 실시간 업데이트가 필요한 컴포넌트는 클라이언트 컴포넌트로 유지
- 서버 컴포넌트에서 데이터 페칭 후 props로 전달하는 패턴이 잘 적용됨

### 향후 개선 사항

1. 초기 데이터 로딩 최적화: 클라이언트 컴포넌트의 초기 데이터를 서버에서 가져오도록 개선
2. 컴포넌트 분리: 데이터 페칭과 인터랙션 로직을 더 명확히 분리
3. 성능 최적화: 불필요한 클라이언트 번들 크기 감소

