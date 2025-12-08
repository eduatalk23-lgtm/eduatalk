# parent_contact 컬럼 에러 수정

## 문제 상황

SMS API 호출 시 다음과 같은 데이터베이스 에러가 발생했습니다:

```
[SMS API] 학생 정보 조회 실패: {
  code: '42703',
  details: null,
  hint: null,
  message: 'column students.parent_contact does not exist'
}
```

## 원인 분석

1. **ERD와 실제 스키마 불일치**: ERD 문서(`timetable/erd-cloud/`)에는 `parent_contact` 컬럼이 정의되어 있지만, 실제 데이터베이스에는 존재하지 않습니다.

2. **실제 스키마 구조**: 실제로는 `mother_phone`, `father_phone`으로 분리되어 있으며, `student_profiles` 테이블에도 동일한 필드가 있습니다.

3. **코드에서의 사용**: 여러 파일에서 존재하지 않는 `parent_contact` 컬럼을 조회하려고 시도했습니다.

## 수정 내용

### 1. `app/api/purio/send/route.ts`

**수정 전:**
```typescript
.select("id, name, parent_contact")
```

**수정 후:**
```typescript
.select("id, name")
```

`parent_contact`는 조회하지 않고, `student_profiles` 테이블에서 `mother_phone`, `father_phone`을 조회하도록 이미 구현되어 있었습니다.

### 2. `app/actions/smsActions.ts`

**수정 전:**
```typescript
.select("id, name, parent_contact")
// ...
const recipients = students
  .map((student) => {
    const parentContact = student.mother_phone || student.father_phone;
    return { ...student, parent_contact: parentContact };
  })
```

**수정 후:**
```typescript
.select("id, name")
// ...
const recipients = studentsWithPhones
  .map((student) => {
    const parentContact = student.mother_phone || student.father_phone;
    return { ...student, selectedPhone: parentContact };
  })
```

- `parent_contact` 조회 제거
- `studentsWithPhones` 사용 (이미 `student_profiles`와 병합된 데이터)
- `parent_contact` 대신 `selectedPhone` 사용

### 3. `app/(admin)/actions/attendanceActions.ts`

**수정 전:**
```typescript
.select("id, name, parent_contact")
// ...
if (student?.parent_contact && tenant?.name) {
```

**수정 후:**
```typescript
.select("id, name, mother_phone, father_phone")
// student_profiles에서도 조회 시도
// ...
const hasParentContact = 
  profile?.mother_phone || 
  profile?.father_phone || 
  student?.mother_phone || 
  student?.father_phone;

if (hasParentContact && tenant?.name) {
```

- `parent_contact` 대신 `mother_phone`, `father_phone` 조회
- `student_profiles` 테이블에서도 전화번호 조회 시도
- 연락처 존재 여부 확인 로직 개선

### 4. `app/(admin)/admin/sms/_components/SMSPreviewModal.tsx`

**수정 전:**
```typescript
type Student = {
  id: string;
  name: string | null;
  parent_contact: string | null;
};
// ...
{student.parent_contact}
```

**수정 후:**
```typescript
type Student = {
  id: string;
  name: string | null;
  phone?: string | null;
  mother_phone?: string | null;
  father_phone?: string | null;
};
// ...
{student.mother_phone || student.father_phone || student.phone || "연락처 없음"}
```

- 타입 정의를 실제 데이터 구조에 맞게 수정
- 표시 로직을 `mother_phone` → `father_phone` → `phone` 순서로 fallback

## 영향 범위

다음 기능들이 정상 작동합니다:
- ✅ SMS 일괄 발송 (`/api/purio/send`)
- ✅ 출석 SMS 자동 발송 (`app/(admin)/actions/attendanceActions.ts`)
- ✅ SMS 발송 미리보기 모달
- ✅ SMS 액션 함수들 (`app/actions/smsActions.ts`)

## 데이터 구조

### students 테이블
- `mother_phone`: 어머니 전화번호 (nullable)
- `father_phone`: 아버지 전화번호 (nullable)

### student_profiles 테이블 (선택사항)
- `phone`: 학생 본인 전화번호 (nullable)
- `mother_phone`: 어머니 전화번호 (nullable)
- `father_phone`: 아버지 전화번호 (nullable)

**우선순위**: `student_profiles`의 값이 있으면 우선 사용, 없으면 `students` 테이블의 값 사용

## 참고 사항

1. **ERD 문서 업데이트 필요**: `timetable/erd-cloud/`의 ERD 문서는 실제 스키마와 다르므로, 향후 업데이트가 필요합니다.

2. **마이그레이션 고려**: 만약 `parent_contact` 컬럼을 추가하려면 마이그레이션을 작성해야 하지만, 현재는 `mother_phone`, `father_phone` 분리 구조가 더 적절합니다.

3. **하위 호환성**: 기존 코드에서 `parent_contact`를 사용하던 부분은 모두 수정되었습니다.

