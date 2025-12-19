# 캠프 초대 상태 표시 문제 수정

## 작업 개요

캠프 초대 삭제 후 재생성 시 상태 표시 문제를 수정했습니다.

## 문제 분석

### 문제 1: 초대 삭제 후 재생성 시 "작성 중"으로 표시되는 문제

**원인**:
- `app/(student)/camp/page.tsx`에서 `isDraft` 판단 로직이 `planGroup.status === "draft"`만 확인하고 있었습니다.
- 초대 삭제 후 재생성 시, 이전 플랜 그룹이 남아있을 수 있고, 그 플랜 그룹의 상태가 "draft"일 경우 `isDraft`가 `true`가 되어 "작성 중"으로 표시되었습니다.
- 초대 상태(`invitation.status`)가 "pending"인지 확인하지 않아서, accepted 상태인데도 "작성 중"으로 표시될 수 있었습니다.

**해결**:
- `isDraft` 판단 로직을 수정하여 초대 상태가 "pending"이고 플랜 그룹이 "draft" 상태일 때만 `true`로 설정하도록 변경했습니다.
- 이렇게 하면 초대 삭제 후 재생성 시, 초대 상태가 "pending"이 아니면 "작성 중"으로 표시되지 않습니다.

### 문제 2: 제출 후 플랜 생성 전까지 읽기 모드 확인

**확인 결과**:
- `app/(student)/camp/[invitationId]/submitted/page.tsx`에서 `PlanGroupDetailView` 컴포넌트에 `canEdit={false}`로 설정되어 있습니다.
- 제출 후 플랜 생성 전까지는 읽기 모드로 표시되는 것이 맞습니다.

## 수정 내용

### 1. `app/(student)/camp/page.tsx`

**변경 전**:
```typescript
isDraft: planGroup.status === "draft",
```

**변경 후**:
```typescript
// isDraft 판단: pending 상태이고 플랜 그룹이 draft 상태일 때만 true
// 초대 삭제 후 재생성 시 이전 플랜 그룹이 남아있을 수 있으므로,
// 초대 상태가 pending이고 플랜 그룹이 draft 상태일 때만 작성 중으로 표시
const isDraft = invitation.status === "pending" && planGroup.status === "draft";
```

### 2. `lib/camp/campStatus.ts`

**변경 사항**:
- `getCampStatus` 함수에 `planGroupId` 파라미터 추가
- `planGroupId`가 없으면 "작성 중" 상태로 표시하지 않도록 수정
- `getCampStatusInfo` 함수에서 `planGroupId`가 없으면 배지 레이블을 빈 문자열로 설정
- `getCampStatusFromInvitation` 함수에서 `planGroupId`가 없으면 "이어서 작성하기" 링크를 제거

**변경 전**:
```typescript
export function getCampStatus(
  invitationStatus: CampInvitationStatus,
  planGroupStatus: PlanStatus | null,
  hasPlans: boolean,
  isDraft: boolean = false
): CampStatus {
  // ...
  if (invitationStatus === "pending" && isDraft) {
    return "PENDING_FORM";
  }
  // ...
  if (invitationStatus === "pending") {
    return "PENDING_FORM"; // planGroupId가 없어도 "작성 중"으로 표시됨
  }
}
```

**변경 후**:
```typescript
export function getCampStatus(
  invitationStatus: CampInvitationStatus,
  planGroupStatus: PlanStatus | null,
  hasPlans: boolean,
  isDraft: boolean = false,
  planGroupId: string | null = null
): CampStatus {
  // planGroupId가 있어야만 "작성 중" 상태로 표시
  if (invitationStatus === "pending" && isDraft && planGroupId) {
    return "PENDING_FORM";
  }
  // ...
}
```

### 3. `app/(student)/camp/_components/CampInvitationCard.tsx`

**변경 사항**:
- `statusInfo.label`이 있을 때만 배지를 표시하도록 수정

**변경 전**:
```typescript
<span className={statusInfo.badgeClassName}>
  {statusInfo.label}
</span>
```

**변경 후**:
```typescript
{statusInfo.label && (
  <span className={statusInfo.badgeClassName}>
    {statusInfo.label}
  </span>
)}
```

## 테스트 시나리오

1. **초대 삭제 후 재생성 시나리오**:
   - 관리자가 초대를 삭제하고 다시 초대를 생성합니다.
   - 학생 영역에서 캠프 목록을 확인합니다.
   - 초대 상태가 "pending"이고 플랜 그룹이 없으면 "참여하기" 버튼이 표시되어야 합니다.
   - 초대 상태가 "pending"이고 플랜 그룹이 "draft" 상태일 때만 "작성 중" 배지가 표시되어야 합니다.

2. **제출 후 읽기 모드 확인**:
   - 학생이 캠프 참여 정보를 제출합니다.
   - 플랜 생성 전까지 캠프 목록에서 해당 캠프를 클릭합니다.
   - 제출 완료 페이지(`/camp/[invitationId]/submitted`)로 이동하며 읽기 모드로 표시되어야 합니다.

## 관련 파일

- `app/(student)/camp/page.tsx` - 캠프 목록 페이지 (isDraft 판단 로직 수정)
- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 제출 완료 페이지 (읽기 모드 확인)

## 참고 사항

- 초대 삭제 시 플랜 그룹도 함께 삭제하는 로직은 이미 구현되어 있습니다 (`lib/data/planGroups.ts`의 `deletePlanGroupByInvitationId` 함수).
- 하지만 데이터 불일치가 발생할 수 있는 경우를 대비하여 클라이언트 사이드에서도 안전장치를 추가했습니다.

