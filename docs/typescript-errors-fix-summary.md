# TypeScript 오류 수정 요약

## 📋 작업 개요

PWA 구현 후 발생한 TypeScript 오류들을 수정했습니다.

## ✅ 수정 완료된 항목

### 1. PWA 관련 오류
- ✅ `next.config.ts`: next-pwa 타입 선언 추가 (`types/next-pwa.d.ts`)
- ✅ `app/offline/page.tsx`: Button variant 타입 수정 (`default` → `primary`)
- ✅ `components/ui/InstallButton.tsx`: ButtonVariant 타입 사용

### 2. withErrorHandling 사용 방식 수정
- ✅ `app/(admin)/actions/attendanceActions.ts`: 모든 함수에 `handler()` 호출 추가
- ✅ `app/(student)/actions/attendanceActions.ts`: `withErrorHandling` import 추가 및 사용 방식 수정
- ✅ `app/actions/smsActions.ts`: `withErrorHandling` 사용 방식 수정

### 3. 타입 정의 및 Import 추가
- ✅ `app/(admin)/admin/attendance/page.tsx`: `AttendanceRecord` 타입 import 추가
- ✅ `app/(admin)/admin/sms/page.tsx`: 필요한 import 및 타입 정의 추가
  - `createSupabaseServerClient`, `getTenantContext` import
  - `SMSLogRow`, `StudentRow` 타입 정의
  - `SMSSendForm`, `Link`, `EmptyState` import
  - `searchParams` 파라미터 추가

### 4. 기타 수정
- ✅ `app/actions/smsActions.ts`: `studentsWithPhones` 정의 추가
- ✅ `app/(admin)/admin/students/[id]/_components/PlanListSectionSkeleton.tsx`: import 오타 수정

## 🔧 주요 변경사항

### withErrorHandling 사용 패턴

**이전 (잘못된 사용):**
```typescript
export async function myAction() {
  return withErrorHandling(async () => {
    // ...
    return { success: true };
  });
}
```

**수정 후 (올바른 사용):**
```typescript
export async function myAction() {
  const handler = withErrorHandling(async () => {
    // ...
    return { success: true };
  });
  return await handler();
}
```

### studentsWithPhones 정의 추가

`app/actions/smsActions.ts`에서 학생 프로필 정보를 병합하는 로직 추가:

```typescript
// student_profiles 테이블에서 phone 정보 조회
const profiles = await supabase
  .from("student_profiles")
  .select("id, phone, mother_phone, father_phone")
  .in("id", studentIds);

// 프로필 정보를 학생 정보와 병합
const studentsWithPhones = students.map((s) => {
  const profile = profiles.find((p) => p.id === s.id);
  return {
    ...s,
    phone: profile?.phone ?? null,
    mother_phone: profile?.mother_phone ?? s.mother_phone ?? null,
    father_phone: profile?.father_phone ?? s.father_phone ?? null,
  };
});
```

## ⚠️ 남은 오류 (약 30개)

대부분 null 체크 및 타입 단언 관련 오류입니다:

1. **Null 체크 필요**: `error`, `studentsError`, `tenantContext` 등
2. **타입 단언 필요**: 일부 `any` 타입 사용 부분
3. **Optional 체이닝**: `?.` 연산자 추가 필요

이러한 오류들은 프로젝트 전체에 걸쳐 있는 기존 문제들로, 점진적으로 수정할 수 있습니다.

## 📝 다음 단계

1. **Null 체크 추가**: Optional chaining (`?.`) 및 nullish coalescing (`??`) 사용
2. **타입 단언 개선**: `any` 타입을 구체적인 타입으로 변경
3. **에러 처리 개선**: 에러 객체의 타입 안전성 향상

## 🔗 관련 파일

- `app/(admin)/actions/attendanceActions.ts`
- `app/(student)/actions/attendanceActions.ts`
- `app/actions/smsActions.ts`
- `app/(admin)/admin/sms/page.tsx`
- `app/(admin)/admin/attendance/page.tsx`
- `types/next-pwa.d.ts`

---

**마지막 업데이트**: 2025년 1월

