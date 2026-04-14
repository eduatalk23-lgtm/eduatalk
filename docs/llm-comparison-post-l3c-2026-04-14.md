# LLM 비교 측정 — H1~L3-C 통합 이후 (2026-04-14)

## 측정 배경

2026-04-13 완료된 record-analysis 구조 개선 이후 1차 정량화.

**통합된 구조 변경:**
- H1 Cross-subject Theme Extractor
- H2 Narrative ProfileCard (서사 통계 3필드 + LLM interestConsistency)
- L4-D Hypothesis-Verify (diagnosis/strategy L1+L2+L3 repair)
- L4-E narrativeContext (4-tier draft 정렬)
- L3-C synthesis_inferred 동적 Edge (2026-04-13 sanity 통과)

**1차 비교 대상:** `docs/llm-comparison-2026-04-13.md` (프롬프트 엄격화만 반영, 구조 개선 미반영)

## 측정 설정

- 러너: `scripts/eval-student-record.ts --variant=mono`
- 골든셋: 50건 (`lib/domains/record-analysis/eval/golden-dataset.ts`)
- 통과 기준: `--threshold=70`
- 실행 일시: 2026-04-14
- Provider: Gemini (Free Tier)

**Run 구성:**

| Run | Tier | 모델 | 샘플 | 범위 |
|-----|------|------|------|------|
| A | standard | gemini-2.5-flash | 50건 | 풀셋 |
| B | advanced | gemini-2.5-pro | 15건 | Tier 2 우선 샘플 |

Pro 샘플 15건 선정 기준: Tier 2 우선 패턴(F10/F16/P4) + 대표성(고품질/경계/창체/행특 각 1~2건).

## 결과 요약

| 지표 | Flash 50건 | Pro 15건 |
|------|-----------|---------|
| Pass rate | **49/50 = 98%** | **14/15 = 93%** |
| 하이라이트 통과율 | 100% (260건) | 99% (80건) |
| 평균 similarity | 0.24 | 0.21 |
| 평균 coverage | 24% | 21% |
| 평균 응답 시간 | 9.3초 | 21.7초 |

### 1차(04-13) vs post-L3C(04-14) 비교

| 지표 | 1차 (엄격화만) | post-L3C | Δ |
|------|----------------|----------|---|
| Gemini Pro pass | 83% (50건) | **93% (15건)** | +10pp |
| Gemini Flash pass | 83% (풀셋) | **98% (풀셋)** | +15pp |

> **주의**: Pro 샘플 크기 차이(50→15) 때문에 Δ는 절대값이 아닌 방향성 지표로 해석.

## 실패 분석

### Flash 실패 (1건/50)

- **`setek-f10-physics`** (score 68 > maxScore 55)
- 라벨: F10_성장부재 (다학년 비교 필수)
- 원인: **단일 세특으로 F10 판정 불가** (골든셋 재분류 보류 사례, 2026-04-13-B 핸드오프에도 명시)
- 결론: 모델 문제 아님 → Tier 2 다중 레코드 영역

### Pro 실패 (1건/15)

- **`setek-borderline`** (score 38 < minScore 42)
- 경계 샘플: "생명과학 기본 탐구 — 완성도 중간, 구체성 부족"
- Flash는 동일 샘플에서 64점 PASS, Pro는 38점 FAIL → Pro가 26점 더 낮게 판정
- 원인: Pro의 더 엄격한 구체성/깊이 평가 기준

## 핵심 발견

### 1. Pro의 경계 샘플 보수성

Flash 대비 경계 샘플에서 일관되게 더 낮은 점수.

| 샘플 | Flash | Pro | Δ |
|------|-------|-----|---|
| setek-borderline | 64 | 38 | -26 |
| setek-borderline-econ | 70 | 58 | -12 |

**해석:** Pro는 "구체적 성과 부족" 같은 정성 이슈를 더 적극 감지. 프로덕션에서는 **더 엄격한 품질 판정** 효과.

### 2. F16_진로과잉도배 감지 차이

`setek-f2-bio` (생명과학 유전 → 철학 → 종교 윤리 비약) 샘플에서:

- Flash issues: `[F2_인과단절, F12_자기주도성부재, M1_교사관찰불가, P1_나열식, P3_키워드만]`
- Pro issues: `[P1_나열식, F2_인과단절, F12_자기주도성부재, **F16_진로과잉도배**, M1_교사관찰불가]`

**해석:** Pro만 F16 감지. Tier 2 우선 패턴 중 F16 일부는 단일 세특에서도 Pro로 감지 가능.

### 3. F10/P4는 여전히 단일 레코드 한계

- F10 복합(`setek-p1-f10-combo`)은 Flash/Pro 모두 감지 — F10 라벨 명시적 + P1과 동반이라 판정 가능
- 단일 F10(`setek-f10-physics`)은 Flash 실패, Pro 미측정 — **다학년 비교가 본질**
- P4(`setek-p4-bio`): 둘 다 PASS했으나 P4 라벨 감지는 추가 분석 필요

### 4. L4-D Repair 작동 여부

이번 eval 러너는 `runMonolithicAnalysis`만 호출 — L4-D validator/repair는 **synthesis 파이프라인 전용**이라 본 측정에서 미확인.
→ Tier 2 다중 레코드 측정에서 별도 검증 필요.

## 3-Model 편차 측정

OpenAI(GPT-4o, GPT-5.4)는 이번 세션에서 미측정. 이유:
- `.env.local`에 `LLM_PROVIDER_OVERRIDE=openai` 기본 적용 상태 확인 후 Gemini 우선
- Week 3 측정(2026-04-13-B, GPT-5.4 98%, GPT-4o 78%)과 참고용 간접 비교만 가능

post-L3C GPT 측정은 별도 세션에서 진행 권장.

## Tier 2 패턴 감지율

| 패턴 | Flash (50건) | Pro (15건) | 상태 |
|------|-------------|-----------|------|
| F10 성장부재 | 단일 샘플 1/1 감지(combo), 순수 F10 0/1 | 단일 샘플 1/1 감지(combo), 순수 F10 미측정 | **다중 레코드 필수** |
| F16 진로과잉도배 | 0 감지 | 1 감지 (setek-f2-bio) | Pro 우위 |
| P4 내신↔탐구 | 라벨 검증 필요 | 라벨 검증 필요 | **다중 레코드 필수** |

**결론:** 현 골든셋(단일 세특 기반)은 F10/P4 감지율 측정에 부적합. Tier 2 다중 레코드 골든셋 구축이 선행 필요.

## 의사결정 시사점

### 1. Admin batch provider

- **Flash 98%**: 프로덕션 표준 tier(Flash) 안정성 매우 높음
- **Pro 93% + 경계 엄격도**: 고품질 진단에 유리하나 cost/latency 2배
- **권장**: 현재 프로덕션 배치 **Flash 유지** (cost 절감 + 안정성), 고가치 단일 생기부(입시 직전)에만 Pro 옵션 제공 검토

### 2. 다음 우선순위

1. **Phase 1 Hypergraph** 진행 (Tier 2 다중 레코드 표현 구조) — F10/P4 감지 선결 조건
2. **Tier 2 다중 레코드 골든셋** 추가 구축 — 본 측정으로 현 단일 세특 한계 확인됨
3. **GPT 3-Model 풀셋 post-L3C** — 별도 세션에서 OpenAI 한도 확인 후 실시

### 3. 경계 샘플 기준 조정 검토

Pro가 `setek-borderline` (minScore 42)에서 38점 → 이미 Pro 기준 엄격도를 반영해 minScore 하향 조정 필요 여부 평가. Flash 기준으로 설정된 임계값이 Pro 기준에는 오버슈트.

## 확정된 다음 단계

- [x] H1~L3-C 통합 후 post-L3C Baseline 1차 측정 (Gemini Flash 50 + Pro 15)
- [ ] Tier 2 다중 레코드 골든셋 설계 (F10/P4 감지용)
- [ ] Phase 1 Hypergraph DB 스키마 착수
- [ ] 별도 세션: GPT-4o/GPT-5.4 post-L3C 측정 (OpenAI 환경 unset 후)

## 아티팩트

- `/tmp/eval-flash-post-l3c.json` (Flash 풀셋 stdout)
- `/tmp/eval-flash-post-l3c.stderr.log` (Flash stderr)
- `/tmp/eval-pro-real-post-l3c.txt` (Pro 실측 stdout)
- `/tmp/eval-pro-real-post-l3c.stderr.log` (Pro stderr, 과부하/fallback 없음 확인)

## 관련 문서

- `docs/llm-comparison-2026-04-13.md` — 1차 측정 (엄격화만)
- 메모리 `record-analysis-architecture-upgrade-roadmap.md` — H1~L3-C 완료 라인
- 메모리 `tier2-measurement-handoff.md` — 본 측정 핸드오프 (완료)
- 메모리 `golden-dataset-tier2-multi-record-patterns.md` — Tier 2 검증 도구 포지셔닝
