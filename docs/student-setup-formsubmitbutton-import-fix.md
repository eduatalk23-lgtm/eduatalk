# Student Setup FormSubmitButton Import 오류 수정

## 작업 일시
2025-01-XX

## 문제 상황
`app/student-setup/page.tsx`에서 `FormSubmitButton` 컴포넌트를 사용하고 있었지만 import 문이 누락되어 런타임 ReferenceError가 발생했습니다.

## 오류 메시지
```
Runtime ReferenceError
FormSubmitButton is not defined
at StudentSetupPage (app/student-setup/page.tsx:61:10)
```

## 원인
- `FormSubmitButton` 컴포넌트를 사용했지만 import 문이 없었습니다.
- `components/ui/FormSubmitButton.tsx` 파일은 존재하지만, `app/student-setup/page.tsx`에서 import하지 않았습니다.

## 해결 방법
`app/student-setup/page.tsx`에 `FormSubmitButton` import를 추가했습니다.

### 수정 내용

**수정 전:**
```typescript
import { redirect } from "next/navigation";
import { saveStudentInfo } from "@/app/actions/student";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FormInput from "@/components/ui/FormInput";
```

**수정 후:**
```typescript
import { redirect } from "next/navigation";
import { saveStudentInfo } from "@/app/actions/student";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FormInput from "@/components/ui/FormInput";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
```

## 변경 파일
- `app/student-setup/page.tsx`: `FormSubmitButton` import 추가

## 검증
- [x] Linter 오류 없음 확인
- [x] Import 문 정상 작동 확인

## 참고
- `FormSubmitButton`은 `"use client"` 컴포넌트로, 서버 컴포넌트에서 클라이언트 컴포넌트를 사용하는 일반적인 패턴입니다.

