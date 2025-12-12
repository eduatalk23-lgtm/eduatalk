# Server Action 빌드 에러 수정

**작업 일자**: 2025-01-15  
**관련 이슈**: Vercel 빌드 실패 - Server Actions 파일에 동기 함수 포함

## 문제 상황

Vercel 빌드 중 다음 에러가 발생했습니다:

```
Error: Turbopack build failed with 1 errors:
./app/(admin)/actions/smsLogActions.ts:201:17
Server Actions must be async functions.
```

### 원인

`app/(admin)/actions/smsLogActions.ts` 파일에 `"use server"` 지시어가 있어 Server Actions 파일로 인식되는데, 이 파일에 동기 함수 `maskPhoneNumber`가 포함되어 있었습니다. Next.js는 Server Actions 파일의 모든 export된 함수가 async여야 한다고 요구합니다.

## 해결 방안

`maskPhoneNumber`는 순수 유틸리티 함수이므로:
1. Server Actions 파일에서 제거
2. 클라이언트/서버 모두에서 사용 가능한 별도의 유틸리티 파일로 분리

## 수정 내용

### 1. 새 유틸리티 파일 생성

**파일**: `lib/utils/phoneMasking.ts`

전화번호 마스킹 전용 유틸리티 파일을 생성하여 클라이언트와 서버 모두에서 사용할 수 있도록 했습니다.

```typescript
/**
 * 전화번호 마스킹 처리
 * 앞 3자리와 뒤 4자리만 표시, 중간은 마스킹
 * 
 * @param phone - 마스킹할 전화번호
 * @returns 마스킹된 전화번호 (예: "010-****-1234")
 */
export function maskPhoneNumber(phone: string): string {
  // ... 구현 내용
}
```

### 2. Server Actions 파일에서 함수 제거

**파일**: `app/(admin)/actions/smsLogActions.ts`

- 198-219번째 줄의 `maskPhoneNumber` 함수와 주석 제거
- Server Actions 파일에는 async 함수만 남김

### 3. Import 경로 수정

**파일**: `app/(admin)/admin/attendance/sms-logs/_components/SMSLogsTable.tsx`

```typescript
// 변경 전
import { maskPhoneNumber } from "@/app/(admin)/actions/smsLogActions";

// 변경 후
import { maskPhoneNumber } from "@/lib/utils/phoneMasking";
```

### 4. 추가 수정 사항

초기에는 `lib/utils/studentPhoneUtils.ts`에 함수를 추가했으나, 해당 파일이 서버 전용 모듈(`createSupabaseServerClient`)을 import하고 있어 클라이언트 컴포넌트에서 사용할 수 없었습니다. 따라서 별도의 독립적인 유틸리티 파일(`phoneMasking.ts`)을 생성했습니다.

## 검증 결과

- ✅ 빌드 테스트: `pnpm run build` 성공
- ✅ 타입 체크: TypeScript 컴파일 에러 없음
- ✅ 린터 검사: ESLint 에러 없음

## 영향 범위

- **수정 파일**: 3개
  - `lib/utils/phoneMasking.ts` (신규 생성)
  - `app/(admin)/actions/smsLogActions.ts` (함수 제거)
  - `app/(admin)/admin/attendance/sms-logs/_components/SMSLogsTable.tsx` (import 경로 수정)
- **영향받는 컴포넌트**: `SMSLogsTable` (1개)
- **기능 변경**: 없음 (함수 위치만 변경)

## 참고 사항

- Next.js Server Actions는 모든 export된 함수가 async여야 합니다
- 클라이언트 컴포넌트에서 사용하는 유틸리티 함수는 서버 전용 모듈을 import하지 않는 별도 파일로 분리해야 합니다
- 순수 유틸리티 함수는 Server Actions 파일에 포함하지 않는 것이 좋습니다

