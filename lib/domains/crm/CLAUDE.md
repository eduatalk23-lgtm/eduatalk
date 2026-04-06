# CRM Domain Rules

## Scope
세일즈 리드 관리, 상담 기록, 파이프라인(전환 퍼널), 리드 스코어링, SLA 태스크, 프로그램 관리, 부재 알림 발송.

## Architecture
```
crm/
├── index.ts              # Public API (types + constants + actions)
├── types.ts              # DB 파생 타입 + 비즈니스 타입 (PipelineStatus, ScoreType 등)
├── constants.ts          # 한글 라벨, 스코어링 규칙, AUTO_TASK_RULES, 시드 데이터
└── actions/              # Server Actions (모두 "use server")
    ├── index.ts          # Re-export (28개 액션)
    ├── leads.ts          # 리드 CRUD + markAsSpam
    ├── activities.ts     # 활동 기록 CRUD + 참여도 자동 갱신
    ├── pipeline.ts       # 상태 전이 + 체크리스트 + convertLead + assignLead
    ├── programs.ts       # 프로그램 CRUD + seed + reorder + stats
    ├── scoring.ts        # Fit/Engagement 2축 스코어링 + qualityLevel 판정
    ├── tasks.ts          # SLA 태스크 CRUD + 자동 생성 + overdue 감지
    ├── consultations.ts  # 상담 등록 (리드 자동 생성/매칭 + 활동 + 상태 전이)
    └── notifications.ts  # 부재 알림톡/SMS 발송 (알림톡 우선 → SMS fallback)
```

**외부 의존:**
- `lib/data/salesLeads.ts` — 전화번호 기반 리드 조회 (`findLeadByPhone`)
- `lib/services/smsService.ts`, `alimtalkService.ts` — 메시지 발송

## Enforced Rules

1. **테넌트 격리 필수**: 모든 쓰기/읽기 액션에서 `tenant_id` 검증. `role !== "superadmin"`이면 반드시 `lead.tenant_id !== tenantId` 체크 후 차단.
2. **인증 가드**: 모든 액션은 `requireAdminOrConsultant({ requireTenant: true })`로 시작. student/parent 역할 접근 불가.
3. **스코어링 상수 사용**: 점수 계산 시 `constants.ts`의 `FIT_SCORE_BY_SOURCE`, `FIT_SCORE_BY_PROGRAM`, `FIT_SCORE_BY_GRADE`, `ENGAGEMENT_SCORE_BY_ACTIVITY` 사용. 매직넘버 금지.
4. **파이프라인 상태 전이 시 부수 효과**: `updatePipelineStatus` → (1) `lead_activities`에 status_change 기록, (2) `AUTO_TASK_RULES` 기반 SLA 태스크 자동 생성. 부수 효과는 비동기 `.catch(() => {})`로 실패 허용.
5. **CrmActionResult 패턴**: 모든 액션 반환 타입은 `CrmActionResult<T>`. try-catch 최상위 래핑 + `logActionError`로 구조화된 에러 로깅.
6. **revalidatePath 호출 규칙**: 쓰기 액션은 반드시 `revalidatePath("/admin/crm")` 호출. 리드 상세 변경 시 `/admin/crm/leads`도 추가.
7. **상담 등록은 consultations.ts 경유**: 상담 기록 시 리드 자동 생성/매칭 + 활동 기록 + 상태 전이 + 스코어링 + 부재 알림이 한 트랜잭션 흐름에서 처리. 개별 액션을 UI에서 직접 조합하지 말 것.

## Tests
```bash
# 현재 CRM 전용 테스트 파일 없음. 추가 시:
pnpm test lib/domains/crm
pnpm test __tests__/crm
```

## Related Domains
- `enrollment` / `payment`: 리드 전환(convertLead) 시 수강 등록 자동 생성
- `notification` / `sms`: 부재 알림톡/SMS 발송
- `student`: 전환 시 학생 레코드 생성/연결
