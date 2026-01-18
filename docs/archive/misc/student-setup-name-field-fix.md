# Student Setup 이름 필드 누락 오류 수정

## 작업 일시
2025-01-XX

## 문제 상황
학생 정보 설정 페이지에서 이름을 입력하고 저장할 때, 데이터베이스의 `students` 테이블에 `name` 필드가 null로 저장되어 NOT NULL 제약 조건을 위반하는 오류가 발생했습니다.

## 오류 메시지
```
Runtime Error
null value in column "name" of relation "students" violates not-null constraint
at saveStudentInfo (app/(student)/actions/studentActions.ts:38:11)
```

## 원인 분석
`saveStudentInfo` 함수에서:
1. FormData에서 `name` 필드를 읽어와서 검증하고 있었습니다 (line 20, 25-27)
2. 하지만 `upsertStudent` 함수 호출 시 `name` 파라미터를 전달하지 않았습니다
3. `upsertStudent` 함수는 name이 없으면 기존 값을 조회하려고 하지만, 첫 생성 시에는 기존 값이 없어서 null이 됩니다
4. 데이터베이스 스키마에서 `name` 필드가 NOT NULL 제약 조건이 있어서 오류 발생

## 해결 방법
1. `upsertStudent` 호출 시 `name` 파라미터 추가
2. 일관성을 위해 이름을 user_metadata에도 저장하도록 추가 (`updateStudentProfile`과 동일한 패턴)

### 수정 내용

**수정 전:**
```typescript
const result = await upsertStudent({
  id: user.id,
  tenant_id: null,
  grade,
  class: klass,
  birth_date: birthDate,
  // name이 누락됨
});
```

**수정 후:**
```typescript
// 이름을 user_metadata에도 저장
if (name && name !== user.user_metadata?.display_name) {
  const { error: updateError } = await supabase.auth.updateUser({
    data: { display_name: name },
  });
  if (updateError) {
    console.error("이름 업데이트 실패:", updateError);
  }
}

const result = await upsertStudent({
  id: user.id,
  tenant_id: null,
  name, // name 추가
  grade,
  class: klass,
  birth_date: birthDate,
});
```

## 변경 파일
- `app/(student)/actions/studentActions.ts`: 
  - `upsertStudent` 호출 시 `name` 파라미터 추가
  - 이름을 user_metadata에도 저장하는 로직 추가

## 검증
- [x] Linter 오류 없음 확인
- [x] `name` 필드가 올바르게 전달되는지 확인

## 참고
- `updateStudentProfile` 함수와 동일한 패턴으로 user_metadata에도 이름을 저장하여 일관성 유지
- 이름 업데이트 실패는 치명적이지 않으므로 계속 진행

