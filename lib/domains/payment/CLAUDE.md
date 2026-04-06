# Payment Domain Rules

## Scope
수납/결제 CRUD, 토스페이먼츠 온라인 결제, 현금영수증, 결제 링크(게스트 결제), 일괄 청구, 미수금 관리, SMS/알림톡 독촉.

## Architecture
```
payment/
├── types.ts              # PaymentRecord, PaymentStatus, PaymentMethod, DiscountType 등 공용 타입
├── actions/
│   ├── index.ts          # Public re-export (payment + tossPayment + parentPayment)
│   ├── payment.ts        # 수납 CRUD (생성/확인/삭제/분납)
│   ├── tossPayment.ts    # 토스 결제 준비/일괄 결제/환불/상태 동기화
│   ├── billing.ts        # 일괄 청구 생성, 자동 청구(cron), 테넌트 billing 설정
│   ├── cashReceipt.ts    # 현금영수증 발급/취소 (토스 API)
│   ├── outstanding.ts    # 미수금 통계/목록, 활성 수강 조회
│   ├── parentPayment.ts  # 학부모 결제 내역 조회
│   └── sms.ts            # 개별 결제 독촉 SMS 발송
├── paymentLink/
│   ├── types.ts          # PaymentLink, GuestPaymentData, DeliveryMethod 등
│   ├── actions.ts        # 결제 링크 생성/취소/재발송/토큰 검증
│   ├── queries.ts        # 결제 링크 통계/목록/미결제 목록 조회
│   └── delivery.ts       # 알림톡/SMS 발송 (링크 알림, 영수증, 만료 리마인더)
├── services/
│   └── reminderService.ts # D-3 사전 알림 + D+3/7/14 연체 독촉 (cron)
└── sms/
    └── templates.ts       # SMS 메시지 템플릿 (사전/연체/만료)
```

## Enforced Rules

1. **테넌트 소유권 검증 필수**: 모든 쓰기 작업에서 `record.tenant_id !== tenantId` 체크. enrollment/payment_record 접근 시 항상 테넌트 일치 확인.
2. **상태 enum 사용**: 결제 상태는 반드시 `PaymentStatus` 타입, 결제 수단은 `PaymentMethod` 타입 사용. 문자열 리터럴 직접 비교 금지.
3. **할인 정합성**: 금액 직접 수정 시 `original_amount/discount_type/discount_value`를 null로 초기화. 할인 후 금액 0원 이하 방지 검증 필수.
4. **중복 발송 방지**: reminderService는 `reminder_sent_at` JSONB 키(pre_due, overdue_3 등)로 중복 체크. 결제 링크 생성 시 기존 active 링크 자동 만료 처리.
5. **토스 API 에러 격리**: 토스 API 환불/발급 성공 후 DB 업데이트 실패 시, "API는 성공했으나 DB 실패" 메시지 반환. 토스 상태 동기화는 `syncTossPaymentStatusAction`으로 별도 복구.
6. **billing_type 분기**: 자동 청구(cron)에서 `manual`은 제외, `one_time`은 기존 청구 여부로 스킵, `recurring`은 billing_period 중복 체크.
7. **adminClient 전용 쓰기**: 결제/청구 관련 INSERT/UPDATE/DELETE는 반드시 `createSupabaseAdminClient()` 사용 (RLS 우회). 학부모 조회만 `createSupabaseServerClient()` 허용.

## DB Tables
- `payment_records` - 수납 기록 (핵심 테이블)
- `payment_orders` - 일괄 결제 주문 (토스 배치 결제)
- `payment_links` - 게스트 결제 링크
- `enrollments` / `programs` - 수강/프로그램 (참조)
- `tenants` - 기관 설정 (`settings.billing` JSONB)

## API Routes
- `POST /api/payments/toss/confirm` - 토스 결제 승인 (로그인 사용자)
- `POST /api/payments/toss/confirm-guest` - 게스트 결제 승인 (결제 링크)
- `POST /api/payments/toss/webhook` - 토스 웹훅 수신
- `GET /api/cron/auto-billing` - 자동 청구 생성 (daily cron)
- `GET /api/cron/payment-reminders` - 결제 알림 발송 (daily cron)
- `GET /api/cron/payment-link-maintenance` - 만료 링크 정리 (daily cron)

## Tests
```bash
pnpm test app/api/payments/__tests__/toss-routes.test.ts
pnpm test app/api/cron/__tests__/cron-routes.test.ts
```
도메인 단위 테스트 없음 (API route 통합 테스트만 존재).

## Related Domains
- `enrollment` / `notification` / `sms`: 수강 정보 참조, SMS/알림톡 발송
- `parent`: 학부모 연결 학생 조회 (`getLinkedStudents`)
- `lib/services/tossPayments`: 토스페이먼츠 API 클라이언트 (결제 승인/취소/현금영수증)
- `lib/services/smsService` / `alimtalkService`: 메시지 발송 인프라
