# 마이페이지 접근 시 student-setup 리다이렉트 문제 해결

## 문제 상황

학생 영역에서 마이페이지(`/settings`)에 접근했을 때, 학생 정보가 없으면 자동으로 `/student-setup`으로 리다이렉트되는 문제가 있었습니다.

## 원인 분석

`app/(student)/settings/page.tsx`에서 학생 정보를 로드할 때:
- `getCurrentStudent()`가 `null`을 반환하면 `/student-setup`으로 리다이렉트
- 이로 인해 학생 정보가 없는 사용자는 마이페이지에 접근할 수 없었음

## 해결 방법

### 1. 마이페이지 접근 로직 개선

학생 정보가 없을 때도 마이페이지를 표시하도록 수정:

```typescript
// 변경 전
const studentData = await getCurrentStudent();
if (!studentData) {
  router.push("/student-setup");
  return;
}

// 변경 후
const studentData = await getCurrentStudent();
if (studentData) {
  setStudent(studentData);
  // ... 기존 로직
} else {
  // 학생 정보가 없으면 빈 폼으로 시작
  setStudent(null);
}
```

### 2. 저장 로직 개선

`updateStudentProfile` 함수에서 학생 정보가 없을 때 자동으로 생성하도록 수정:

```typescript
// 기존 학생 정보 조회 (없으면 새로 생성)
let existingStudent = await getStudentById(user.id);
if (!existingStudent) {
  // 학생 정보가 없으면 기본 정보로 생성
  const name = String(formData.get("name") ?? "").trim() || (user.user_metadata?.display_name as string | undefined) || "";
  const grade = String(formData.get("grade") ?? "").trim() || "";
  const birthDate = String(formData.get("birth_date") ?? "").trim() || "";
  
  if (!name || !grade || !birthDate) {
    return { success: false, error: "필수 정보(이름, 학년, 생년월일)를 입력해주세요." };
  }
  
  const createResult = await upsertStudent({
    id: user.id,
    tenant_id: null,
    name,
    grade,
    class: "",
    birth_date: birthDate,
  });
  
  // ... 생성 후 조회
}
```

### 3. 생년월일 필드 처리 개선

`birth_date`를 formData에서 직접 가져오도록 수정:

```typescript
const birthDate = String(formData.get("birth_date") ?? "").trim() || existingStudent.birth_date || "";
```

## 변경된 파일

1. `app/(student)/settings/page.tsx`
   - 학생 정보가 없을 때도 마이페이지 표시
   - 빈 폼으로 시작 가능

2. `app/(student)/actions/studentActions.ts`
   - `updateStudentProfile` 함수에서 학생 정보 자동 생성 로직 추가
   - `birth_date` 필드 처리 개선

## 효과

- ✅ 학생 정보가 없어도 마이페이지에 접근 가능
- ✅ 마이페이지에서 바로 학생 정보 입력 및 저장 가능
- ✅ `/student-setup`으로 강제 리다이렉트되지 않음
- ✅ 기존 학생 정보가 있는 경우 정상 작동

## 테스트 시나리오

1. **학생 정보가 있는 경우**
   - 마이페이지 접근 → 정상 표시
   - 정보 수정 및 저장 → 정상 작동

2. **학생 정보가 없는 경우**
   - 마이페이지 접근 → 빈 폼으로 표시
   - 정보 입력 및 저장 → 학생 정보 자동 생성 후 저장

3. **부분 정보만 있는 경우**
   - 마이페이지 접근 → 기존 정보 표시
   - 추가 정보 입력 및 저장 → 정상 작동

