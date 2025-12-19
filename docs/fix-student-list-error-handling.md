# 학생 목록 조회 에러 처리 개선

## 작업 일시
2024-12-15

## 문제 상황
- `StudentInvitationForm` 컴포넌트에서 학생 목록 조회 시 에러가 발생
- 에러 메시지: "학생 목록 조회 실패: {}"
- 에러 객체가 빈 객체로 출력되어 실제 에러 원인 파악 불가

## 원인 분석
1. Supabase 에러 객체가 제대로 직렬화되지 않아 빈 객체로 출력됨
2. 에러 객체의 세부 정보(message, code, details, hint)를 확인하지 않음
3. 데이터가 null인 경우에 대한 처리 부재

## 해결 방법

### 1. 에러 객체 세부 정보 로깅 개선
- 에러 객체의 모든 속성(message, code, details, hint)을 명시적으로 추출하여 로깅
- 에러 객체 자체도 포함하여 디버깅 용이성 향상

```typescript
const errorDetails = {
  message: studentsError.message,
  code: studentsError.code,
  details: studentsError.details,
  hint: studentsError.hint,
  error: studentsError,
};
console.error("학생 목록 조회 실패:", errorDetails);
```

### 2. 에러 메시지 개선
- 에러 메시지가 있는 경우 사용자에게 구체적인 에러 내용 표시
- 에러 메시지가 없는 경우 기본 메시지 표시

```typescript
toast.showError(
  studentsError.message 
    ? `학생 목록을 불러오는데 실패했습니다: ${studentsError.message}`
    : "학생 목록을 불러오는데 실패했습니다."
);
```

### 3. null 데이터 체크 추가
- Supabase는 에러가 없어도 data가 null일 수 있음
- null인 경우 빈 배열로 처리하여 컴포넌트가 정상 동작하도록 함

```typescript
if (allStudents === null) {
  console.warn("학생 목록이 null로 반환되었습니다.");
  setStudents([]);
  setLoading(false);
  return;
}
```

### 4. 초대 목록 조회 에러 처리도 동일하게 개선
- 일관된 에러 처리 패턴 적용

## 수정된 파일
- `app/(admin)/admin/camp-templates/[id]/StudentInvitationForm.tsx`

## 개선 효과
1. 에러 발생 시 실제 원인을 파악할 수 있는 상세 정보 제공
2. 사용자에게 더 명확한 에러 메시지 표시
3. null 데이터에 대한 안전한 처리
4. 디버깅 용이성 향상

## 향후 개선 사항
- RLS 정책 확인 및 권한 문제 해결
- 네트워크 에러 처리 강화
- 재시도 로직 추가 고려

