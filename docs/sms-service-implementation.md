# SMS 서비스 구현 가이드

## 개요

뿌리오 API를 활용한 SMS 발송 서비스를 구현했습니다. 출석 기록 시 자동 알림, 수동 발송, 발송 이력 조회 등의 기능을 제공합니다.

## 아키텍처

### 주요 컴포넌트

1. **SMS 서비스 레이어** (`lib/services/smsService.ts`)
   - `sendSMS()`: 단일 SMS 발송
   - `sendBulkSMS()`: 대량 SMS 발송
   - `validateAndNormalizePhoneNumber()`: 전화번호 검증 및 정규화

2. **SMS 템플릿** (`lib/services/smsTemplates.ts`)
   - 출석 관련 템플릿 (입실, 퇴실, 결석, 지각)
   - 수강료, 상담, 공지사항 템플릿
   - `formatSMSTemplate()`: 템플릿 변수 치환

3. **Server Actions** (`app/actions/smsActions.ts`)
   - `sendAttendanceSMS()`: 출석 관련 SMS 발송
   - `sendBulkAttendanceSMS()`: 일괄 출석 SMS 발송
   - `sendGeneralSMS()`: 일반 SMS 발송

4. **출석 연동** (`app/(admin)/actions/attendanceActions.ts`)
   - 출석 기록 시 자동 SMS 발송

5. **UI 컴포넌트**
   - `app/(admin)/admin/sms/page.tsx`: SMS 발송 이력 조회
   - `app/(admin)/admin/sms/_components/SMSSendForm.tsx`: SMS 발송 폼

## 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
PPURIO_USER_ID=your_user_id
PPURIO_API_KEY=your_api_key
PPURIO_SENDER_NUMBER=01012345678
```

### 환경 변수 설명

- `PPURIO_USER_ID`: 뿌리오 API 사용자 ID
- `PPURIO_API_KEY`: 뿌리오 API 키
- `PPURIO_SENDER_NUMBER`: 발신 번호 (하이픈 없이 숫자만)

## 뿌리오 API 스펙

### 엔드포인트

```
POST https://message.ppurio.com/v1/send
```

### 요청 헤더

```
Content-Type: application/json
X-PPURIO-USER-ID: {PPURIO_USER_ID}
X-PPURIO-API-KEY: {PPURIO_API_KEY}
```

### 요청 본문

```json
{
  "phone": "01012345678",
  "message": "메시지 내용",
  "sender": "01012345678"
}
```

### 응답 형식

```json
{
  "result_code": 200,
  "message": "성공 메시지",
  "msg_id": "메시지 ID"
}
```

### 에러 코드

- `200`: 성공
- `400`: 잘못된 요청
- `401`: 인증 실패
- `403`: 접근 거부
- `429`: 요청 한도 초과
- `500`: 서버 오류

## 주요 기능

### 1. 전화번호 검증

한국 휴대폰 번호 형식을 검증하고 정규화합니다:

- 지원 형식: `010-1234-5678`, `01012345678`
- 검증 규칙: 010, 011, 016, 017, 018, 019로 시작하는 10-11자리 숫자
- 정규화: 하이픈과 공백 제거

```typescript
import { validateAndNormalizePhoneNumber } from "@/lib/services/smsService";

const result = validateAndNormalizePhoneNumber("010-1234-5678");
if (result.isValid) {
  console.log(result.normalized); // "01012345678"
}
```

### 2. SMS 발송

#### 단일 발송

```typescript
import { sendSMS } from "@/lib/services/smsService";

const result = await sendSMS({
  recipientPhone: "01012345678",
  message: "안녕하세요",
  recipientId: "student-id",
  tenantId: "tenant-id",
});

if (result.success) {
  console.log("발송 성공:", result.msgId);
} else {
  console.error("발송 실패:", result.error);
}
```

#### 대량 발송

```typescript
import { sendBulkSMS } from "@/lib/services/smsService";

const result = await sendBulkSMS(
  [
    { phone: "01012345678", message: "메시지 1", recipientId: "id1" },
    { phone: "01087654321", message: "메시지 2", recipientId: "id2" },
  ],
  "tenant-id"
);

console.log(`성공: ${result.success}, 실패: ${result.failed}`);
```

### 3. 템플릿 사용

```typescript
import { formatSMSTemplate } from "@/lib/services/smsTemplates";

const message = formatSMSTemplate("attendance_check_in", {
  학원명: "우리 학원",
  학생명: "홍길동",
  시간: "09:00",
});
// 결과: "[우리 학원] 홍길동님이 09:00에 입실하셨습니다."
```

### 4. 출석 기록 시 자동 발송

출석 기록을 저장하면 상태에 따라 자동으로 SMS가 발송됩니다:

- **입실 알림**: `present` 상태 + `check_in_time` 있음
- **퇴실 알림**: `present` 상태 + `check_out_time` 있음
- **결석 알림**: `absent` 상태
- **지각 알림**: `late` 상태 + `check_in_time` 있음

SMS 발송 실패 시에도 출석 기록은 정상적으로 저장됩니다.

## 에러 처리

### 재시도 로직

일시적 네트워크 에러나 서버 오류(5xx) 발생 시 자동으로 재시도합니다:

- 최대 재시도 횟수: 2회
- 지수 백오프: 1초, 2초, 4초...

### 에러 로깅

모든 SMS 발송 시도는 `sms_logs` 테이블에 기록됩니다:

- `status`: `pending`, `sent`, `delivered`, `failed`
- `error_message`: 실패 시 에러 메시지
- `sent_at`: 발송 시간
- `delivered_at`: 전달 시간

## 데이터베이스 스키마

### sms_logs 테이블

```sql
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  recipient_id uuid REFERENCES users(id),
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  template_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

## UI 사용법

### SMS 발송 이력 조회

1. 관리자 메뉴에서 "통신 관리" > "SMS 발송 이력" 클릭
2. 검색 및 필터링:
   - 학생 이름, 전화번호, 메시지 내용으로 검색
   - 상태별 필터링 (대기 중, 발송 완료, 전달 완료, 실패)
3. 발송 이력 확인:
   - 발송 상태, 시간, 에러 메시지 등 확인

### SMS 발송

1. SMS 발송 이력 페이지 상단의 "SMS 발송" 폼 사용
2. 학생 선택 (선택사항):
   - 학생을 선택하면 학부모 연락처가 자동 입력됨
3. 수신자 전화번호 입력
4. 템플릿 선택 (선택사항):
   - 템플릿을 선택하면 메시지가 자동으로 채워짐
5. 메시지 내용 입력
6. "SMS 발송" 버튼 클릭

## 보안 고려사항

1. **환경 변수 보호**
   - API 키는 절대 클라이언트 코드에 노출되지 않음
   - Server Actions에서만 사용

2. **RLS 정책**
   - 관리자는 자신의 테넌트 내 SMS 로그만 조회 가능
   - 학생은 자신에게 발송된 SMS 로그만 조회 가능

3. **입력 검증**
   - 전화번호 형식 검증
   - 메시지 길이 제한 (SMS: 90자, LMS: 2000자)

## 성능 최적화

1. **대량 발송**
   - 순차 발송으로 Rate Limit 방지
   - 발송 간 100ms 딜레이

2. **비동기 처리**
   - 출석 기록 시 SMS 발송은 비동기로 처리
   - SMS 발송 실패해도 출석 기록은 정상 저장

## 문제 해결

### SMS 발송이 실패하는 경우

1. 환경 변수 확인
   - `.env.local` 파일에 올바른 값이 설정되어 있는지 확인
   - 서버 재시작 필요

2. 전화번호 형식 확인
   - 한국 휴대폰 번호 형식인지 확인
   - 하이픈 없이 숫자만 입력

3. 뿌리오 계정 확인
   - API 키가 유효한지 확인
   - 발신 번호가 등록되어 있는지 확인
   - 계정 잔액 확인

4. 로그 확인
   - `sms_logs` 테이블의 `error_message` 확인
   - 서버 콘솔 로그 확인

### 테이블이 없다는 에러

`sms_logs` 테이블이 없다는 에러가 발생하면:

```bash
supabase db push
```

또는

```bash
supabase migration up
```

명령어로 마이그레이션을 적용하세요.

## 향후 개선 사항

1. **예약 발송**
   - 특정 시간에 발송하도록 예약

2. **발송 설정**
   - 자동 발송 활성화/비활성화 옵션
   - 발송 시간대 설정

3. **통계 및 리포트**
   - 발송 성공률 통계
   - 월별/일별 발송 리포트

4. **템플릿 관리 UI**
   - 템플릿 추가/수정/삭제 기능

5. **LMS/MMS 지원**
   - 장문 메시지(LMS) 발송
   - 포토 메시지(MMS) 발송

## 참고 자료

- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- 뿌리오 고객센터: 1588-5412

