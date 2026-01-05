# Admin Plan Management 성능 최적화 검토

## 검토 일시
2026-01-05

## 현재 상태 요약

### 잘 구현된 부분

#### 1. React Query 캐싱 전략
- **staleTime/gcTime 설정**: `CACHE_STALE_TIME_DYNAMIC` (1분), `CACHE_GC_TIME_DYNAMIC` (10분) 적용
- **쿼리 키 팩토리**: `adminDockKeys`로 체계적인 캐시 무효화 지원
- **위치**: `lib/query-options/adminDock.ts`

```typescript
// 예시: Daily Plans 쿼리 옵션
export function dailyPlansQueryOptions(studentId: string, date: string) {
  return queryOptions({
    queryKey: adminDockKeys.daily(studentId, date),
    staleTime: CACHE_STALE_TIME_DYNAMIC,  // 1분
    gcTime: CACHE_GC_TIME_DYNAMIC,        // 10분
  });
}
```

#### 2. 메모이제이션 적용
- **useMemo/useCallback**: 24개 파일에서 적극 활용
- **주요 적용 컴포넌트**:
  - `AdminPlanManagement.tsx`
  - `DailyDock.tsx`, `WeeklyDock.tsx`, `UnfinishedDock.tsx`
  - `DeletedPlansView.tsx`
  - Admin Wizard 관련 컴포넌트들

#### 3. 동적 임포트 (Code Splitting)
- **모달 컴포넌트**: `dynamic()` 사용으로 번들 분리
- **적용된 모달들**:
  - QuickPlanModal
  - ContentAddModal
  - EditPlanModal
  - CopyPlanModal
  - MoveToGroupModal
  - StatusChangeModal
  - BulkEditModal
  - ReorderPlansModal

```typescript
const EditPlanModal = dynamic(
  () => import('./modals/EditPlanModal').then(mod => ({ default: mod.EditPlanModal })),
  { ssr: false }
);
```

#### 4. 낙관적 업데이트 (Optimistic Update)
- **useTransition** 사용으로 UI 블로킹 방지
- **위치**: `PlanItemCard.tsx` 등

---

### 개선 가능한 부분

#### 1. PlanItemCard React.memo 미적용
**현재 상태**: PlanItemCard에 React.memo가 없음

**영향**:
- 부모 리렌더링 시 모든 플랜 카드가 재렌더링
- 플랜이 많을 경우 (50개+) 성능 저하 가능

**권장 조치**:
```typescript
import { memo } from 'react';

export const PlanItemCard = memo(function PlanItemCard({
  plan,
  container,
  // ... props
}: PlanItemCardProps) {
  // ...
});
```

**우선순위**: 중간 (현재 플랜 수가 적은 경우 영향 미미)

---

#### 2. 콜백 함수 참조 안정성
**현재 상태**: Dock 컴포넌트에서 인라인 함수 전달

```typescript
// 예시 (현재)
<PlanItemCard
  onRefresh={() => refetch()}
  onDelete={(id) => handleDelete(id)}
/>
```

**권장 조치**: useCallback으로 안정적인 참조 유지
```typescript
const handleRefresh = useCallback(() => {
  refetch();
}, [refetch]);

<PlanItemCard onRefresh={handleRefresh} />
```

**우선순위**: 낮음 (React.memo 적용 후 효과적)

---

#### 3. 가상화(Virtualization) 미적용
**현재 상태**: 플랜 목록을 모두 렌더링

**영향**: 플랜이 100개 이상일 경우 초기 렌더링 지연

**권장 조치**: react-window 또는 @tanstack/virtual 도입
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={plans.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <PlanItemCard plan={plans[index]} />
    </div>
  )}
</FixedSizeList>
```

**우선순위**: 낮음 (대부분 사용자의 플랜 수 < 50개)

---

#### 4. 이미지/아이콘 최적화
**현재 상태**: Lucide 아이콘 직접 임포트

**영향**: 번들 크기 약간 증가

**권장 조치**: 아이콘 트리셰이킹 확인
```typescript
// 현재 (OK)
import { MoreVertical, Calendar, Edit3 } from 'lucide-react';

// 번들 분석으로 실제 포함된 아이콘 확인 필요
```

**우선순위**: 낮음 (Lucide는 기본적으로 트리셰이킹 지원)

---

## 측정 지표

### 권장 모니터링 항목

1. **First Contentful Paint (FCP)**: < 1.8초
2. **Largest Contentful Paint (LCP)**: < 2.5초
3. **Time to Interactive (TTI)**: < 3.5초
4. **Cumulative Layout Shift (CLS)**: < 0.1

### 측정 방법
```bash
# Lighthouse 실행
pnpm build && pnpm start
# Chrome DevTools > Lighthouse 탭에서 Performance 측정
```

---

## 결론

### 현재 성능 상태: 양호 (Good)

**근거**:
1. React Query 캐싱 전략 적절히 구성됨
2. 코드 스플리팅으로 초기 로드 최적화
3. 메모이제이션 적극 활용 중

### 권장 개선 순서

| 순위 | 항목 | 예상 효과 | 소요 시간 |
|------|------|----------|----------|
| 1 | PlanItemCard React.memo | 재렌더링 감소 | 30분 |
| 2 | 콜백 함수 안정화 | memo 효과 극대화 | 1시간 |
| 3 | 가상화 도입 | 대량 데이터 처리 | 2시간 |

### 즉시 조치 불필요

현재 구현으로 일반적인 사용 패턴에서 충분한 성능을 제공합니다.
플랜 수가 100개를 초과하는 사용자가 증가할 경우 가상화 도입을 검토하세요.

---

**작성자**: Claude Code
**검토 범위**: `app/(admin)/admin/students/[id]/plans/_components/`
