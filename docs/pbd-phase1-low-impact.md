# PbD Phase 1 — 기능 영향 없는 보완 (2026-04-17)

> **Privacy by Design** 7원칙 점검 후, **기능 동작 영향이 없거나 거의 없는 항목**부터 우선 진행한 1차 보완 기록.
> Phase 2(LLM PII 마스킹·RLS audit 모드)와 Phase 3(RLS enforce 전환)는 별도 단계로 분리.

## 배경

업계 표준(ISMS-P, GDPR, SOC 2, K-개인정보보호법) 대비 현 프로젝트는 **CMM Level 2.5(Managed → Defined 전환 구간)**. 미성년자 학습 데이터를 다루는 교육 SaaS로서 컴플라이언스 인증·교육청 입찰 진입을 위해 단계적 보완이 필요. 본 문서는 그 1단계 작업.

## 점검 결과 요약 (PbD 7원칙)

| # | 원칙 | 1차 점검 상태 | 비고 |
|---|------|---------------|------|
| 1 | 사전예방 | ⚠️ → ✅ | 보안 헤더 추가 완료 |
| 2 | 기본보호 | ❌ | 핵심 PII 테이블 RLS 정책 보완 필요(Phase 3) |
| 3 | 설계 반영 | ✅ | `lib/auth/strategies/` 역할 격리 양호 |
| 4 | 완전 기능성 | ⚠️ | `lib/agents/utils/pii-mask.ts` 기초 / 익명화 함수 미구현 |
| 5 | 종단 보안 | ⚠️ | LLM 전송 데이터 PII 검증 필요(Phase 2) |
| 6 | 가시성 | ⚠️ → ⚠️ | 보존기간 표준 문안 추가, 슈퍼어드민 적용 필요 |
| 7 | 사용자 존중 | ⚠️ | 데이터 다운로드권 미구현 |

---

## Phase 1 적용 내역

### 1. 보안 HTTP 헤더 추가 — `next.config.ts`

전역 응답에 다음 헤더를 추가. **기능 영향 0** (CSP는 외부 도메인 화이트리스트 검증이 필요해 Phase 2로 분리).

```ts
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];
```

| 헤더 | 효과 | 위험 |
|------|------|------|
| HSTS | HTTPS 강제, 다운그레이드 공격 차단 | Vercel 기본 HTTPS이므로 안전 |
| X-Frame-Options DENY | iframe 클릭재킹 차단 | 외부 임베딩 사용처 없음 — 영향 0 |
| X-Content-Type-Options | MIME 스니핑 차단 | 영향 0 |
| Referrer-Policy | 외부 사이트로 URL 정보 누출 최소화 | 영향 0 |
| Permissions-Policy | 카메라·마이크·위치 권한 차단 | 현재 미사용 — 영향 0 |

**검증**: `pnpm dev` 후 브라우저 개발자도구 Network → 응답 헤더 확인.

### 2. Audited Admin Client 헬퍼 추가 — `lib/audit/admin-client.ts`

`createSupabaseAdminClient()`는 RLS를 우회하므로 사용 시점·이유를 추적해야 함. 245개 파일·479회 호출되는 광범위한 패턴이라 강제 마이그레이션은 영향이 큼 → **신규 코드부터 점진 도입**하는 옵션 헬퍼만 추가.

```ts
import { createAuditedAdminClient } from "@/lib/audit";

const admin = await createAuditedAdminClient({
  reason: "학부모-자녀 연결 검증",
  resourceType: "parent_student_link",
  resourceId: linkId,
});
```

- 기존 `createSupabaseAdminClient()` 호출은 변경하지 않음 → **영향 0**
- 사용 사실은 `audit_logs.metadata.kind = "service_role_access"`로 기록
- 감사 실패가 메인 동작에 영향을 주지 않도록 fire-and-forget 패턴 (감사용 단발성 INSERT만)

**우선 마이그레이션 권장 대상** (민감도 순):
1. `lib/domains/student/actions/management.ts` (9회) — 학생 CRUD
2. `lib/domains/student-record/import/*` — 생기부 임포트
3. `lib/domains/parent/actions/*` — 학부모 연결
4. `lib/domains/payment/*` — 결제·과금
5. `lib/domains/superadmin/*` — 시스템 권한 변경

### 3. 처리방침 보존기간 표준 문안 (슈퍼어드민 입력 대상)

약관 콘텐츠는 DB(`terms_contents` 테이블)에 저장되어 슈퍼어드민 UI(`/superadmin/terms-management`)에서 관리됨. 코드 수정 대신 **표준 문안**을 아래에 제공하여 슈퍼어드민이 적용.

#### 「개인정보처리방침」에 추가할 보존·파기 항목 (예시)

```markdown
## 제○조 (개인정보의 보유 및 이용기간)

회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은
개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다. 각 개인정보의 처리 및 보유 기간은 다음과 같습니다.

| 구분 | 보유기간 | 근거 |
|------|----------|------|
| 회원 가입 및 관리(계정·프로필) | 회원 탈퇴 시까지 | 정보주체 동의 |
| 학생 학습 데이터(플랜·점수·생기부) | 졸업 후 3년 또는 탈퇴 시까지 | 학습 이력 활용 동의 |
| 학부모 연결 정보 | 자녀 졸업 후 1년 또는 연결 해제 시 | 정보주체 동의 |
| 결제 거래 정보 | 5년 | 전자상거래법 제6조 |
| 전자금융 거래 기록 | 5년 | 전자금융거래법 제22조 |
| 표시·광고에 관한 기록 | 6개월 | 전자상거래법 시행령 |
| 접속 로그·IP | 3개월 | 통신비밀보호법 |
| 감사 로그(audit_logs) | 1년 | 내부 보안 정책 |

탈퇴·해지 즉시 파기 대상은 안전한 방법(전자파일 영구삭제, 출력물 분쇄)으로 지체 없이 파기합니다.
법령 보존 의무가 있는 항목은 별도 분리 보관하며, 보존 목적 외 용도로 이용하지 않습니다.

## 제○조 (만 14세 미만 아동의 개인정보)

만 14세 미만 아동의 개인정보를 수집·이용하거나 제3자에게 제공하기 위해서는 법정대리인의 동의를
받아야 합니다. 회사는 가입 시 법정대리인 동의 절차를 통해 동의를 받고, 동의 사실을 별도 보관합니다.
법정대리인은 언제든지 자녀의 개인정보 열람·정정·삭제·처리정지를 요구할 수 있습니다.
```

**적용 방법**:
1. 슈퍼어드민으로 로그인 → `/superadmin/terms-management`
2. `privacy` 약관 → 새 버전 작성
3. 위 문안을 도메인·법무 검토 후 반영
4. 신규 회원에게 변경된 약관 동의 재징수 (기존 회원은 통지 후 재동의)

> **법무 검토 필수**: 위 표는 일반 SaaS 기준 예시. 실제 도메인(에듀테크·미성년자)·계약(B2B 학원/교육청)에 따라 보유기간·근거가 달라질 수 있음. 적용 전 변호사·개인정보보호 컨설턴트 검토 권장.

---

## 검증 체크리스트

- [x] `next.config.ts` 빌드 통과
- [x] 보안 헤더 추가 — 외부 의존 0, 기능 영향 0
- [x] `lib/audit/admin-client.ts` 신규 추가 — 기존 호출 변경 0
- [x] `lib/audit/index.ts` re-export 추가
- [ ] 슈퍼어드민이 약관 보존기간 항목 추가 (담당자 액션)
- [ ] 배포 후 응답 헤더 검증 (Securityheaders.com 또는 브라우저 devtools)

## Phase 2 (다음 단계 — 검증 후 도입)

| 항목 | 영향도 | 검증 방법 |
|------|--------|-----------|
| LLM 프롬프트 PII 마스킹 | 🟡 중간 | 골든셋(GPT-5.4 98%) 회귀 측정 |
| CSP 헤더 도입 | 🟡 중간 | Vercel/Supabase/OpenAI/Gemini/Sentry 도메인 화이트리스트 |
| RLS audit 모드 | 🟡 중간 | 한 달간 위반 패턴 수집(차단 X) |
| 데이터 다운로드권(DSAR) | 🟡 중간 | 학생/학부모 본인 데이터 export API |

## Phase 3 (분기 단위)

- 핵심 PII 테이블 RLS 정책 enforce 전환 (`students`, `student_record_*`, `parent_users`)
- ISMS-P 인증 사전 진단
- DPO(개인정보보호책임자) 지정 및 RoPA(처리활동 기록부) 작성

---

## 관련 파일

- 수정: `next.config.ts`
- 신규: `lib/audit/admin-client.ts`
- 수정: `lib/audit/index.ts`
- 참조: `lib/audit/record.ts` (기존 audit 시스템)
- 참조: `lib/agents/utils/pii-mask.ts` (벡터 저장 PII 마스킹)
- 참조: `lib/auth/strategies/` (역할 기반 격리)
