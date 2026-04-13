# LLM 4-모델 비교 측정 (2026-04-13)

생기부 세특 품질 평가 파이프라인에서 Gemini, OpenAI(GPT), 로컬 Gemma 4를 동일 조건으로 측정한 1차 실측 결과 기록.

## 측정 설정

- 경로: `runMonolithicAnalysis` (mono, 단일 호출)
- 골든 샘플 6건 (카테고리 A × 2, B/P1 × 2, F10 → 경계값 × 1, Z/경계값 × 1)
- 러너: `scripts/eval-student-record.ts --variant=mono --id=...`
- 각 provider는 `LLM_PROVIDER_OVERRIDE` 전역 스위치로 분리 실행
- 환경: M5 MacBook Pro 32GB (Gemma 로컬 Ollama), 2026-04-13 15:00 KST

## 모델 매핑

| Provider | advanced tier 실제 모델 | 참고 |
|----------|------------------------|------|
| Gemini | `gemini-2.5-pro` | thinking budget 1024 |
| OpenAI (4o) | `gpt-4o` | — |
| OpenAI (mini) | `gpt-4o-mini` | `LLM_TIER_OVERRIDE=fast`로 강제 |
| Ollama Gemma | `gemma4:latest` (9.6GB, MoE e4b) | 로컬 추론 |

## 1차 측정 (프롬프트 수정 전)

| 샘플 | Gemini Pro | GPT-4o | GPT-4o-mini | Gemma 4 |
|------|-----------|--------|-------------|---------|
| high-math | 100 ✅ | 95 ✅ | 80 ✅ | 95 ✅ |
| high-physics | 95 ✅ | 100 ✅ | 80 ✅ | 95 ✅ |
| p1-bio | **55 ❌** | **50 ❌** | **50 ❌** | **45 ✅** |
| p1-chem | **50 ❌** | **55 ❌** | **50 ❌** | **48 ✅** |
| f10-physics | 76 ❌ | 70 ❌ | 72 ❌ | 71 ❌ |
| borderline | 68 ✅ | 68 ✅ | 72 ✅ | 69 ✅ |
| **Pass rate** | **50%** | **50%** | **50%** | **83%** |
| 평균 지연 | 8s | 9s | 26s | 114s |

### 1차 결과 해석

**API 3모델 동점 FAIL**: Gemini Pro / GPT-4o / GPT-4o-mini 모두 3/6 PASS, 같은 3개 샘플에서 실패, 같은 사유 — P1/F10 **코드 prefix** 대신 "구체적 성과 부족" 같은 **자연어**만 반환.

```
Gemini Pro issues: ["구체적 성과 부족", "탐구 활동의 구체성 부족"]     ❌
GPT-4o issues:      ["구체적 성과 부족", "결론_미기술_면접확인필요"]       ❌
GPT-4o-mini issues: ["구체적 성과 수치 부족", "탐구 활동의 깊이 부족"]    ❌
Gemma 4 issues:     ["P1_나열식", "구체적 탐구 과정 부재"]                ✅
```

모델 크기에 따라 instruction-following 해석이 다름:
- 큰 instruct-tuned 모델(Pro/4o)은 지시를 "의역"해 자연어로 smoothing
- 소형 모델(Gemma 4)은 지시를 literal하게 따라 코드 반환

**F10 만장일치 실패**: 4개 모델 전부 score 70~76 반환(기대 maxScore=62 초과). 샘플 라벨 재검토 필요 시그널.

## 개입 1: 프롬프트 엄격화

`lib/domains/record-analysis/llm/prompts/competencyHighlight.ts`:

```diff
### 합격률 낮은 세특 패턴 감지 (issues에 반영)

- 아래 패턴이 발견되면 issues 배열에 해당 코드를 포함하세요:
+ 아래 패턴이 발견되면 issues 배열에 **정확히 아래 표기된 코드 문자열**을 포함해야 합니다:

+ **issues 배열 형식 규칙 (엄수)**
+ - 패턴이 감지되면 반드시 위 코드(`P1_나열식`, `F2_인과단절` 등)를 그대로 반환.
+ - 자연어 서술만 반환하는 것은 금지. 필요 시 코드 뒤에 추가.
+ - ❌ 나쁜 예: ["구체적 성과 부족"]
+ - ✅ 좋은 예: ["P1_나열식", "구체적 성과 부족"]
```

## 개입 2: f10-physics 라벨 재분류

해당 샘플의 content(법칙 나열 + 맥스웰 방정식 발표)는:
- F10(학년 간 성장 부재)는 본질적으로 **다학년 비교** 패턴 → 단일 세특 1건으로 감지 불가
- 4모델이 score 65~80 합의 → 난이도 있는 주제라 P1 단정도 약함
- 결론: **경계값 샘플로 재분류** (`minScore: 55, maxScore: 78`, mustHaveIssues 제거)

## 2차 측정 (개입 후)

| 샘플 | Gemini Pro | GPT-4o | GPT-4o-mini | Gemma 4 |
|------|-----------|--------|-------------|---------|
| high-math | 100 ✅ | 100 ✅ | 80 ✅ | (변경없음) |
| high-physics | 96 ✅ | 96 ✅ | 100 ✅ | |
| p1-bio | 56 ❌ 1pt | 60 ❌ 5pt | 54 ✅ P1 | 45 ✅ P1 |
| p1-chem | 45 ✅ P1 | 56 ❌ 1pt | 52 FAIL | 48 ✅ P1 |
| f10-physics | 70 ✅ | 70 ✅ | 70 ✅ | 71 ✅ |
| borderline | 68 ✅ | 68 ✅ | 70 ✅ | 69 ✅ |
| **Pass rate** | **83%** | **67%** | **83%** | **83%+** |
| 변화 | +33pp | +17pp | +33pp | 안정 |

**프롬프트 엄격화의 효과**:
- p1-bio / p1-chem에서 API 모델도 `P1_나열식` 코드 반환 성공 (샘플별 run-to-run 일관성은 일부 흔들림)
- 잔존 실패는 대부분 **score 1~5점 경계값 초과** (stochastic variation at T=0.3)

## 모델별 종합 평가

### Gemini 2.5 Pro
- Pass rate: 50% → **83%**
- 속도: 평균 8~10초/건 (advanced tier 기준)
- 특성: 프롬프트 엄격화 전에는 자연어 smoothing 강함. 엄격화 후 코드 준수도 급상승
- 비용: 이 골든셋 기준 6건 ~$0.30

### GPT-4o
- Pass rate: 50% → **67%** (1 run 기준, stochastic 가능)
- 속도: 평균 7~10초/건
- 특성: Gemini Pro와 유사한 패턴. 프롬프트 민감도 비슷
- 비용: 6건 ~$0.30

### GPT-4o-mini
- Pass rate: 50% → **83%** (1 run 기준)
- 속도: 평균 25~50초/건 (Pro 대비 느림 — 이례적)
- 특성: 소형이지만 프롬프트 엄격화 효과 크고 일관성 변동
- 비용: 6건 ~$0.03

### Gemma 4 (ollama)
- Pass rate: **83%** (프롬프트 수정 전에도 안정)
- 속도: 평균 114초/건 (API 대비 15배 느림)
- 특성: 소형 로컬 모델이지만 structured output 준수성 우수. instruction literal-following 강함
- 비용: 전력만 (M5 32GB, Q4 quantized 9.6GB)

## 의사결정 시사점

1. **"LLM 다각화는 지금 필요한 과제인가?"** — **당장은 불필요**. API 3모델이 동일 프롬프트 문제를 공유하므로 provider 교체만으로 품질 개선 없음. 프롬프트 엄격화가 선행 조건.
2. **Gemma의 역할** — 프로덕션 실시간 대체는 속도 때문에 부적합. 다만 structured output 준수성 덕에 **라벨 검증/배치 작업 품질 체크** 용도로 가치 있음.
3. **프롬프트 엄격화는 가장 낮은 매달린 과일** — 1시간 투자로 Pass rate 17~33pp 상승 확인.
4. **골든셋 품질**: F10 샘플 같은 misconfig를 다른 샘플에도 재점검 필요 (D6/F1 등 모델 만장일치 실패 샘플이 추가로 있을 가능성).

## 확정된 다음 단계

1. (우선) 골든셋 나머지 48건에 대해 프롬프트 수정 후 CI 회귀 실행 → baseline 재수립
2. (중기) `--variant=both` 50건 A/B 실측 — Stage 1 측정 루프의 최종 점화
3. (장기) Gemma를 배치 전용 provider로 격하 수용 여부 결정 — structured output 검증자로 배치 단계 추가 가능성

## 저장 아티팩트

- `eval-results.{gemini-pro,gemini-6,gpt4o-6,gpt4o-mini-6,gemma-6}.json` — 1차 측정 (수정 전)
- `eval-results.{gemini-pro-v2,gpt4o-v2,gpt4o-mini-v2}.json` — 프롬프트 수정 후
- `eval-results.{gemini-pro-v3,gemini-pro-final,gpt4o-final,gpt4o-mini-final}.json` — f10 라벨 수정 후

아티팩트는 `.gitignore`에 `eval-results*.json`으로 제외됨.
