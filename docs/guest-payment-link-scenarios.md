# 게스트 결제 링크 시스템 — 시나리오 문서

## 시스템 개요

관리자가 미결제 수강료에 대한 결제 링크를 생성하여 학부모에게 SMS/카카오 알림톡으로 발송하면, 학부모가 **로그인 없이** 링크를 열어 즉시 결제할 수 있는 시스템.

### 핵심 구성

| 구분 | 경로 | 설명 |
|------|------|------|
| 게스트 결제 페이지 | `/pay/[token]` | 비인증 공개 페이지 |
| 결제 승인 API | `/api/payments/toss/confirm-guest` | 토큰 기반 검증 (인증 불필요) |
| 관리자 링크 생성 | 학생 상세 > 수납 내역 | 개별 결제 링크 생성 |
| 관리자 대시보드 | `/admin/billing/payment-links` | 전체 링크 관리 + 일괄 발송 |
| 자동 유지보수 Cron | `/api/cron/payment-link-maintenance` | 만료 처리 + 리마인더 |

---

## 시나리오 1: 개별 결제 링크 생성 및 발송

### 사전조건
- 관리자(admin) 또는 상담사(consultant)로 로그인
- 해당 학생에 미결제(unpaid) 또는 부분결제(partial) payment_record 존재

### 플로우

```
관리자: 학생 상세 페이지 → 수납 내역 탭
  │
  ├─ 미결제 행의 액션 메뉴 → "결제 링크 보내기" 클릭
  │
  ▼
[PaymentLinkCreateModal 열림]
  │
  ├─ 발송 방법 선택: SMS / 알림톡 / 링크만 생성
  ├─ 수신자 전화번호 입력 (SMS/알림톡 선택 시)
  ├─ 유효기간 선택: 72시간(기본) / 7일 / 30일
  │
  ├─ "생성" 클릭
  │
  ▼
[Server Action: createPaymentLinkAction]
  │
  ├─ 1. 권한 검증 (requireAdminOrConsultant)
  ├─ 2. payment_record 상태 확인 (paid/refunded/cancelled → 거부)
  ├─ 3. 잔액 계산 (amount - paid_amount)
  ├─ 4. 기존 active 링크 자동 취소 (1 record = 1 active link)
  ├─ 5. nanoid(21) 토큰 생성
  ├─ 6. payment_links 레코드 INSERT (비정규화 데이터 포함)
  ├─ 7. 알림 발송 (비동기, 실패해도 링크 생성은 성공)
  │     ├─ alimtalk → 카카오 알림톡 (SMS 자동 fallback)
  │     └─ sms → 뿌리오 SMS 직접 발송
  │
  ▼
[모달에 결과 표시]
  ├─ 생성된 URL 표시 + 복사 버튼
  └─ 발송 상태 표시
```

### 발송 메시지 예시

```
[에듀아톡학원] 수강료 결제 안내

학생: 김철수
프로그램: 수학 기본반
결제금액: 350,000원

아래 링크에서 결제해 주세요.
https://timelevelup.com/pay/abc123def456...
```

---

## 시나리오 2: 학부모 게스트 결제 (정상 플로우)

### 사전조건
- 학부모가 SMS/알림톡으로 결제 링크 수신
- 결제 링크 상태: active, 미만료

### 플로우

```
학부모: 메시지의 결제 링크 클릭
  │
  ▼
[/pay/{token} — Server Component]
  │
  ├─ validatePaymentLinkToken(token) 호출
  │   ├─ 토큰 조회
  │   ├─ view_count 증가 (SQL RPC, race condition 방지)
  │   ├─ 상태/만료 검증
  │   ├─ payment_record 상태 확인
  │   └─ toss_order_id 생성 또는 기존 값 사용
  │
  ├─ 검증 통과 → GuestPaymentContent 렌더링
  │
  ▼
[게스트 결제 페이지 표시]
  │
  ├─ 학원명, 학생명, 프로그램명, 결제금액, 납부기한 표시
  ├─ 토스페이먼츠 위젯 (ANONYMOUS 모드) 렌더링
  │   ├─ 카드 결제
  │   ├─ 간편결제 (카카오페이, 네이버페이 등)
  │   └─ 계좌이체
  │
  ├─ 결제수단 선택 → 결제 진행
  │
  ▼
[토스 결제 완료 콜백 → confirm-guest API 호출]
  │
  ├─ POST /api/payments/toss/confirm-guest
  │   ├─ 1. 토큰으로 payment_links 조회
  │   ├─ 2. 링크 상태 검증 (active 여부)
  │   ├─ 3. 만료 시간 검증
  │   ├─ 4. 금액 검증 (링크 금액 = 요청 금액)
  │   ├─ 5. payment_record 상태 확인 (이미 paid → 거부)
  │   ├─ 6. orderId 일치 확인
  │   ├─ 7. 토스 API 결제 승인 (confirmTossPayment)
  │   ├─ 8. payment_records 업데이트 (status, paid_amount, toss_* 필드)
  │   ├─ 9. payment_links 업데이트 (status=completed, paid_at)
  │   └─ 10. 영수증 알림 비동기 발송 (알림톡/SMS)
  │
  ▼
[GuestPaymentSuccess 화면 표시]
  ├─ "결제가 완료되었습니다" 메시지
  ├─ 학원명, 프로그램, 결제금액 확인
  └─ 영수증 확인 링크 (토스 제공)
```

### 영수증 알림 메시지 예시

```
[에듀아톡학원] 결제 완료 안내

학생: 김철수
프로그램: 수학 기본반
결제금액: 350,000원

결제가 정상적으로 완료되었습니다.

영수증 확인: https://dashboard.tosspayments.com/receipt/...
```

---

## 시나리오 3: 만료된 링크 접속

### 플로우

```
학부모: 만료된 결제 링크 클릭
  │
  ▼
[validatePaymentLinkToken]
  ├─ expires_at < now → status를 "expired"로 업데이트
  └─ { valid: false, reason: "expired" } 반환
  │
  ▼
[GuestPaymentExpired 화면]
  └─ "결제 링크가 만료되었습니다. 학원에 문의하여 새 링크를 요청해 주세요."
```

---

## 시나리오 4: 이미 결제된 링크 재접속

### 플로우

```
학부모: 이전에 결제 완료한 링크 재클릭
  │
  ▼
[validatePaymentLinkToken]
  ├─ link.status === "completed" → { valid: false, reason: "completed" }
  │  또는
  └─ payment_record.status === "paid" → link를 completed로 업데이트
     → { valid: false, reason: "payment_completed" }
  │
  ▼
[GuestPaymentAlreadyPaid 화면]
  └─ "이미 결제가 완료된 건입니다."
```

---

## 시나리오 5: 취소된 링크 접속

### 플로우

```
학부모: 관리자가 취소한 링크 클릭
  │
  ▼
[validatePaymentLinkToken]
  └─ link.status === "cancelled" → { valid: false, reason: "cancelled" }
  │
  ▼
[GuestPaymentExpired 화면]
  └─ "이 결제 링크는 취소되었습니다. 학원에 문의해 주세요."
```

---

## 시나리오 6: 일괄 결제 링크 발송

### 사전조건
- 관리자 로그인 상태
- 2건 이상의 미결제 payment_record 존재

### 플로우

```
관리자: /admin/billing/payment-links → "일괄 링크 발송" 클릭
  │
  ▼
[BulkPaymentLinkModal 열림]
  │
  ├─ 미결제 목록 자동 로드 (getUnpaidRecordsForBulkAction)
  │   ├─ 학생명, 프로그램명, 잔액, 납부기한 표시
  │   └─ 이미 active 링크가 있는 건은 비활성 (선택 불가)
  │
  ├─ 발송 설정
  │   ├─ 발송 방법: SMS / 알림톡 / 링크만 생성
  │   ├─ 수신 전화번호 (공통, SMS/알림톡 시)
  │   └─ 유효기간: 72시간 / 7일 / 30일
  │
  ├─ 대상 선택 (체크박스, 전체 선택 가능)
  │
  ├─ "{N}건 발송" 클릭
  │
  ▼
[순차 처리 + 프로그레스 바]
  │
  ├─ 각 건마다 createPaymentLinkAction 호출
  ├─ 200ms 간격 (rate limit 방지)
  ├─ 진행률 실시간 표시: "3 / 10건 처리 중..."
  ├─ 실패 건 카운트 표시
  │
  ▼
[완료 토스트]
  ├─ 전체 성공: "10건의 결제 링크가 생성되었습니다."
  └─ 부분 실패: "8건 성공, 2건 실패"
```

---

## 시나리오 7: 결제 링크 관리 대시보드

### 플로우

```
관리자: 사이드바 → 수납관리 → 결제 링크
  │
  ▼
[/admin/billing/payment-links]
  │
  ├─ KPI 카드 (4개)
  │   ├─ 전체 링크 수
  │   ├─ 활성 (발송됨) 수
  │   ├─ 결제 완료 수 + 결제 금액
  │   └─ 전환율 (completed / total × 100)
  │
  ├─ 필터
  │   ├─ 상태: 전체 / 활성 / 결제완료 / 만료 / 취소
  │   └─ 검색: 학생명, 프로그램명, 전화번호
  │
  ├─ 테이블 (각 행)
  │   ├─ 학생 | 프로그램 | 금액 | 상태뱃지 | 발송방법+상태
  │   ├─ 조회수 | 유효기간(남은시간/만료됨) | 생성일
  │   └─ 액션 메뉴: 링크 복사 / 재발송 / 취소
  │
  ▼
[액션 — 링크 복사]
  └─ navigator.clipboard에 결제 URL 복사

[액션 — 재발송] (active 링크만)
  ├─ resendPaymentLinkAction(linkId)
  ├─ 만료 여부 재확인
  └─ 동일 발송 방법으로 재발송

[액션 — 취소] (active 링크만)
  ├─ cancelPaymentLinkAction(linkId)
  └─ status → cancelled
```

---

## 시나리오 8: 자동 유지보수 (Cron)

### 실행 시점
- 매일 00:00 UTC (09:00 KST)
- `/api/cron/payment-link-maintenance`

### 플로우

```
[Cron 실행]
  │
  ├─ Step 1: 만료 처리
  │   ├─ WHERE status = 'active' AND expires_at < now()
  │   └─ UPDATE status = 'expired'
  │   → 결과: {N}건 만료 처리
  │
  ├─ Step 2: 만료 임박 리마인더
  │   ├─ WHERE status = 'active'
  │   │   AND expires_at BETWEEN now() AND now() + 24h
  │   │   AND recipient_phone IS NOT NULL
  │   │   AND delivery_method != 'manual'
  │   │
  │   ├─ 각 링크에 리마인더 발송 (sendPaymentLinkExpiryReminder)
  │   └─ 200ms 간격 (rate limit 방지)
  │   → 결과: {N}건 리마인더 발송, {N}건 실패
  │
  ▼
[응답 로그]
  {
    "expired": 5,
    "reminderSent": 3,
    "reminderFailed": 0
  }
```

### 리마인더 메시지 예시

```
[에듀아톡학원] 결제 링크 만료 안내

학생: 김철수
프로그램: 수학 기본반
결제금액: 350,000원

결제 링크가 오늘 만료됩니다.
아래 링크에서 결제해 주세요.
https://timelevelup.com/pay/abc123def456...
```

---

## 시나리오 9: 만료 후 재생성

### 플로우

```
관리자: 학생 상세 > 수납 내역
  │
  ├─ 만료된 결제 건의 액션 메뉴 → "결제 링크 보내기"
  │
  ▼
[createPaymentLinkAction]
  ├─ 기존 active 링크가 없으므로 취소 단계 스킵
  ├─ 새 토큰 생성
  ├─ 새 payment_link INSERT
  └─ 알림 발송
```

> 동일 payment_record에 대해 여러 링크가 생성될 수 있으나, **active 상태는 항상 최대 1개**로 유지된다.

---

## 보안 검증 매트릭스

| 공격 시나리오 | 방어 수단 | 검증 위치 |
|--------------|-----------|-----------|
| 토큰 무차별 대입 | nanoid(21) = 4e37 경우의 수 | 토큰 생성 시 |
| 금액 변조 | 서버에서 링크 금액과 요청 금액 비교 | confirm-guest API Step 3 |
| 만료 토큰 재사용 | expires_at 서버 검증 | confirm-guest API Step 2 |
| 이중 결제 | payment_record.status 확인 | confirm-guest API Step 4 |
| 취소된 링크 사용 | link.status !== "active" 거부 | confirm-guest API Step 2 |
| orderId 불일치 | toss_order_id 매칭 검증 | confirm-guest API Step 5 |
| view_count 경쟁 | SQL RPC increment (원자적) | validatePaymentLinkToken |
| 타 테넌트 링크 조작 | RLS + tenant_id 검증 | 모든 admin action |

---

## 상태 전이 다이어그램

```
                    ┌──────────────────┐
                    │     active       │
                    └──────┬───────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  completed  │ │  expired   │ │ cancelled  │
     │ (결제 완료) │ │ (기한 만료) │ │ (관리자 취소)│
     └────────────┘ └────────────┘ └────────────┘

  트리거:            트리거:           트리거:
  - 결제 승인 성공   - cron 자동 처리   - cancelPaymentLinkAction
  - confirm-guest   - 접속 시 실시간    - 새 링크 생성 시
    API 성공          만료 감지           기존 링크 자동 취소
```

---

## 파일 구조

```
lib/domains/payment/paymentLink/
├── types.ts          # PaymentLink, GuestPaymentData, Status/Method 타입
├── actions.ts        # create, cancel, resend, validate, getForRecord
├── queries.ts        # stats, filtered list, unpaid records (대시보드용)
└── delivery.ts       # 알림 발송 (링크/영수증/만료 리마인더)

app/pay/[token]/
├── page.tsx                          # Server Component (토큰 검증 → 분기)
└── _components/
    ├── GuestPaymentContent.tsx       # 결제 위젯 (토스페이먼츠)
    ├── GuestPaymentSuccess.tsx       # 결제 완료 화면
    ├── GuestPaymentExpired.tsx       # 만료/취소 화면
    └── GuestPaymentAlreadyPaid.tsx   # 이미 결제 완료 화면

app/api/payments/toss/confirm-guest/
└── route.ts          # 비인증 결제 승인 API

app/(admin)/admin/billing/payment-links/
├── page.tsx
└── _components/
    ├── PaymentLinkDashboardClient.tsx  # KPI + 필터 + 테이블
    ├── PaymentLinksTable.tsx           # 링크 목록 테이블
    └── BulkPaymentLinkModal.tsx        # 일괄 발송 모달

app/(admin)/admin/students/[id]/_components/
├── PaymentLinkCreateModal.tsx    # 개별 링크 생성 모달
└── PaymentLinkStatusBadge.tsx    # 상태 뱃지

app/api/cron/payment-link-maintenance/
└── route.ts          # 자동 만료 + 리마인더 cron
```
