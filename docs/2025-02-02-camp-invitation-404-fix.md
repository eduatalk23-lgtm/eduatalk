# 캠프 초대 404 에러 수정

## 🔍 문제 상황

1. 관리자가 템플릿 초대를 보냄
2. 학생이 수락하지 않았는데 바로 수락처리가 되었음
3. 학생이 해당 캠프 템플릿을 누르니 404 에러 발생

### 문제점

- `accepted` 상태인데 플랜 그룹이 없는 경우 제출 완료 페이지(`/camp/${invitationId}/submitted`)로 리다이렉트
- 제출 완료 페이지는 플랜 그룹이 필수인데, 플랜 그룹이 없어서 `notFound()` 호출로 404 에러 발생
- 데이터 불일치 상태(accepted인데 플랜 그룹 없음)에 대한 처리 부족

## 🛠 수정 내용

### 1. 참여 페이지 리다이렉트 로직 개선

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

**변경 사항**:
- `accepted` 상태인데 플랜 그룹이 없는 경우 제출 완료 페이지로 리다이렉트하지 않고 참여 페이지를 그대로 보여줌
- 데이터 불일치 상태를 감지하여 에러 메시지 표시
- 플랜 그룹이 있는 경우 플랜 그룹 상세로 이동할 때 `?camp=true` 쿼리 파라미터 추가

**변경 전**:
```typescript
if (planGroup) {
  // ...
} else {
  // 플랜 그룹이 없는 경우는 이상한 케이스이므로 제출 완료 페이지로 (안전장치)
  redirect(`/camp/${invitationId}/submitted`);
}
```

**변경 후**:
```typescript
if (planGroup) {
  // 플랜이 생성되었으면 플랜 그룹 상세로, 아니면 제출 완료 상세로
  if (hasPlans) {
    redirect(`/plan/group/${planGroup.id}?camp=true`);
  } else {
    redirect(`/camp/${invitationId}/submitted`);
  }
} else {
  // 플랜 그룹이 없는 경우: accepted 상태인데 플랜 그룹이 없음 (데이터 불일치)
  // 참여 페이지를 그대로 보여주되, 에러 메시지를 표시하기 위해 계속 진행
  console.warn(
    "[CampParticipationPage] accepted 상태인데 플랜 그룹이 없음:",
    invitationId
  );
  // 참여 페이지를 그대로 보여줌
}
```

### 2. 데이터 불일치 에러 메시지 추가

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

**변경 사항**:
- `accepted` 상태인데 플랜 그룹이 없는 경우를 감지하여 validationErrors에 에러 메시지 추가
- 사용자에게 문제 상황을 알리고 관리자에게 문의하도록 안내

**추가된 코드**:
```typescript
// accepted 상태인데 플랜 그룹이 없는 경우 확인 (데이터 불일치 체크)
let hasDataInconsistency = false;
if (invitation.status === "accepted") {
  const { data: checkPlanGroup } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("camp_invitation_id", invitationId)
    .limit(1)
    .maybeSingle();
  
  if (!checkPlanGroup) {
    hasDataInconsistency = true;
    console.warn(
      "[CampParticipationPage] 데이터 불일치: accepted 상태인데 플랜 그룹이 없음",
      invitationId
    );
  }
}

// validationErrors에 추가
if (hasDataInconsistency) {
  validationErrors.push(
    "캠프 참여 상태에 문제가 있습니다. 관리자에게 문의해주세요."
  );
}
```

### 3. 제출 완료 페이지 개선

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

**변경 사항**:
- 플랜 그룹이 없는 경우 `notFound()` 대신 참여 페이지로 리다이렉트
- 데이터 불일치 상태를 처리하여 404 에러 방지

**변경 전**:
```typescript
if (!planGroup) {
  console.warn(
    "[CampSubmissionDetailPage] 플랜 그룹을 찾을 수 없음:",
    invitationId
  );
  notFound();
}
```

**변경 후**:
```typescript
if (!planGroup) {
  console.warn(
    "[CampSubmissionDetailPage] 플랜 그룹을 찾을 수 없음:",
    invitationId
  );
  // 플랜 그룹이 없는 경우 참여 페이지로 리다이렉트 (데이터 불일치 처리)
  redirect(`/camp/${invitationId}`);
}
```

## ✅ 해결된 문제

1. ✅ `accepted` 상태인데 플랜 그룹이 없는 경우 404 에러 해결
2. ✅ 데이터 불일치 상태에 대한 사용자 안내 메시지 추가
3. ✅ 제출 완료 페이지에서 플랜 그룹이 없는 경우 처리 개선

## 🔍 추가 확인 필요 사항

**초대 상태가 자동으로 accepted로 변경되는 문제**는 아직 확인되지 않았습니다.

가능한 원인:
1. 관리자가 초대를 보낼 때 잘못된 상태로 설정
2. 데이터베이스 트리거나 함수가 자동으로 상태를 변경
3. 다른 로직에서 상태를 변경

**확인 방법**:
- `camp_invitations` 테이블의 트리거 확인
- 초대 발송 로직(`sendCampInvitationsAction`) 확인
- 초대 상태 변경 로직(`updateCampInvitationStatus`) 확인

## 📝 관련 파일

- `app/(student)/camp/[invitationId]/page.tsx` - 참여 페이지
- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 제출 완료 페이지
- `app/(student)/actions/campActions.ts` - 캠프 액션
- `lib/data/campTemplates.ts` - 캠프 템플릿 데이터 레이어

