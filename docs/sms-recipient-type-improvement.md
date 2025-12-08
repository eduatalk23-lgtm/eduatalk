# SMS 전송 대상자 옵션 추가 및 연락처 없이도 조회 가능하도록 개선

## 작업 개요

학부모 연락처가 없는 학생도 검색 및 조회 가능하도록 하고, 전송 대상자를 학생 본인/어머니/아버지 중 선택할 수 있도록 개선했습니다.

## 주요 변경 사항

### 1. Student 타입 확장

**파일**: `app/(admin)/admin/sms/_components/SMSSendForm.tsx`

- `phone` (학생 본인 연락처) 필드 추가
- `mother_phone`, `father_phone` 필드 추가
- `parent_contact` 필드 제거
- `RecipientType` 타입 추가: `"student" | "mother" | "father"`

### 2. student_profiles 테이블 조회 추가

**파일**: `app/(admin)/admin/sms/page.tsx`

- `student_profiles` 테이블에서 `phone`, `mother_phone`, `father_phone` 조회
- `student_profiles` 우선, 없으면 `students` 테이블의 연락처 사용
- 학생 정보와 프로필 정보 병합

```typescript
// student_profiles 테이블에서 phone 정보 조회
const { data: profiles } = await supabase
  .from("student_profiles")
  .select("id, phone, mother_phone, father_phone")
  .in("id", studentIds);

// 프로필 정보를 학생 정보와 병합
const studentsWithPhones = studentsForSMS.map((s) => {
  const profile = profiles?.find((p) => p.id === s.id);
  return {
    ...s,
    phone: profile?.phone ?? null, // student_profiles 우선
    mother_phone: profile?.mother_phone ?? s.mother_phone ?? null,
    father_phone: profile?.father_phone ?? s.father_phone ?? null,
  };
});
```

### 3. 연락처 필터 제거

**파일**: `app/(admin)/admin/sms/_components/SingleRecipientSearch.tsx`

- 연락처 필터 제거 (모든 학생 조회 가능)
- 검색 시 `phone`, `mother_phone`, `father_phone` 모두 검색 대상에 포함
- 전송 대상자에 따라 적절한 전화번호 선택하는 로직 추가

### 4. 전송 대상자 선택 옵션 추가

**파일**: `app/(admin)/admin/sms/_components/SMSSendForm.tsx`

- 단일 발송과 일괄 발송 모두에 전송 대상자 선택 옵션 추가
- 라디오 버튼으로 학생 본인/어머니/아버지 선택 가능
- 기본값: 어머니

**파일**: `app/(admin)/admin/sms/_components/SingleRecipientSearch.tsx`

- 전송 대상자 선택 드롭다운 추가
- 선택한 대상자에 따라 검색 결과에 표시되는 전화번호 변경

**파일**: `app/(admin)/admin/sms/_components/SMSRecipientSelector.tsx`

- 일괄 발송 모드에 전송 대상자 선택 드롭다운 추가
- 선택한 대상자 타입에 따라 선택 가능한 학생 필터링
- 연락처가 없는 학생은 선택 불가 (안내 메시지 표시)

### 5. SMS 발송 로직 업데이트

**파일**: `app/actions/smsActions.ts`

- `sendBulkGeneralSMS` 함수에 `recipientType` 파라미터 추가
- `student_profiles` 테이블 조회 추가
- 선택한 대상자 타입에 따라 적절한 전화번호 사용

```typescript
export async function sendBulkGeneralSMS(
  studentIds: string[],
  message: string,
  templateVariables?: Record<string, string>,
  recipientType: "student" | "mother" | "father" = "mother"
): Promise<{...}>
```

## 사용 방법

### 단일 발송 모드

1. 발송 모드에서 "단일 발송" 선택
2. 전송 대상자 선택 (학생 본인/어머니/아버지)
3. 수신자 검색에서 학생 검색
4. 검색 결과에서 학생 선택 (선택한 대상자 타입의 연락처가 자동 입력됨)
5. 메시지 작성 후 발송

### 일괄 발송 모드

1. 발송 모드에서 "일괄 발송" 선택
2. 전송 대상자 선택 (학생 본인/어머니/아버지)
3. 발송 대상자 선택에서 학생 선택
4. 선택한 대상자 타입의 연락처가 없는 학생은 선택 불가 (안내 메시지 표시)
5. 메시지 작성 후 발송

## 개선 효과

1. **유연성 향상**: 연락처가 없는 학생도 조회 가능
2. **사용자 선택권**: 학생/어머니/아버지 중 선택 가능
3. **일관성**: 단일 발송과 일괄 발송 모두 동일한 옵션 제공
4. **데이터 정확성**: `student_profiles` 우선 사용으로 최신 연락처 정보 활용

## 주의사항

- 선택한 대상자 타입의 연락처가 없는 학생은 SMS 발송 대상에서 제외됩니다
- 일괄 발송 모드에서 연락처가 없는 학생은 선택할 수 없으며, 안내 메시지가 표시됩니다
- 단일 발송 모드에서 검색 결과에 연락처가 없으면 "선택" 버튼이 비활성화됩니다

