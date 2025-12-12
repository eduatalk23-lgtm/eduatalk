# Label Import 에러 수정

## 작업 일시
2025년 2월 3일

## 문제 상황

빌드 에러 발생:
```
Export Label doesn't exist in target module
./app/(admin)/admin/attendance/[id]/edit/_components/EditAttendanceRecordForm.tsx:9:1
```

## 원인 분석

`EditAttendanceRecordForm.tsx` 파일에서 `Label` 컴포넌트를 named import로 사용하고 있었지만, 실제 `Label.tsx` 컴포넌트는 default export로 내보내지고 있었습니다.

### 문제가 있던 코드
```typescript
import { Label } from "@/components/atoms/Label"; // ❌ named import (잘못됨)
```

### 실제 컴포넌트 export 방식
```typescript
// components/atoms/Label.tsx
export default memo(Label); // default export
```

### 다른 파일들의 사용 패턴
프로젝트 내 다른 모든 파일들은 올바르게 default import를 사용하고 있었습니다:
```typescript
import Label from "@/components/atoms/Label"; // ✅ default import (올바름)
```

## 해결 방법

`EditAttendanceRecordForm.tsx` 파일의 9번째 줄 import 구문을 named import에서 default import로 변경했습니다.

### 수정 내용
```typescript
// 변경 전
import { Label } from "@/components/atoms/Label";

// 변경 후
import Label from "@/components/atoms/Label";
```

## 수정 파일

- `app/(admin)/admin/attendance/[id]/edit/_components/EditAttendanceRecordForm.tsx`

## 검증

- ✅ 린터 에러 없음 확인
- ✅ Import 구문이 다른 파일들과 일관성 있게 수정됨
- ✅ 컴포넌트 사용 방식 변경 없음 (import 방식만 수정)

## 참고사항

이 에러는 단순한 import 방식 불일치로 인한 것이었으며, 컴포넌트 자체의 기능에는 문제가 없었습니다. 프로젝트 전반에서 default export를 사용하는 패턴을 따르도록 수정했습니다.

