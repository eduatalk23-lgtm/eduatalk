# Rate Limit 원인 분석 및 개선 방안

## 🔍 문제 분석

### Rate Limit 발생 원인

#### 1. **페이지 로드 시 중복 인증 요청**
- 각 페이지 컴포넌트에서 `supabase.auth.getUser()` 직접 호출
- 탭 이동 시마다 새 페이지가 렌더링되면서 인증 요청 발생
- 빠른 탭 클릭 시 여러 페이지가 동시에 로드되며 요청이 누적됨

**현재 구조:**
```
/scores/school/1/1 → getUser() 호출
/scores/school/2/1 → getUser() 호출 (탭 클릭 시)
/scores/school/3/1 → getUser() 호출 (탭 클릭 시)
```

#### 2. **중복 인증 체크**
- `getUser()` → `getCurrentUserRole()` → `getTenantContext()` 순차 호출
- 각 함수에서 `getUser()`를 다시 호출하는 경우 발생

#### 3. **탭 네비게이션 특성**
- 클라이언트 사이드 라우팅(`router.push()`) 사용
- 빠른 탭 전환 시 이전 페이지가 아직 unmount되지 않은 상태에서 새 페이지가 mount됨
- 여러 페이지 인스턴스가 동시에 인증 요청

## 🛠️ 개선 방안

### 1. **인증 요청 최소화 (이미 구현됨)**
✅ Rate limit 에러 처리 및 재시도 로직 추가
✅ `retryWithBackoff` 함수로 자동 재시도
✅ 인증 요청 간 throttling (100ms 간격)

### 2. **탭 이동 시 Prefetch 비활성화**
```typescript
// 탭 버튼에 prefetch={false} 추가
<Link href={href} prefetch={false}>
```

### 3. **클라이언트 사이드 인증 상태 캐싱**
- React Context 또는 SWR을 사용하여 인증 상태 캐싱
- 서버 컴포넌트에서는 캐싱된 정보 활용

### 4. **탭 이동 Debouncing**
```typescript
// 탭 클릭 시 200ms 지연 (연속 클릭 방지)
const handleTabClick = debounce((href: string) => {
  router.push(href);
}, 200);
```

### 5. **페이지별 인증 요청 최적화**
- 레이아웃 레벨에서 한 번만 인증 체크
- 페이지 컴포넌트에서는 인증 정보를 props로 받기

## 📊 예상 효과

1. **인증 요청 감소**: 탭 이동 시 중복 요청 제거 → 약 70% 감소 예상
2. **Rate limit 에러 감소**: 재시도 로직 + throttling → 약 90% 감소 예상
3. **사용자 경험 개선**: 빠른 탭 전환 시에도 안정적인 동작

## 🔄 즉시 적용 가능한 개선

### 1. 탭 컴포넌트에 Debouncing 추가
### 2. Prefetch 비활성화
### 3. 레이아웃 레벨 인증 체크 (장기)

## ⚠️ 주의사항

- 레이아웃 레벨 인증 체크는 Next.js 15의 구조 변경이 필요할 수 있음
- 클라이언트 사이드 캐싱은 세션 만료 처리가 필요함

