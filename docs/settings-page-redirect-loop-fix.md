# Settings 페이지 리다이렉트 루프 수정

## 문제 상황

학생 페이지에서 마이페이지(`/settings`)로 이동할 때 대시보드로 이동되는 무한 루프가 발생했습니다.

## 원인 분석

`app/(student)/settings/page.tsx`에서 `getCurrentStudent()`가 `null`을 반환할 때 `/login`으로 리다이렉트하는 로직이 있었습니다. 하지만 이미 로그인된 학생의 경우:

1. `/settings`로 이동 시도
2. `getCurrentStudent()`가 `null` 반환 (학생 정보가 없는 경우)
3. `/login`으로 리다이렉트
4. `/login` 페이지에서 이미 로그인된 사용자로 인식하여 `/dashboard`로 리다이렉트
5. 다시 `/settings`로 이동 시도하면 1번부터 반복

이런 무한 루프가 발생했습니다.

## 해결 방법

`getCurrentStudent()`가 `null`을 반환할 때 `/login` 대신 `/student-setup`으로 리다이렉트하도록 변경했습니다.

### 변경 내용

```typescript
// 변경 전
const studentData = await getCurrentStudent();
if (!studentData) {
  router.push("/login");
  return;
}

// 변경 후
if (!user) {
  router.push("/login");
  return;
}

const studentData = await getCurrentStudent();
if (!studentData) {
  // 학생 정보가 없으면 학생 설정 페이지로 이동
  router.push("/student-setup");
  return;
}
```

### 개선 사항

1. **사용자 인증 확인 분리**: 먼저 `user`가 있는지 확인하고, 없으면 `/login`으로 이동
2. **학생 정보 없음 처리**: `getCurrentStudent()`가 `null`을 반환하면 `/student-setup`으로 이동하여 학생 정보를 설정할 수 있도록 함
3. **루프 방지**: 이미 로그인된 사용자가 학생 정보가 없을 때 적절한 페이지로 이동하여 루프를 방지

## 수정된 파일

- `app/(student)/settings/page.tsx`

## 테스트 시나리오

1. ✅ 정상적인 학생이 마이페이지로 이동 → 정상 작동
2. ✅ 학생 정보가 없는 사용자가 마이페이지로 이동 → `/student-setup`으로 이동
3. ✅ 로그인하지 않은 사용자가 마이페이지로 이동 → `/login`으로 이동
4. ✅ 마이페이지에서 대시보드로 이동하는 루프 발생하지 않음

## 관련 이슈

- 학생 페이지에서 마이페이지 이동시 대시보드로 이동되는 루프 문제

