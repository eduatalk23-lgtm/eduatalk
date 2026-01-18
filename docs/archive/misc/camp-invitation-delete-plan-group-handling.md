# 캠프 초대 삭제 시 플랜 그룹 삭제 처리

## 작업 개요

캠프모드 관리자 영역에서 초대 삭제 시 제출된 플랜 그룹(plan_group)도 함께 삭제하도록 로직을 추가했습니다.

## 문제 분석

### 기존 문제점

1. 초대 삭제 시 `camp_invitations` 테이블에서만 삭제됨
2. 제출된 플랜 그룹(`plan_groups`)은 `camp_invitation_id`만 NULL로 변경되어 남아있음
3. 데이터 일관성 문제 발생 가능
4. 초대가 삭제되어도 플랜 그룹이 남아있어 혼란 발생 가능

### 데이터베이스 제약 조건

- `plan_groups.camp_invitation_id`는 `ON DELETE SET NULL`로 설정되어 있음
- 초대 삭제 시 플랜 그룹의 `camp_invitation_id`만 NULL로 변경되고 플랜 그룹은 유지됨

## 해결 방안

초대 삭제 시 관련된 플랜 그룹을 함께 삭제하도록 로직을 추가했습니다.

### 삭제 순서

1. `camp_invitation_id`로 플랜 그룹 조회
2. 플랜 그룹이 있으면:
   - `student_plan` 삭제 (hard delete)
   - `plan_contents` 삭제 (hard delete)
   - `plan_exclusions` 삭제 (hard delete)
   - `plan_groups` 삭제 (hard delete)
3. `camp_invitations` 삭제

## 수정 내용

### 1. `lib/data/planGroups.ts`

#### 1.1 관리자용 플랜 그룹 삭제 함수 추가

**새로 추가된 함수**: `deletePlanGroupByInvitationId`

```typescript
export async function deletePlanGroupByInvitationId(
  invitationId: string
): Promise<{ success: boolean; error?: string; deletedGroupId?: string }>
```

**기능**:
- `camp_invitation_id`로 플랜 그룹 조회
- 관련 `student_plan` 삭제
- 관련 `plan_contents` 삭제
- 관련 `plan_exclusions` 삭제
- `plan_groups` 삭제 (hard delete)
- 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)

### 2. `lib/data/campTemplates.ts`

#### 2.1 `deleteCampInvitation` 함수 수정

**변경 전**:
```typescript
export async function deleteCampInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("camp_invitations")
    .delete()
    .eq("id", invitationId);
  // ...
}
```

**변경 후**:
- 초대 삭제 전에 `deletePlanGroupByInvitationId` 호출
- 플랜 그룹 삭제 실패 시 초대 삭제 중단 및 에러 반환
- 플랜 그룹 삭제 성공 후 초대 삭제 진행

#### 2.2 `deleteCampInvitations` 함수 수정

**변경 전**:
```typescript
export async function deleteCampInvitations(
  invitationIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  // 초대 일괄 삭제만 수행
}
```

**변경 후**:
- 각 초대에 대해 `deletePlanGroupByInvitationId` 호출 (Promise.all 사용)
- 플랜 그룹 삭제 실패가 있어도 초대 삭제는 계속 진행 (에러 로깅)
- 모든 플랜 그룹 삭제 완료 후 초대 일괄 삭제 진행

## 에러 처리

### 플랜 그룹 삭제 실패 처리

1. **단일 삭제** (`deleteCampInvitation`):
   - 플랜 그룹 삭제 실패 시 초대 삭제 중단
   - 에러 메시지 반환

2. **일괄 삭제** (`deleteCampInvitations`):
   - 일부 플랜 그룹 삭제 실패해도 초대 삭제는 계속 진행
   - 실패한 플랜 그룹 삭제에 대한 에러 로깅
   - 데이터 일관성 유지를 위해 초대 삭제는 완료

### 에러 메시지

- `플랜 그룹 삭제 실패: {error_message}`
- `플랜 삭제 실패: {error_message}`
- `플랜 그룹 삭제 실패: {error_message}`

## 주요 변경사항

1. **하드 삭제 적용**
   - 초대 삭제 시 플랜 그룹은 Soft Delete가 아닌 Hard Delete
   - 초대가 삭제되면 관련 데이터를 완전히 제거

2. **트랜잭션 처리**
   - 플랜 그룹 삭제 성공 후 초대 삭제 진행
   - 플랜 그룹 삭제 실패 시 초대 삭제 중단 (단일 삭제)

3. **관련 데이터 일괄 삭제**
   - `student_plan`: 플랜 그룹에 연결된 개별 플랜
   - `plan_contents`: 플랜 그룹에 포함된 콘텐츠
   - `plan_exclusions`: 플랜 그룹의 제외일

## 테스트 시나리오

### 1. 초대가 수락되고 플랜 그룹이 제출된 상태에서 초대 삭제

**예상 결과**:
- 플랜 그룹 및 관련 데이터 모두 삭제
- 초대 삭제 성공

### 2. 초대가 수락되지 않은 상태에서 초대 삭제

**예상 결과**:
- 플랜 그룹이 없으므로 플랜 그룹 삭제 단계는 건너뜀
- 초대 삭제 성공

### 3. 일괄 삭제 시 여러 초대 중 일부만 플랜 그룹이 있는 경우

**예상 결과**:
- 플랜 그룹이 있는 초대에 대해서만 플랜 그룹 삭제 수행
- 플랜 그룹이 없는 초대는 건너뜀
- 모든 초대 삭제 성공

### 4. 플랜 그룹 삭제 실패 시 초대 삭제도 중단되는지 확인

**단일 삭제**:
- 플랜 그룹 삭제 실패 시 초대 삭제 중단
- 에러 메시지 반환

**일괄 삭제**:
- 일부 플랜 그룹 삭제 실패해도 초대 삭제는 계속 진행
- 에러 로깅

## 관련 파일

- `lib/data/planGroups.ts` - 관리자용 플랜 그룹 삭제 함수 추가
- `lib/data/campTemplates.ts` - 초대 삭제 함수 수정
- `app/(admin)/actions/campTemplateActions.ts` - 변경 없음 (이미 올바른 함수 호출)
- `app/(admin)/admin/camp-templates/[id]/CampInvitationList.tsx` - UI 변경 없음 (이미 경고 메시지 표시)

## 주의사항

1. **데이터 복구 불가**
   - Hard Delete를 사용하므로 삭제된 데이터는 복구할 수 없음
   - 관리자가 초대 삭제 시 신중하게 처리해야 함

2. **성능 고려**
   - 일괄 삭제 시 여러 플랜 그룹을 동시에 삭제하므로 성능 영향 가능
   - 대량 삭제 시 네트워크 지연 고려

3. **외래키 제약**
   - `plan_contents`, `plan_exclusions`는 외래키 제약으로 자동 삭제될 수 있음
   - 안전을 위해 명시적으로 삭제 로직 추가

## 작업 일시

2025-01-XX

