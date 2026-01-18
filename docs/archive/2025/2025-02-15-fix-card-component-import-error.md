# Card 컴포넌트 Import 에러 수정

## 문제 상황

빌드 시 다음과 같은 에러가 발생했습니다:

```
Module not found: Can't resolve '@/components/ui/Card'
```

**에러 위치**: `app/(admin)/admin/camp-templates/[id]/attendance/_components/CampAttendanceStatsCards.tsx`

## 원인 분석

1. 여러 파일에서 `@/components/ui/Card`를 import하고 있었지만, 실제로는 `Card` 컴포넌트가 `components/molecules/Card.tsx`에만 존재했습니다.
2. `components/ui/Card.tsx` 파일이 없어서 빌드 에러가 발생했습니다.

## 해결 방법

`components/ui/Card.tsx` 파일을 생성하여 `components/molecules/Card`의 모든 export를 re-export하도록 했습니다.

### 생성된 파일

```typescript:components/ui/Card.tsx
// Re-export Card components from molecules for UI consistency
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  type CardProps,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps,
  type CardElevation,
} from "@/components/molecules/Card";
```

## 영향받는 파일

다음 파일들이 `@/components/ui/Card`를 import하고 있었습니다:

- `app/(admin)/admin/camp-templates/[id]/attendance/_components/CampAttendanceStatsCards.tsx`
- `app/(admin)/admin/camp-templates/[id]/attendance/_components/CampParticipantAttendanceTable.tsx`
- `app/(admin)/admin/camp-templates/[id]/reports/_components/CampAttendanceReportSection.tsx`
- `app/(admin)/admin/camp-templates/[id]/reports/_components/CampLearningReportSection.tsx`
- `app/(admin)/admin/camp-templates/[id]/reports/_components/CampReportSummaryCards.tsx`

## 결과

- ✅ `@/components/ui/Card` import 경로가 정상적으로 작동합니다.
- ✅ 기존 코드 수정 없이 빌드 에러가 해결되었습니다.
- ✅ UI 컴포넌트와 molecules 컴포넌트 간의 일관성을 유지할 수 있습니다.

## 참고사항

프로젝트 내에서 Card 컴포넌트를 사용할 때는 다음 두 경로 모두 사용 가능합니다:

- `@/components/ui/Card` (권장 - UI 컴포넌트 경로)
- `@/components/molecules/Card` (기존 경로, 여전히 작동)

