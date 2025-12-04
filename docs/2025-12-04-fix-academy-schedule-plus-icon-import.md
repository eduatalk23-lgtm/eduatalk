# AcademyScheduleManagement Plus 아이콘 import 누락 수정

## 작업 일시
2025-12-04

## 문제 상황
`AcademyScheduleManagement` 컴포넌트에서 `Plus` 아이콘을 사용하고 있으나 import되지 않아 런타임 에러 발생

### 에러 메시지
```
Runtime ReferenceError: Plus is not defined
at AcademyScheduleManagement (app/(student)/blocks/_components/AcademyScheduleManagement.tsx:516:18)
```

## 원인
- 14번째 줄에서 `lucide-react`에서 `Trash2, Pencil, X`만 import하고 있었음
- 516번째 줄에서 `<Plus className="h-4 w-4" />`를 사용하고 있었으나 import 누락

## 수정 내용
`AcademyScheduleManagement.tsx` 파일의 import 문에 `Plus` 아이콘 추가

### 변경 전
```typescript
import { Trash2, Pencil, X } from "lucide-react";
```

### 변경 후
```typescript
import { Trash2, Pencil, X, Plus } from "lucide-react";
```

## 수정 파일
- `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`

## 검증
- 린터 에러 없음 확인
- 런타임 에러 해결

