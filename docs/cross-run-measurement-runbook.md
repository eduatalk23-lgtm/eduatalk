# Cross-run 실측 검증 runbook

세션 핸드오프 04-17 F 후속 #3 "실측 검증" 수행 절차.
`previousRunOutputs` (cross-run feedback) 인프라의 실제 활성과 효과 측정이 목적.

## 측정 대상

- **현재 구현된 cross-run 소비자**: 1건 (POC)
  - `storyline_generation` ← 직전 실행 `activity_summaries.summary_title` 프롬프트 주입
- **나머지 6건**은 manifest에 `writesForNextRun` 선언만 되어 있고 소비자 측 runner는 미구현 (세션 04-17 F 후속 #1)

## 전제

- `pnpm dev` 실행 중 (`http://localhost:3000`)
- `.env.local` 에 `SUPABASE_SERVICE_ROLE_KEY` 설정
- 두 학생 모두 `tenant_id = 84b71a5d-5681-4da3-88d2-91e75ef89015`

| 학생 | key | ID | 모드 |
|---|---|---|---|
| 김세린 | `kim` | `0e3e149d-4b9c-402d-ad5c-b3df04190889` | analysis (k=2) |
| 인제고 1학년 | `injego` | `35ee94b6-9484-4bee-8100-c761c1c56831` | prospective (k=0) |

## 실행 순서 (학생별 개별 실행)

### 1. Run 1 (기준 실행 — 클린업 포함)

```bash
# 김세린
npx tsx scripts/kim-serin-session-c-fullrun.ts

# 또는 인제고
npx tsx scripts/injego-session-c-fullrun.ts
```

→ 완주 후 로그에 "✅ ... 풀런 완료 (총 N초)" 확인.

### 2. Run 1 스냅샷 캡처

```bash
npx tsx scripts/cross-run-snapshot.ts --student=kim    --label=run1
npx tsx scripts/cross-run-snapshot.ts --student=injego --label=run1
```

→ `tmp/cross-run/<student>--run1.json` 생성.

### 3. Run 2 (cross-run 활성 — 클린업 스킵 필수)

```bash
npx tsx scripts/kim-serin-session-c-fullrun.ts --no-cleanup
npx tsx scripts/injego-session-c-fullrun.ts    --no-cleanup
```

**중요**: `--no-cleanup` 없이 실행하면 `student_record_analysis_pipelines` 가 전량 삭제되어
`loadPreviousRunOutputs()` 가 null을 반환 → cross-run 비활성 상태로 전락.

### 4. Run 2 스냅샷 캡처

```bash
npx tsx scripts/cross-run-snapshot.ts --student=kim    --label=run2
npx tsx scripts/cross-run-snapshot.ts --student=injego --label=run2
```

### 5. Diff 분석

```bash
npx tsx scripts/cross-run-diff.ts tmp/cross-run/kim--run1.json tmp/cross-run/kim--run2.json
npx tsx scripts/cross-run-diff.ts tmp/cross-run/injego--run1.json tmp/cross-run/injego--run2.json
```

## 판정 기준 (초안)

| 신호 | 기준 | 의미 |
|---|---|---|
| `[B]` latestSynthesis 교체 | id 바뀜 + Δ>0 | Run 2 synthesis 정상 완주 |
| `[B]` task_results keys | 양쪽 모두 storyline_generation 포함 | POC 소비 경로 실행됨 |
| `[C]` title Jaccard | `> 0.3` | 주제 축 유지 (연속성 신호) |
| `[C]` title Jaccard | `< 0.1` | 연속성 없음 — LLM 변동 혹은 힌트 무시 |
| `[C-2]` **주지표**: A 신호 keyword(노이즈 필터 적용) → B storyline 재등장 | `≥ 15%` | 프롬프트 주입 효과 직접 확인. 일반 교과명("수학/화학/영어")·활동 프레임("탐구/실험")은 분모/분자 제외 |
| `[C-2]` (참고) 필터 전 전체 hit | — | 과목명 중복만으로도 올라가므로 연속성 착시 유발 |
| `[C-2]` (참고) bigram+word 토큰 hit | — | 문장 파편 시절 잔재 지표, 분모 왜곡 있음 |
| `[D]` **주지표-1**: blueprint keyword recall (A∩B / A, stopword 제외) | `≥ 0.4` | Blueprint A 축 유지율. expansion(B 신규 추가) 에 불이익 없음 |
| `[D]` **주지표-2**: blueprint keyword Jaccard | `≥ 0.3` | 양방향 중복 비율. B expansion 시 하락 — recall 지표 우선 |
| `[D]` (참고) theme 문자열 집합 Jaccard | — | 완전 문자열 일치 기준 — 유사 테마도 불일치로 판정하는 한계 있음 |

**해석 주의**:
- 소표본 실측이므로 수치 자체보다 "0인가 아닌가"로 먼저 infrastructure 활성 여부 판정.
- `previousRunOutputs.runId` 가 null이면 `[C-2]` 측정이 의미 없음 — Run 1 synthesis completed row가 남아있는지 먼저 확인.
- `[C-2]` 등장 비율이 100%여도 LLM이 원래 그 주제를 뽑았을 수도 있음 → 반증은 "A summary keywords가 비어있을 때 B 결과" 비교가 필요 (이번 범위 아님).
- **2026-04-18 재설계**: 이전 `≥ 50% / ≥ 30%` 기준은 summary keywords 가 문장 파편(`content.slice(0,40)`)이던 시절 설계. 현재 명사구(`section.keywords` 명시 추출)로 바뀌었고, bigram 분할이 무관 토큰까지 포함해 비율을 희석하므로 **주지표를 keyword 문자열 재등장률로 교체**.
- **2026-04-18 노이즈 필터 (중대 수정)**: kim run3→4 재측정에서 필터 전 19.5% ✅ 통과 → 노이즈 필터 후 **0/56 (0.0%) ❌ 미달**. 기존 hit 16건 전량이 "수학/화학/영어" 같은 일반 과목명으로 LLM이 세특 원본에서 자연스럽게 중복한 것. **즉 [C-2] 가 "통과"로 보였던 것은 지표 착시**. 실질 콘텐츠 연속성 신호는 아직 배선되지 않았거나 효과 없음. 후속 과제: (a) activitySummary LLM 프롬프트에서 교과명 keyword 추출 금지 규칙 추가, (b) storyline_generation cross-run 주입 섹션 강화 가능성 검토.
- **2026-04-18 Run 5 결정적 검증 (근본 문제 해결 확인)**: activitySummary 프롬프트 규칙 10 확장 + parseResponse 2차 노이즈 방어 적용 후 kim run4→5 재측정: **[C-2] 노이즈 필터 후 4/22 (18.2%) ✅ 통과** (신호 예: "중력 렌즈", "빛의 성질", "엔트로피", "사회적 책임"). 동시에 blueprint self-loop 배선 검증: "광시야 천문 프로젝트 수렴" 테마 Run 4↔5 완전 유지 + "분광학적 원리 수렴" 신규 expansion. theme 문자열 Jaccard 0.000 → **0.500**. 단, `[D]` keyword Jaccard 0.200 (expansion 시 분모 증가로 0.3 기준 미달) — 추가 개선 후보: recall(A∩B/A) 보조 지표 도입.
- **2026-04-18 `[D]` 재설계**: 기존 "theme 문자열 집합 Jaccard" 는 "광시야 천문 프로젝트 수렴" ↔ "관측 데이터 해석과 광시야 천문 프로젝트" 같은 질적 연속성을 완전 불일치(0.000)로 판정하는 한계. themeLabel 단어 토큰 + themeKeywords 합집합 기준으로 Jaccard 재계산 (stopword "수렴/탐구/프로젝트/심화/기초/활동/연구/핵심/과제/실험/분석/이해/응용" 제외) → 공통 키워드 탐지 가능. 동시에 `blueprint_generation` 에 cross-run self-loop 배선 추가 (manifest `writesForNextRun: ["blueprint_generation"]` + phase-b1 에서 직전 수렴 LLM 프롬프트 주입) — Run N+1 에서 실효 검증 필요.

## 남은 한계

1. LLM 프롬프트 실제 내용(주입 섹션 포함 여부)은 현재 로그에 남지 않음. 필요 시 `phase-s1-storyline.ts` 에 `console.debug("[storyline] coursePlanExtra=\n" + coursePlanExtra)` 임시 추가.
2. `task_results` 대부분이 `{ elapsedMs }` 수준 — 세션 04-17 F 후속 #2(풍부화)가 선행되어야 더 깊은 측정 가능.
3. **인제고(k=0 prospective) [C-2] 부적합 확정 (2026-04-18)**:
   - `scripts/injego-session-c-fullrun.ts` 는 Blueprint + Grade(design)만 실행, synthesis 별도 (`injego-session-c-synthesis.ts`).
   - Run 1/2 완료 후에도 `synthesisCompletedCount=0`, `storylines.count=0` → `[C-2]` 주지표(storyline_generation 소비 경로)가 근본적으로 측정 불가.
   - `activity_summaries` 6건은 blueprint 산출물로, cross-run 소비자인 S1 storyline과 무관.
   - 결론: k=0 학생의 cross-run 효과는 S1이 아닌 **blueprint 경로**(convergence 축 승계)에서 측정해야 하며 별도 지표 필요 (→ 권장 순서 #2 과제).
   - 김세린(k=2 analysis)만 `[C-2]` 유효. Run 3→4 에서 19.5% 달성으로 기준선 확보 완료.

## 롤백

측정 종료 후 두 학생 상태 초기화:

```bash
npx tsx scripts/kim-serin-cleanup-only.ts
npx tsx scripts/injego-cleanup-only.ts
```

`tmp/cross-run/` 은 gitignored — 필요 시 수동 삭제.
