# 캠프 초대 상태 업데이트 및 참여자 목록 조회 문제 해결

## 📋 작업 개요

**날짜**: 2025-12-22  
**문제**: 학생이 캠프 템플릿을 제출했는데도 관리자 화면에서 대기중 상태로 표시되거나 참여자가 없다고 나오는 문제  
**원인**: `camp_invitations` 테이블에 UPDATE 및 SELECT RLS 정책이 없어서 상태 업데이트와 조회가 실패함

## 🔍 문제 분석

### 발견된 문제점

1. **RLS 정책 부재**
   - `camp_invitations` 테이블에 INSERT 정책만 존재
   - UPDATE 정책이 없어서 학생이 자신의 초대 상태를 업데이트할 수 없음
   - SELECT 정책이 없어서 관리자가 초대 목록을 조회할 수 없음

2. **에러 처리 부족**
   - `updateCampInvitationStatus` 함수가 에러를 제대로 처리하지 않음
   - RLS 정책 위반 시 에러 메시지가 명확하지 않음

3. **클라이언트 사이드 조회 문제**
   - `loadCampParticipants`가 브라우저 클라이언트를 사용하여 RLS 정책에 따라 데이터를 볼 수 없음
   - 관리자가 참여자 목록을 조회할 때 권한 문제 발생

## ✅ 해결 방법

### 1. RLS 정책 추가

**마이그레이션 파일**: `supabase/migrations/20251222041824_add_camp_invitations_update_select_policies.sql`

#### 추가된 정책

1. **camp_invitations_update_for_student**
   - 학생이 자신의 초대 상태를 업데이트할 수 있도록 허용
   - pending 상태인 초대만 업데이트 가능
   - status는 'accepted' 또는 'declined'로만 변경 가능

2. **camp_invitations_select_for_student**
   - 학생이 자신의 초대를 조회할 수 있도록 허용

3. **camp_invitations_select_for_admin**
   - 관리자/컨설턴트가 자신의 테넌트에 속한 초대를 조회할 수 있도록 허용
   - Super Admin은 모든 테넌트의 초대 조회 가능

4. **camp_invitations_update_for_admin**
   - 관리자/컨설턴트가 자신의 테넌트에 속한 초대를 업데이트할 수 있도록 허용

### 2. updateCampInvitationStatus 함수 개선

**파일**: `lib/data/campTemplates.ts`

**변경 사항**:
- 에러 처리 개선: 실제 에러 메시지 반환
- RLS 정책 위반 시 명확한 에러 메시지 제공
- `select().single()`을 사용하여 업데이트 성공 여부 확인

```typescript
const { data, error } = await supabase
  .from("camp_invitations")
  .update(updateData)
  .eq("id", invitationId)
  .select("id")
  .single();

if (error) {
  return {
    success: false,
    error: error.message || "초대 상태 업데이트에 실패했습니다.",
  };
}

if (!data) {
  return {
    success: false,
    error: "초대 상태를 업데이트할 수 없습니다. 권한을 확인해주세요.",
  };
}
```

### 3. loadCampParticipants를 서버 액션으로 변경

**파일**: `app/(admin)/actions/camp-templates/participants.ts`

**변경 사항**:
- `getCampParticipantsAction` 서버 액션 추가
- Admin Client 사용하여 RLS 우회
- 클라이언트 컴포넌트에서 서버 액션 호출

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/_components/useCampParticipantsLogic.ts`

**변경 사항**:
- `loadCampParticipants` 대신 `getCampParticipantsAction` 사용
- 서버 액션을 통해 참여자 목록 조회

## 🔄 적용 과정

1. ✅ RLS 정책 마이그레이션 파일 생성
2. ✅ `updateCampInvitationStatus` 함수 에러 처리 개선
3. ✅ `getCampParticipantsAction` 서버 액션 추가
4. ✅ `useCampParticipantsLogic` 훅 수정

## 📝 참고 사항

### 관련 파일

- `supabase/migrations/20251222041824_add_camp_invitations_update_select_policies.sql` - RLS 정책 마이그레이션
- `lib/data/campTemplates.ts` - `updateCampInvitationStatus` 함수
- `app/(admin)/actions/camp-templates/participants.ts` - `getCampParticipantsAction` 서버 액션
- `app/(admin)/admin/camp-templates/[id]/participants/_components/useCampParticipantsLogic.ts` - 참여자 목록 로드 로직

### 보안 고려사항

- **최소 권한 원칙**: 학생은 자신의 초대만 업데이트/조회 가능
- **테넌트 격리**: 관리자는 자신의 테넌트에 속한 초대만 조회/업데이트 가능
- **상태 제한**: pending 상태인 초대만 업데이트 가능 (이미 처리된 초대는 수정 불가)
- **Super Admin 예외**: Super Admin은 모든 테넌트의 초대 조회/업데이트 가능

### 테스트 방법

1. **학생 초대 상태 업데이트 테스트**
   - 학생 계정으로 로그인
   - 캠프 템플릿 제출
   - 초대 상태가 "accepted"로 변경되는지 확인

2. **관리자 참여자 목록 조회 테스트**
   - 관리자 계정으로 로그인
   - 캠프 템플릿 상세 페이지에서 참여자 목록 확인
   - 제출한 학생이 "수락" 상태로 표시되는지 확인

3. **RLS 정책 테스트**
   - 다른 테넌트의 관리자가 초대를 조회할 수 없는지 확인
   - 학생이 다른 학생의 초대를 업데이트할 수 없는지 확인

## 🚨 주의사항

- 마이그레이션 적용 후 기존 초대 데이터에 대한 권한이 변경됨
- RLS 정책이 활성화되면 모든 쿼리가 정책을 통과해야 함
- Admin Client를 사용하는 경우 RLS를 우회하므로 주의 필요

