# Phase 3: 캠프 관리 기능 최적화 - 자동화 기능 추가

## 개요

캠프 관리 기능의 자동화를 통해 초대 만료 처리, 리마인더 발송, 플랜 그룹 생성 최적화를 구현했습니다.

## 구현 내용

### 1. 초대 만료 자동 처리

#### 1.1 데이터베이스 스키마 수정

**마이그레이션**: `supabase/migrations/20251219164759_add_camp_invitation_expires_at.sql`

- `camp_invitations` 테이블에 `expires_at` 필드 추가 (timestamptz)
- `status`에 'expired' 값 추가 (CHECK 제약조건 수정)
- 기본값: 초대 발송 후 7일
- 인덱스 추가: `idx_camp_invitations_expires_at` (expires_at이 null이 아닌 경우만)

#### 1.2 만료 처리 서비스

**파일**: `lib/services/campInvitationExpiryService.ts`

구현된 함수:
- `processExpiredInvitations()`: 만료된 초대를 찾아 상태를 'expired'로 변경
- `sendExpiryReminderNotifications()`: 만료 1일 전 알림 발송
- `getExpiringInvitations()`: 곧 만료될 초대 조회 (1일 이내)

#### 1.3 sendCampInvitationsAction 수정

**파일**: `app/(admin)/actions/campTemplateActions.ts`

초대 발송 시 `expires_at` 필드를 자동으로 설정하도록 수정:
- 초대 발송 후 7일 후로 만료일 설정

#### 1.4 만료 처리 실행 방법

**API Route**: `app/api/cron/process-camp-expiry/route.ts`

- Vercel Cron 또는 외부 Cron 서비스로 주기적 호출
- 매일 오전 9시 실행 권장
- Authorization 헤더에 `CRON_SECRET` 포함 필요

**사용 예시**:
```bash
curl -X GET "https://yourdomain.com/api/cron/process-camp-expiry" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. 자동 리마인더 발송

#### 2.1 데이터베이스 스키마 수정

**마이그레이션**: `supabase/migrations/20251219164800_add_camp_template_reminder_settings.sql`

- `camp_templates` 테이블에 `reminder_settings` JSONB 필드 추가
- 기본 구조:
  ```json
  {
    "enabled": true,
    "intervals": [3, 5, 7], // 초대 발송 후 며칠째에 리마인더 발송
    "lastReminderDays": 7 // 마지막 리마인더는 초대 발송 후 며칠째
  }
  ```

#### 2.2 리마인더 서비스

**파일**: `lib/services/campReminderService.ts`

구현된 함수:
- `processReminders()`: 대기 중인 초대에 대한 리마인더 발송
- `shouldSendReminder(invitation, template)`: 리마인더 발송 여부 판단
- `getReminderIntervals(template)`: 템플릿별 리마인더 간격 조회

**리마인더 발송 조건**:
- 초대 상태가 'pending'
- 초대 발송 후 지정된 일수 경과 (3일, 5일, 7일)
- 템플릿의 리마인더 설정이 활성화되어 있음

#### 2.3 리마인더 실행 방법

**API Route**: `app/api/cron/process-camp-reminders/route.ts`

- Vercel Cron 또는 외부 Cron 서비스로 주기적 호출
- 매일 오전 10시 실행 권장
- Authorization 헤더에 `CRON_SECRET` 포함 필요

**사용 예시**:
```bash
curl -X GET "https://yourdomain.com/api/cron/process-camp-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. 플랜 그룹 자동 생성 개선

#### 3.1 bulkCreatePlanGroupsForCamp 개선

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**개선 사항**:

1. **배치 처리 최적화**
   - 순차 처리(for loop) → 병렬 처리(Promise.all)로 변경
   - 최대 동시 처리 수 제한: 5개
   - 배치 단위로 처리하여 데이터베이스 부하 최소화

2. **에러 처리 강화**
   - 부분 실패 시 상세 에러 정보 제공
   - 각 초대별로 독립적인 에러 처리

3. **플랜 생성 상태 알림**
   - 플랜 생성 완료 시 학생에게 인앱 알림 발송
   - 알림 발송 실패해도 플랜 생성은 성공으로 처리

### 4. 데이터베이스 최적화

#### 4.1 인덱스 추가

**마이그레이션**: `supabase/migrations/20251219164801_add_camp_indexes.sql`

추가된 인덱스:
- `idx_camp_invitations_status`: status 필드 인덱스
- `idx_plan_groups_camp_invitation`: camp_invitation_id 인덱스
- `idx_plan_groups_camp_template`: camp_template_id 인덱스

## 타입 업데이트

### CampInvitationStatus
```typescript
export type CampInvitationStatus = "pending" | "accepted" | "declined" | "expired";
```

### CampInvitation
```typescript
export type CampInvitation = {
  // ... 기존 필드
  expires_at: string | null; // 만료일 (초대 발송 후 7일 기본값)
};
```

### CampReminderSettings
```typescript
export type CampReminderSettings = {
  enabled: boolean;
  intervals: number[]; // 초대 발송 후 며칠째에 리마인더 발송
  lastReminderDays: number; // 마지막 리마인더는 초대 발송 후 며칠째
};
```

### CampTemplate
```typescript
export type CampTemplate = {
  // ... 기존 필드
  reminder_settings: CampReminderSettings | null; // 리마인더 설정
};
```

## 환경 변수 설정

### CRON_SECRET

Cron Job API Route를 보호하기 위한 시크릿 키입니다.

**.env.local** 또는 **Vercel Environment Variables**에 추가:
```
CRON_SECRET=your-secret-key-here
```

## Vercel Cron 설정

`vercel.json` 파일에 Cron Job을 추가:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-camp-expiry",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/process-camp-reminders",
      "schedule": "0 10 * * *"
    }
  ]
}
```

## 주의사항

1. **만료 처리 실행 주기**
   - 매일 1회 실행 권장 (오전 9시)
   - 너무 자주 실행하면 불필요한 부하 발생

2. **리마인더 발송 주기**
   - 매일 1회 실행 권장 (오전 10시)
   - 중복 발송 방지 로직 포함

3. **병렬 처리 제한**
   - bulkCreatePlanGroupsForCamp에서 동시 처리 수 제한 (최대 5개)
   - 데이터베이스 부하 고려

4. **에러 처리**
   - 만료 처리 및 리마인더 발송 실패 시 로깅
   - 알림 발송 실패는 플랜 생성/만료 처리 성공에 영향을 주지 않음

## 테스트

### 로컬 테스트

```bash
# 만료 처리 테스트
curl -X GET "http://localhost:3000/api/cron/process-camp-expiry" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 리마인더 발송 테스트
curl -X GET "http://localhost:3000/api/cron/process-camp-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 향후 개선 사항

1. **템플릿별 리마인더 설정 UI**
   - 관리자가 템플릿별로 리마인더 간격을 설정할 수 있는 UI 추가

2. **만료일 커스터마이징**
   - 템플릿별로 만료일을 다르게 설정할 수 있는 기능 추가

3. **Supabase Edge Function으로 마이그레이션**
   - 현재 API Route 대신 Supabase Edge Function 사용 고려
   - Supabase Cron으로 직접 스케줄링 가능

