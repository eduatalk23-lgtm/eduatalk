# 학생-대면 자율 에이전트 설계 (MVP)

> **Status**: Draft v1 (2026-04-20)
> **Scope**: 학생이 자율 AI 에이전트와 직접 대화하며 생기부를 공동 작성하는 기능의 MVP 설계
> **관련 메모리**:
> - `student-facing-agent-direction.md` (4축 권장안)
> - `student-facing-agent-research-2026-04-20.md` (리서치 근거)
> - `feedback_student-agent-opt-in-gate.md` (opt-in 원칙)
> - `agent-blueprint-gap-cycle-roadmap.md` (기반 로드맵)

---

## 1. 제품 정체성

### 한 문장 정의
학종 도메인에 깊게 뿌리내린 컨설턴트-증강 AI로, 허용된 학생에 한해 **3자 투명성** 아래 자율 대화를 열되, 한국 중심으로 COPPA 호환 스키마까지 설계하는 플랫폼.

### 핵심 원칙 5
1. **3자 투명성** — 학생·AI·컨설턴트·학부모 중 누구도 숨은 행위자가 아니다
2. **Opt-in Gate** — 자율 대면은 권한 허용 학생만 (전체 개방 금지)
3. **도메인 우위** — "합격 예측 %"가 아니라 학종 평가 프레임워크를 학생 언어로 번역
4. **법적 우선** — 한국 19세 미만 보호자 동의 + COPPA 2026 호환 스키마 기본 탑재
5. **Hybrid 승리** — Pure autonomous 지양, 컨설턴트 curation 레이어 상시 작동

### 비타협 항목
- AI 라벨 학생 직접 노출 금지 (`feedback_no-ai-label-student`)
- 미성년자 대상 AI 기능에 대한 보호자 동의 없이 active 모드 활성화 금지
- Observer Protocol 비활성 상태에서 학생-AI 자율 대화 금지
- 유해발화/자해/폭력 필터 미배포 상태에서 학생 대면 금지

---

## 2. 권한 모델 (3단계 + 3자 동의)

### 2.1 `ai_agent_access` 3단계

| 단계 | 학생 관점 | AI 관점 | 동의 조건 |
|---|---|---|---|
| `disabled` | AI 기능 완전 차단, 기존 컨설턴트 채널만 | 학생 데이터 접근·분석 불가 | — |
| `observer` | AI 존재 인지, 컨설턴트 증강된 조언 수령 | 학생 데이터 분석 OK, 학생 직접 대화 X | 일반 가입 약관 |
| `active` | AI와 직접 대화, 자율 제안 수용 가능 | Observer Protocol 상시 작동 하에 학생 직접 대면 | **3자 전자 서명** (학생+학부모+컨설턴트) |

### 2.2 Revoke 규칙
- **학부모**: 단독으로 즉시 `observer` 또는 `disabled` 강등 가능
- **컨설턴트**: 단독으로 즉시 `observer` 강등 가능 (대화 이상 징후 발견 시)
- **AI 자가 판단**: 신뢰 스코어 급락 시 `observer` 강등 **제안** (컨설턴트 최종 승인)
- **학생**: 단독으로 `disabled` 전환 가능 (본인 권리)

### 2.3 Scope 세분화 (active 모드 내부)
`ai_consent_grants.scope` JSONB 필드:
```json
{
  "dialogue": true,           // AI와 대화
  "proposal_acceptance": true, // AI 제안 수락 권한
  "autonomous_suggestion": false, // AI 선제 제안 허용
  "voice_input": false,       // 음성 입력 (COPPA biometric)
  "ai_training": false        // AI 훈련 데이터 활용 (COPPA 별도 동의)
}
```

---

## 3. 데이터 스키마

### 3.1 `student_ai_access` (신규)
```sql
CREATE TABLE public.student_ai_access (
  student_id UUID PRIMARY KEY REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'disabled'
    CHECK (access_level IN ('disabled', 'observer', 'active')),
  granted_at TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id),    -- 최종 승인자
  last_revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_student_ai_access_level ON public.student_ai_access (access_level);
CREATE INDEX idx_student_ai_access_tenant ON public.student_ai_access (tenant_id);
```

**Why 별도 테이블**: `students.status` 는 enrolled/not_enrolled 2단계로 단순화되어 있음. AI 권한은 별개 축이므로 오염 금지.

### 3.2 `ai_consent_grants` (신규, COPPA 호환)
```sql
CREATE TABLE public.ai_consent_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  granted_level TEXT NOT NULL
    CHECK (granted_level IN ('observer', 'active')),
  scope JSONB NOT NULL DEFAULT '{}',

  -- 3자 서명
  student_signed_at TIMESTAMPTZ,
  student_user_id UUID REFERENCES auth.users(id),
  parent_signed_at TIMESTAMPTZ,
  parent_user_id UUID REFERENCES public.parent_users(id),
  consultant_signed_at TIMESTAMPTZ,
  consultant_user_id UUID REFERENCES auth.users(id),

  -- 문서/근거
  consent_document_url TEXT,
  consent_version TEXT NOT NULL,  -- "ko-2026-07-v1" 같은 버전
  ip_address_hash TEXT,            -- 무결성 증빙 (원본 저장 금지)

  -- 생애주기
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,          -- 기한 제한 동의 지원
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,

  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- active 는 3자 서명 필수
  CHECK (
    granted_level = 'observer'
    OR (student_signed_at IS NOT NULL
        AND parent_signed_at IS NOT NULL
        AND consultant_signed_at IS NOT NULL)
  )
);

CREATE INDEX idx_ai_consent_student ON public.ai_consent_grants (student_id, effective_at DESC);
CREATE INDEX idx_ai_consent_active ON public.ai_consent_grants (student_id)
  WHERE revoked_at IS NULL;
```

### 3.3 `ai_agent_dialogue_log` (신규, audit 확장)
기존 `agent_audit_logs` 는 메타데이터만 기록. 학생 대면은 **대화 내용 7년 보존** 필요.
```sql
CREATE TABLE public.ai_agent_dialogue_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id),
  turn_index INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content_masked TEXT NOT NULL,  -- PII 마스킹 후 저장
  content_hash TEXT NOT NULL,     -- 원본 무결성
  confidence_score NUMERIC(3,2),  -- AI 자가 신뢰도
  moderation_flags JSONB,          -- 유해발화/자해/폭력 감지 결과
  observer_notified_at TIMESTAMPTZ[],  -- Observer에게 알림된 시각
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7년 보존 (입시 결과 피드백 루프 대비)
-- 삭제는 파티션 기반 또는 주기 배치로 (COPPA "as soon as reasonably practicable" 대응)
```

### 3.4 RLS 정책 핵심
```sql
-- Observer Protocol: 학생 본인 + 부모 + 담당 컨설턴트 모두 읽기
CREATE POLICY "ai_dialogue_observer_read" ON public.ai_agent_dialogue_log
  FOR SELECT USING (
    -- 학생 본인
    student_id = (SELECT auth.uid())
    -- 부모 (parent_users 재활용)
    OR EXISTS (
      SELECT 1 FROM public.parent_users pu
      WHERE pu.id = (SELECT auth.uid())
        AND pu.student_id = ai_agent_dialogue_log.student_id
    )
    -- 담당 컨설턴트
    OR EXISTS (
      SELECT 1 FROM public.consultant_assignments ca
      WHERE ca.consultant_id = (SELECT auth.uid())
        AND ca.student_id = ai_agent_dialogue_log.student_id
    )
  );
```

---

## 4. UX 플로우

### 4.1 Onboarding 플로우 (disabled → observer)
```
1. 학생 가입 → 기본 access_level = 'disabled'
2. 컨설턴트가 어드민에서 학생에게 'observer' 승격 요청
3. 학생(또는 부모)이 가입 약관 + AI 분석 동의 체크
4. 즉시 observer 활성
   → 대시보드에 "학종 관점 분석" 섹션 표시
   → 컨설턴트 채팅에서 AI 증강 조언 수령 가능
```

### 4.2 Observer → Active 승격 플로우
```
1. 컨설턴트/학생/학부모 중 누구든 "자율 대화 활성 요청"
2. ConsentWizard 모달 진입
   Step 1: 학생 본인 서명 (auth.users 세션)
   Step 2: 학부모 서명 링크 발송 → parent_users 인증
   Step 3: 담당 컨설턴트 서명 (비동기, 48시간 내)
3. 3자 서명 완료 → ai_consent_grants 레코드 생성 (active)
4. student_ai_access.access_level = 'active' 승격
5. /chat 경로에서 자율 에이전트 모드 활성화 알림
```

### 4.3 학생 자율 대화 (active 모드)
```
학생: "이번 주 봉사 다녀왔어"
  ↓
[AI 내부 처리]
  - Moderation Layer 필터 통과
  - dialogue_log 기록 (content_masked)
  - Perception Scheduler 이벤트 생성
  - Epistemic Uncertainty 측정 (Gemini vs GPT-5.4 disagreement)
  ↓
AI: "환경 관련 활동이었네요. 이전에 말한 환경공학 진로랑 연결될 것 같은데,
     어떤 점이 가장 인상적이었어요?"
     (confidence: 0.87 / moderation: clean / observer notified)
  ↓
[백그라운드]
  - Observer 채널에 실시간 스트림 (컨설턴트·부모 Read 가능)
  - α4 Proposal Engine trigger: "봉사 세특 주제 제안 Drawer 생성"
  - 컨설턴트가 Drawer 에서 제안 curation 후 최종 전달
```

### 4.4 Revoke 플로우
```
[케이스 A: 부모 Revoke]
부모 대시보드 → AI 권한 설정 → "자율 대화 중지"
  → ai_consent_grants.revoked_at 즉시 설정
  → student_ai_access.access_level = 'observer' 강등
  → 다음 학생 메시지 차단, "권한이 변경되었습니다" 고지

[케이스 B: AI 자가 강등 제안]
AI Epistemic Uncertainty 3회 연속 > 0.4
  → 컨설턴트에게 "자율 모드 중지 제안" 알림
  → 컨설턴트가 단독 승인 → observer 강등
```

---

## 5. 구현 아키텍처

### 5.1 재활용 (이미 있음)
- `lib/agents/orchestrator.ts` — 11 tool + memory 주입, 학생 컨텍스트로 확장
- `lib/agents/tools/*` — 대부분 재활용, 학생 role 분기만 추가
- `app/api/agent/route.ts` — stepCountIs(12/16), 55s timeout, maxRetries:1 기반
- `lib/mcp/*` — MCP 서버 + 8 tool 그대로 재활용
- `lib/agents/memory/correction-service.ts` — 컨설턴트 교정 피드백 학습 그대로
- `parent_users` 테이블 + RLS — Observer 주체로 재활용
- `α4 Proposal Engine` — active 모드 trigger 연결

### 5.2 신규 모듈

#### 5.2.1 `lib/agents/student-mode/`
```
lib/agents/student-mode/
├── access-guard.ts          # access_level 체크 + Higher-Order 가드
├── consent-wizard.ts        # 3자 동의 플로우 서버 액션
├── metacognitive-prompts.ts # "왜 그렇게 생각해?" 유도 프롬프트
├── domain-translator.ts     # "학종 관점 점수" 학생 언어 번역
└── __tests__/
```

#### 5.2.2 `lib/agents/moderation/`
```
lib/agents/moderation/
├── content-filter.ts        # 유해발화/자해/폭력 필터 (한국 기준)
├── self-harm-detector.ts    # 자해/위기 감지 → 즉시 컨설턴트 알림
└── __tests__/
```

#### 5.2.3 `lib/agents/reliability/`
```
lib/agents/reliability/
├── epistemic-uncertainty.ts # 다중 LLM disagreement 측정
├── self-assessment.ts       # "이건 컨설턴트 확인 필요" 선언
└── __tests__/
```

#### 5.2.4 `app/(student)/chat/` 승격
기존 `/chat` 경로에 mode 분기 추가:
```typescript
// app/(student)/chat/page.tsx
const access = await getStudentAIAccess(studentId);

if (access.level === 'disabled') {
  return <ConsultantOnlyChatFallback />;
}
if (access.level === 'observer') {
  return <ObserverModeChatPanel />;  // 컨설턴트 증강 채팅
}
// active
return <AutonomousAgentChatPanel />; // 자율 에이전트 모드
```

#### 5.2.5 Observer Protocol UI
- `app/(consultant)/observer/[studentId]/page.tsx` — 대화 실시간 스트림
- `app/(parent)/ai-oversight/page.tsx` — 부모 관찰 대시보드
- WebSocket 또는 Supabase Realtime 구독

### 5.3 프롬프트 전략

#### 5.3.1 시스템 프롬프트 계층
```
[Base] 기존 orchestrator.ts system prompt (컨설턴트용)
  ↓ student 모드면 오버라이드
[Student Overlay]
  - 톤: 부드러움 + 메타인지 유도
  - "왜 그렇게 생각해?" / "이걸 선택한 이유는?" 빈도 규칙
  - AI 라벨 제거 (feedback_no-ai-label-student)
  - "확실하지 않으면 defer" 규칙 강화
[Domain Translator]
  - "학종 3요소" → "학업역량·진로역량·공동체역량"
  - "청사진 격차" → "내가 세운 계획과 실제 활동의 차이"
  - "Blueprint GAP" → "목표 대비 현재 위치"
```

#### 5.3.2 Confidence Self-Report
매 응답 끝에 AI가 내부적으로 평가:
```json
{
  "confidence": 0.87,
  "defer_to_consultant": false,
  "reason": "과거 유사 사례 3건 일치"
}
```
UI 뱃지:
- ≥0.85: 일반 표시
- 0.6~0.85: "컨설턴트와 확인 권장" 뱃지
- <0.6: 자동 defer, "담당 선생님께 전달드렸어요"

---

## 6. 로드맵

### 6.1 마일스톤 순서 (수정된 최종판)

| # | 마일스톤 | 소요 | Q 연결 | 산출물 |
|---|---|---|---|---|
| **M(-1)** | orchestrator 주석 정리 | 완료 | — | `lib/agents/orchestrator.ts` 헤더 업데이트 |
| **M0** | `student_ai_access` 테이블 + admin UI | 1주 | Q4 | 마이그레이션 + 관리자 권한 부여 UI |
| **M0.5** | `ai_consent_grants` + 3자 서명 플로우 | 1~2주 | Q1, Q4 | ConsentWizard + parent_users 연동 |
| **M1** | α4 Proposal S3+S4 + Phase G S-1~S-3 | 2~3주 | — | 컨설턴트 경로 완성 |
| **M2** | Reliability Self-Assessment | 1~2주 | — | confidence score + defer 패턴 |
| **M2.5** | Moderation Layer (한국 기준) | 1~2주 | Q1 | 유해발화/자해 필터 |
| **M3** | /chat 자율 에이전트 승격 (active 분기) | 2~3주 | Q2 | `AutonomousAgentChatPanel` |
| **M4** | Observer Protocol (부모+컨설턴트 UI) | 2~3주 | Q2 | 실시간 대화 스트림 + 개입 채널 |
| **M4.5** | Epistemic Uncertainty 배선 | 1주 | — | 다중 LLM disagreement 측정 |
| **M5** | Novel Activity Synthesis (hybrid) | 2~3주 | Q3 | 가이드 DB + 창안 하이브리드 |

**총 예상**: 14~18주 (약 4개월)

### 6.2 의존성 그래프
```
M(-1) ✅ done
   ↓
M0 ──→ M0.5 ──→ M3 ──→ M4
                  ↑      ↑
M1 (independent)──┤      │
M2 ──────────────→ M2.5 ─┤
                  M4.5 ──┤
                         ↓
                        M5
```

### 6.3 Rollout Tier

| Tier | 대상 | 규모 | 전환 조건 |
|---|---|---|---|
| Tier 1 | 내부 (직원 자녀·직계) | 5~10 | M3 완료 |
| Tier 2 | 컨설턴트 스폰서 alpha | 20~30 | M4 완료 + 2주 무사고 |
| Tier 3 | 학부모 명시 동의 beta | 100 | Tier 2 + 컨설턴트 만족도 > 4.0/5.0 |
| GA | (보류) | — | admission outcome 데이터 2~3년 축적 |

---

## 7. 차별점 정리 (vs 경쟁사)

| 축 | 바이브온/진학사 | 면접왕 | 입시의기세 | **TimeLevelUp** |
|---|---|---|---|---|
| AI 깊이 | 합격 예측 % | 면접 질답 | AI 없음 | 학종 프레임워크 풀-노출 |
| 학생 대면 | 제한적 | 면접 한정 | 인간만 | 3자 투명성 Opt-in |
| 컨설턴트 통합 | 없음 | 없음 | 24시간 인간 | AI + 컨설턴트 동시 |
| 부모 가시성 | 없음 | 없음 | 별도 리포트 | 실시간 Observer |
| 법적 대응 | 불명 | 불명 | — | COPPA 호환 + 한국 2026.07 |

**우리의 진짜 moat**: 도메인 엔진(Blueprint + GAP + Reward + 가이드 DB 3,000건) + 3자 투명성 + 법적 선제 대응. 이 3개를 동시에 가진 서비스 없음.

---

## 8. 리스크 & 완화

| 리스크 | 완화책 |
|---|---|
| 순수 autonomous PMF 실패 (OpenAI Study Mode 제거 교훈) | Hybrid + Observer 기본 유지, active는 opt-in 소수만 |
| 법적 리스크 (미성년자 AI 조언 오류) | Consent 3자 서명 + 7년 대화 보존 + Moderation + Defer 패턴 |
| 비용 폭주 (자율 에이전트 루프) | 기존 stepCountIs(12/16) + 55s timeout 유지 + 모델별 쿼터 |
| AI 신뢰 과잉 (학생이 생기부를 AI로만 작성) | 메타인지 프롬프트 + 컨설턴트 curation + AI 라벨 학생 비노출 |
| 정부 어디가 챗봇 (무료 경쟁) | 학종 도메인 깊이 + 컨설턴트 연계 + 개인화 유지 |

---

## 9. 미해결 항목 (추가 결정 필요)

1. **Tier 1 학생 선정 기준**: 내부 직원 자녀 우선? 김세린·인제고1 시드 학생 포함?
2. **부모 인증 방식**: `parent_users` 기존 인증 경로 + 별도 2FA?
3. **Consent 문서 버전 관리**: 한국 2026.07 시행 시 일괄 재동의 필요?
4. **Moderation 한국 기준**: 어떤 분류 체계 사용? (자체 룰 vs OpenAI Moderation API vs 한국 KISA 기준)
5. **Observer 알림 빈도**: 실시간 vs 일일 요약? (과도 시 부모 피로)
6. **GA 전환 조건**: admission outcome 2~3년은 너무 보수적인가?

---

## 10. 다음 단계

1. 이 설계 문서 리뷰 완료 → 승인되면 M0 착수 (student_ai_access 테이블 마이그레이션)
2. Moderation 한국 기준 선택 (별도 리서치 필요)
3. ConsentWizard UX 와이어프레임 (디자인 협업)
4. α4 Proposal Engine S3 LLM 실호출 선행 (M1 의존)
