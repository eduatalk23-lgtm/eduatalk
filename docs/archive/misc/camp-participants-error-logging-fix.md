# CampParticipantsList 에러 로깅 개선

## 작업 개요

`CampParticipantsList` 컴포넌트에서 `camp_invitation_id` 업데이트 실패 시 에러 로깅이 빈 객체로 표시되는 문제를 수정했습니다.

## 문제 분석

에러 로깅 시 `updateError.message`만 사용하고 있어서:
- `updateError.message`가 `undefined`인 경우 빈 객체 `{}`로 표시됨
- 에러의 전체 정보를 확인할 수 없음
- 디버깅이 어려움

## 해결 방안

에러 로깅을 개선하여:
1. `updateError.message`가 없을 경우 `updateError.toString()` 사용
2. `errorCode`, `errorDetails` 등 추가 정보 포함
3. `fullError`로 전체 에러 객체 포함

## 수정 내용

### 파일: `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx`

#### 1. 방법 2 에러 로깅 개선 (213번 줄)

**변경 전:**
```typescript
if (updateError) {
  console.error(
    "[CampParticipantsList] camp_invitation_id 업데이트 실패 (방법 2):",
    {
      groupId,
      invitationId,
      error: updateError.message,
    }
  );
}
```

**변경 후:**
```typescript
if (updateError) {
  console.error(
    "[CampParticipantsList] camp_invitation_id 업데이트 실패 (방법 2):",
    {
      groupId,
      invitationId,
      error: updateError.message || updateError.toString(),
      errorCode: updateError.code,
      errorDetails: updateError.details,
      fullError: updateError,
    }
  );
}
```

#### 2. 일반 에러 로깅 개선 (353번 줄)

**변경 전:**
```typescript
if (updateError) {
  console.error(
    "[CampParticipantsList] camp_invitation_id 업데이트 실패:",
    {
      planGroupId: planGroup.id,
      invitationId: invitation.id,
      studentId: invitation.student_id,
      error: updateError.message,
      errorCode: updateError.code,
    }
  );
}
```

**변경 후:**
```typescript
if (updateError) {
  console.error(
    "[CampParticipantsList] camp_invitation_id 업데이트 실패:",
    {
      planGroupId: planGroup.id,
      invitationId: invitation.id,
      studentId: invitation.student_id,
      error: updateError.message || updateError.toString(),
      errorCode: updateError.code,
      errorDetails: updateError.details,
      fullError: updateError,
    }
  );
}
```

## 주요 변경사항

1. **에러 메시지 안전 추출**
   - `updateError.message || updateError.toString()` 사용
   - `message`가 없어도 에러 정보 표시

2. **추가 에러 정보 포함**
   - `errorCode`: Supabase 에러 코드
   - `errorDetails`: 상세 에러 정보
   - `fullError`: 전체 에러 객체

3. **디버깅 개선**
   - 에러의 전체 정보를 확인할 수 있어 디버깅이 쉬워짐

## 테스트 시나리오

1. ✅ `camp_invitation_id` 업데이트 실패 시 에러 로깅 확인
2. ✅ 에러 메시지가 빈 객체가 아닌 실제 에러 정보로 표시되는지 확인
3. ✅ `errorCode`, `errorDetails`, `fullError` 정보가 포함되는지 확인

## 관련 파일

- `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx` - 에러 로깅 개선

## 작업 일시

2025-01-XX

