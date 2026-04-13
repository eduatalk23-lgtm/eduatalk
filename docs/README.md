# TimeLevelUp 문서 인덱스

> **👉 첫 방문이라면 [`ARCHITECTURE.md`](./ARCHITECTURE.md)부터 읽으세요.**
> 프로젝트 전체 구조와 계층을 15분에 파악할 수 있는 중심축 문서입니다.

---

## 🧭 중심축

| 문서 | 설명 |
|---|---|
| **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** | **프로젝트 전체 구조** (5계층, 도메인 지도, 품질 보증, 로드맵) |
| [`CLAUDE.md`](../CLAUDE.md) (루트) | 코드 규칙 / Auth / DB / 배포 — Claude Code 용 가이드 |

---

## 📚 문서 분류 (Diátaxis)

문서는 **목적**에 따라 4종으로 분류합니다.
- **Explanation**: 개념·구조·결정 설명 (왜/무엇)
- **Reference**: 기계적 참조 (스펙, API, 스키마)
- **How-to**: 작업 가이드 (특정 목표 달성)
- **Tutorial**: 학습 가이드 (신규 합류자)

---

### 📖 Explanation (아키텍처 · 설계 · 분석)

| 분야 | 문서 |
|---|---|
| **생기부 AI 시스템** | [`student-record-blueprint.md`](./student-record-blueprint.md) — Mermaid 8개 다이어그램 |
| | [`cross-subject-theme-extractor-design.md`](./cross-subject-theme-extractor-design.md) — H1 교과간 주제 추출 |
| | [`pipeline-neis-driven-redesign.md`](./pipeline-neis-driven-redesign.md) — 파이프라인 재설계 |
| | [`pipeline-slot-and-draft-design.md`](./pipeline-slot-and-draft-design.md) — 슬롯·가안 설계 |
| | [`report-master-pattern.md`](./report-master-pattern.md) — 리포트 렌더 패턴 |
| **LLM 운영** | [`llm-comparison-2026-04-13.md`](./llm-comparison-2026-04-13.md) — 4-Provider 실측 |
| | [`llm-model-tier-analysis.md`](./llm-model-tier-analysis.md) — 티어 매핑 근거 |
| | [`model-comparison-competency-analysis.md`](./model-comparison-competency-analysis.md) · [v2](./model-comparison-competency-analysis-v2.md) |
| **평가 · 컨설턴트** | [`evaluation-criteria-summary.md`](./evaluation-criteria-summary.md) — 5축 루브릭 |
| | [`setek-evaluation-research-answers.md`](./setek-evaluation-research-answers.md) |
| | [`consultant-review-evaluation-criteria.md`](./consultant-review-evaluation-criteria.md) |
| | [`consultant-rubric-review.md`](./consultant-rubric-review.md) |
| | [`expert-panel-personas.md`](./expert-panel-personas.md) — 자문단 페르소나 |
| **탐구 가이드** | [`guide-generation-pipeline.md`](./guide-generation-pipeline.md) |
| | [`guide-matching-phase2-plan.md`](./guide-matching-phase2-plan.md) |
| | [`guide-type-specific-design.md`](./guide-type-specific-design.md) |
| **도메인 · 에이전트** | [`domain-agent-architecture.md`](./domain-agent-architecture.md) — 서브에이전트 설계 |
| | [`domain-based-architecture-guide.md`](./domain-based-architecture-guide.md) — 도메인 원칙 (부분 낡음) |
| **기능별 설계** | [`career-classification-unification-design.md`](./career-classification-unification-design.md) |
| | [`bypass-major-adversarial-review.md`](./bypass-major-adversarial-review.md) · [data refresh](./bypass-major-data-refresh-design.md) |
| | [`student-record-graph-system-design.md`](./student-record-graph-system-design.md) · [review](./student-record-graph-adversarial-review.md) |
| | [`student-record-extension-design.md`](./student-record-extension-design.md) |
| | [`presentation-plan-management-system.md`](./presentation-plan-management-system.md) |
| | [`planner-enhancement-design.md`](./planner-enhancement-design.md) |
| | [`calendar-db-restructuring-proposal.md`](./calendar-db-restructuring-proposal.md) · [gap analysis](./calendar-gap-analysis.md) |

### 📕 Reference (참조)

| 분야 | 문서 |
|---|---|
| **도메인별 규칙** | `lib/domains/*/CLAUDE.md` (18개 도메인) |
| **Auth 전략** | [`auth-strategy-pattern.md`](./auth-strategy-pattern.md) |
| **DB 타입 규약** | [`source-types.md`](./source-types.md) — `source` 컬럼 의미 |
| **컴포넌트** | [`COMPONENT_GUIDE.md`](./COMPONENT_GUIDE.md) · [structure](./component-structure-guide.md) |
| **UI 시스템** | [`ui-typography-system-guide.md`](./ui-typography-system-guide.md) · [dark mode](./dark-mode-usage-guide.md) |
| **외부 리소스** | [`consultant-followup-questions.md`](./consultant-followup-questions.md) |
| **리팩토링 원칙** | [`REFACTORING_GUIDE.md`](./REFACTORING_GUIDE.md) |

### 🛠 How-to (작업 가이드)

| 분야 | 문서 |
|---|---|
| **개발 환경** | [`env-setup-guide.md`](./env-setup-guide.md) · [proxy](./proxy-check-guide.md) |
| **타입 안전성** | [`type-safety-enhancement-guide.md`](./type-safety-enhancement-guide.md) |
| **AI 시스템** | [`cold-start-system-guide.md`](./cold-start-system-guide.md) — Cold Start 추천/배치 |
| | [`ai-plan-generation-guide.md`](./ai-plan-generation-guide.md) · [pipeline](./ai-plan-generation-pipeline-guide.md) · [comprehensive](./plan-generation-comprehensive-guide.md) |
| | [`ai-content-recommendation-analysis.md`](./ai-content-recommendation-analysis.md) |
| **DB 마이그레이션** | [`migration-execution-guide.md`](./migration-execution-guide.md) · [quick](./quick-migration-guide.md) · [reset](./migration-reset-execution-guide.md) |
| | [`school-migration-execution-guide.md`](./school-migration-execution-guide.md) |
| | [`camp-migration-execution-guide.md`](./camp-migration-execution-guide.md) · [plan migration](./camp-plan-migration-guide.md) · [inspection](./camp-plan-contents-inspection-guide.md) |
| **Supabase** | [`supabase-connection-guide.md`](./supabase-connection-guide.md) · [pooler](./supabase-connection-pooler-guide.md) · [client optimization](./supabase-client-optimization-guide.md) |
| | [`supabase-db-push-guide.md`](./supabase-db-push-guide.md) · [migration reset](./supabase-migration-reset-guide.md) · [schema dump](./supabase-schema-dump-guide.md) |
| | [`supabase-cli-reauth-guide.md`](./supabase-cli-reauth-guide.md) |
| **RLS 테스트** | [`rls-policy-phase3-test-guide.md`](./rls-policy-phase3-test-guide.md) |
| **배포** | [`vercel-deployment-guide.md`](./vercel-deployment-guide.md) |
| **결제** | [`guest-payment-link-scenarios.md`](./guest-payment-link-scenarios.md) |
| **알림 · 푸시** | [`push-notification-stale-count-fix.md`](./push-notification-stale-count-fix.md) |
| **학생 기능** | [`student-connection-code-guide.md`](./student-connection-code-guide.md) |
| | [`score-input-form-guide.md`](./score-input-form-guide.md) |

### 🎓 Tutorial (학습)

현재 공식 튜토리얼은 없음. 신규 합류자 권장 순서:
1. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 15분
2. [`CLAUDE.md`](../CLAUDE.md) 루트 — 10분
3. [`lib/domains/record-analysis/CLAUDE.md`](../lib/domains/record-analysis/CLAUDE.md) — 20분
4. `app/(admin)/admin/students/[id]/page.tsx` 실제 코드 탐색

---

## 🧪 테스트 가이드

| 문서 | 설명 |
|---|---|
| [`student-search-testing-guide.md`](./student-search-testing-guide.md) | 학생 검색 |
| [`student-search-phase4-testing-guide.md`](./student-search-phase4-testing-guide.md) | Phase 4 |
| [`wizard-phase2-manual-testing-guide.md`](./wizard-phase2-manual-testing-guide.md) | 위자드 Phase 2 |
| [`wizard-phase3-testing-guide.md`](./wizard-phase3-testing-guide.md) | Phase 3 |
| [`wizard-phase4-testing-guide.md`](./wizard-phase4-testing-guide.md) | Phase 4 |

---

## ⚠️ Deprecated (배너 부착됨 — 분기 정리 대상)

다음 문서는 **과거 기록**으로 보존 중이며 새 작업에 참조하지 마세요. 분기 정리 시 `archive/`로 이동 예정.

- [`student-record-implementation-plan.md`](./student-record-implementation-plan.md) — 2026-03-20 완료 로그
- [`student-record-roadmap.md`](./student-record-roadmap.md) — 과거 로드맵 (현재: ARCHITECTURE.md §7)
- [`refactoring/03_phase_todo_list.md`](./refactoring/03_phase_todo_list.md) — 2025-12 TODO
- [`domain-based-architecture-guide.md`](./domain-based-architecture-guide.md) — 2024-11 (부분 낡음)
- [`PROJECT_SPECIFICATION.md`](./PROJECT_SPECIFICATION.md) · [`PLAN.md`](./PLAN.md) · [`PLAN_SYSTEM_ENHANCEMENT.md`](./PLAN_SYSTEM_ENHANCEMENT.md) — v1.0 기획서 (생기부 AI 전환 전)

### 하위 폴더

```
docs/
├── architecture/     # 일부 현행 + 일부 낡음 (일별 리포트 등)
├── refactoring/      # 2025 리팩토링 로그 (대부분 완료)
├── plans/            # 작업 계획 — 완료된 건 archive로 이동 예정
├── guides/           # 기능 가이드
├── features/         # 기능 설계
├── api/              # API 참조
├── reviews/          # 리뷰 문서
├── attendance/       # 출석 시스템
├── mockups/          # 디자인 목업
├── plan-enhancement/ # 플랜 개선
└── archive/          # 과거 세션 로그 (2024/2025/2026/misc)
    ├── 2024/         # 9개
    ├── 2025/         # 432개
    ├── 2026/         # 54개
    └── misc/         # 758개
```

---

## 🔍 트리아지 리포트

자동 생성된 문서 상태 분석:
- [`TRIAGE_REPORT_2026-04-13.md`](./TRIAGE_REPORT_2026-04-13.md) — 156개 문서 분류 (현행/고아/낡음/중복 등)
- 재생성: `npx tsx scripts/docs-triage.ts > docs/TRIAGE_REPORT_$(date +%Y-%m-%d).md`

---

*마지막 업데이트: 2026-04-13 — ARCHITECTURE.md 신설 + Diátaxis 재편*
