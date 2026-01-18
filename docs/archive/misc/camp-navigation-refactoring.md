# 캠프 모드 네비게이션 리팩토링

## 🎯 목표

캠프 모드(`/camp/today`)와 일반 모드(`/today`)에서 플랜 상세/완료 후 이동 경로가 일관되게 동작하도록 네비게이션을 정리했습니다.

## ✅ 완료된 작업

### 1. ActiveLearningWidget.tsx 수정

**파일**: `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`

**변경 사항**:

- `campMode?: boolean` prop 추가 (기본값: `false`)
- `buildPlanExecutionUrl` 헬퍼 함수 사용
- "상세보기" 링크가 캠프 모드에 따라 올바른 URL로 이동

**변경 전**:

```tsx
<Link href={`/today/plan/${activePlan.id}`}>상세보기</Link>
```

**변경 후**:

```tsx
import { buildPlanExecutionUrl } from "@/app/(student)/today/_utils/navigationUtils";

<Link href={buildPlanExecutionUrl(activePlan.id, campMode)}>상세보기</Link>;
```

### 2. CompletionToast.tsx 수정

**파일**: `app/(student)/today/_components/CompletionToast.tsx`

**변경 사항**:

- `usePathname` 훅 사용하여 현재 경로 감지
- 캠프 모드(`/camp/today`)와 일반 모드(`/today`) 자동 분기
- 완료 후 URL 정리 시 현재 모드 유지

**변경 전**:

```tsx
const newUrl = newSearch ? `/today?${newSearch}` : "/today";
router.replace(newUrl, { scroll: false });
```

**변경 후**:

```tsx
import { usePathname } from "next/navigation";

const pathname = usePathname();
const isCampMode = pathname?.startsWith("/camp/today");
const basePath = isCampMode ? "/camp/today" : "/today";

const newUrl = newSearch ? `${basePath}?${newSearch}` : basePath;
router.replace(newUrl, { scroll: false });
```

### 3. TodayPlanItem.tsx 수정

**파일**: `app/(student)/today/_components/TodayPlanItem.tsx`

**변경 사항**:

- `campMode?: boolean` prop 추가 (기본값: `false`)
- `buildPlanExecutionUrl` 헬퍼 함수 사용
- 플랜 상세 링크가 캠프 모드에 따라 올바른 URL로 이동

**변경 전**:

```tsx
<Link href={`/today/plan/${plan.id}`}>
  {status === "completed" ? "보기" : "시작하기"}
</Link>
```

**변경 후**:

```tsx
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";

<Link href={buildPlanExecutionUrl(plan.id, campMode)}>
  {status === "completed" ? "보기" : "시작하기"}
</Link>;
```

### 4. 상위 컴포넌트 수정

#### CurrentLearningSection.tsx

**파일**: `app/(student)/today/_components/CurrentLearningSection.tsx`

**변경 사항**:

- `campMode?: boolean` prop 추가
- `ActiveLearningWidget`에 `campMode` 전달

**사용처**:

- `/today` 페이지: `campMode` 전달 안 함 (기본값 `false`)
- `/camp/today` 페이지: `campMode={true}` 전달

#### DraggablePlanList.tsx

**파일**: `app/(student)/today/_components/DraggablePlanList.tsx`

**변경 사항**:

- `campMode?: boolean` prop 추가
- `TodayPlanItem`에 `campMode` 전달
- `PlanTimerCard`에 `campMode` 전달

## 📊 수정 통계

| 파일                         | 수정 내용                                      | 상태 |
| ---------------------------- | ---------------------------------------------- | ---- |
| `ActiveLearningWidget.tsx`   | campMode prop 추가, buildPlanExecutionUrl 사용 | ✅   |
| `CompletionToast.tsx`        | usePathname으로 경로 감지, 모드별 분기         | ✅   |
| `TodayPlanItem.tsx`          | campMode prop 추가, buildPlanExecutionUrl 사용 | ✅   |
| `CurrentLearningSection.tsx` | campMode prop 추가 및 전달                     | ✅   |
| `DraggablePlanList.tsx`      | campMode prop 추가 및 전달                     | ✅   |
| `/camp/today/page.tsx`       | CurrentLearningSection에 campMode={true} 전달  | ✅   |

## 🔍 검증 결과

### 하드코딩된 경로 확인

- ✅ `/today/plan/${...}` 하드코딩 제거 완료
- ✅ `?mode=camp` 하드코딩 제거 완료
- ✅ 모든 플랜 실행 페이지 이동이 `buildPlanExecutionUrl` 사용

### 네비게이션 플로우

#### 일반 모드 (`/today`)

1. 플랜 완료 → `/today/plan/[id]` (모드 파라미터 없음)
2. 완료 후 → `/today?completedPlanId=...&date=...`
3. `CompletionToast`가 `/today?date=...`로 정리

#### 캠프 모드 (`/camp/today`)

1. 플랜 완료 → `/today/plan/[id]?mode=camp`
2. 완료 후 → `/camp/today?completedPlanId=...&date=...`
3. `CompletionToast`가 `/camp/today?date=...`로 정리

## 🎉 개선 효과

1. **일관된 네비게이션**: 캠프 모드와 일반 모드 간 일관된 동작
2. **코드 중복 제거**: `buildPlanExecutionUrl` 헬퍼 함수로 중복 제거
3. **유지보수성 향상**: 경로 변경 시 한 곳만 수정하면 됨
4. **타입 안전성**: TypeScript로 타입 안전성 보장

## 📝 참고 사항

- 모든 컴포넌트에서 `campMode` prop의 기본값은 `false`
- `/today` 페이지에서는 `campMode`를 전달하지 않아도 됨 (기본값 사용)
- `/camp/today` 페이지에서는 명시적으로 `campMode={true}` 전달 필요

---

**수정 날짜**: 2025년 1월 27일  
**상태**: ✅ 완료
