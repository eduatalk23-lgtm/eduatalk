/**
 * 공통 프롬프트 빌더 — 전 유형, 전 소스 공통 시스템 프롬프트 조합
 *
 * buildBaseSystemPrompt()가 마스터 함수이며, 개별 빌더를 조합합니다.
 * keyword/extraction/clone/improve/review 프롬프트에서 모두 이 모듈을 사용합니다.
 */

import type { GuideType } from "../../types";
import { GUIDE_TYPE_LABELS } from "../../types";
import {
  GUIDE_SECTION_CONFIG,
  type SectionDefinition,
} from "../../section-config";
import type { StudentProfileContext } from "../types";
import {
  THEORY_DEVELOPMENT_HINTS,
  SECTION_COHERENCE_RULES,
} from "./theory-development-hints";

// ============================================================
// 개별 프롬프트 빌더
// ============================================================

/**
 * Config 기반 유형별 섹션 구조를 프��프트 텍스트로 변환
 */
/**
 * @param selectedKeys — 활성 섹션 키 목록. undefined면 전체 포함.
 */
export function buildSectionStructurePrompt(
  guideType: GuideType,
  selectedKeys?: string[],
): string {
  const allDefs =
    GUIDE_SECTION_CONFIG[guideType] ??
    GUIDE_SECTION_CONFIG["topic_exploration"];

  // selectedKeys가 있으면 해당 섹션 + Core 섹션(항상 포함)
  const selectedSet = selectedKeys ? new Set(selectedKeys) : null;
  const defs = selectedSet
    ? allDefs.filter(
        (d) =>
          selectedSet.has(d.key) ||
          (d.tier ?? "core") === "core", // Core는 항상 포함
      )
    : allDefs;

  const lines: string[] = [];
  lines.push(`## 가이드 구조 (${GUIDE_TYPE_LABELS[guideType]})`);
  lines.push(
    "sections 배열에 아래 나열된 **모든 섹션을 빠짐없이** 포함해야 합니다.\n",
  );

  for (const def of defs) {
    // 사용자가 명시적으로 선택했거나 Core면 → (필수)로 표시
    const isUserSelected = selectedSet?.has(def.key);
    const isCore = (def.tier ?? "core") === "core";
    const reqTag = isCore || isUserSelected ? "**(필수)**" : "(선택)";

    const lengthHint =
      def.minLength && def.maxLength
        ? ` ${def.minLength}~${def.maxLength}자`
        : def.maxLength
          ? ` ~${def.maxLength}자`
          : "";
    const multiHint =
      def.multiple && def.multipleMin && def.multipleMax
        ? ` (${def.multipleMin}~${def.multipleMax}개 섹션)`
        : "";
    const desc = def.placeholder ? ` — ${def.placeholder}` : "";
    const outlineTag = def.outlineRequired ? " 🗂️[outline 필수]" : "";

    lines.push(
      `- key=\`${def.key}\` **${def.label}** ${reqTag}${multiHint}${lengthHint}${outlineTag}${desc}`,
    );
  }

  lines.push(
    "\n⚠️ 위에 나열된 섹션은 컨설턴트가 선택한 것입니다. **(필수)** 표시된 섹션을 하나라도 누락하면 불합격입니다.",
  );

  return lines.join("\n");
}

/**
 * 공통 작문 스타일 지침 (전 유형 적용)
 */
export function buildWritingStylePrompt(): string {
  return `## 작문 스타일 규칙

### 문체
- 모든 문장은 **습니다 체**로 작성합니다
- 문장으로 작성하고 단락을 구분지어 작성합니다
- 보고서 구성: 서론(문제 제기)→본론(이론 전개)→결론(결과 해석)의 짜임새

### AI 의존도 저감 (핵심)
- AI 의존도를 20% 이하로 유지합니다 — 학생 고유의 사고흐름과 개성이 드러나야 합니다
- **금지 표현**: "~라고 할 수 있다", "~인 것으로 판단된다", "~에 대해 알아보았다", "다양한 측면에서 살펴보았다"
- **권장 표현**: 구체적 상황 서술 ("○○ 현상을 관찰한 결과 △△임을 확인했습니다", "□□ 이론을 적용하여 분석한 결과")
- 학생이 직접 경험하고 사고한 느낌이 나도록, 일반론 대신 구체적 사례와 개인적 해석을 서술합니다

### 논리적 추론 과정
- **단계별 전개**: 시작→결과까지 논리적이고 단계적으로 전개하며, 각 단계의 의미를 설명합니다
- **가정 및 전제 명시**: 이론 적용의 전제 조건을 밝히고 그 이유를 설명합니다
- **개념 설명**: 새 개념 도입 시 정의→설명→전개 순서를 따릅니다
- **지식 선택 능력**: 관련 이론을 나열하지 말고, 왜 이 이론이 적합한지 근거를 제시합니다
- **결론 도출**: 결과의 의미와 문제 해결 기여도를 명확히 제시합니다`;
}

/**
 * 세특 예시 작성 가이드 (고급)
 */
export function buildSetekGuidePrompt(): string {
  return `## 세특(교과세부능력특기사항) 기재 예시 작성 기준
3개의 예시를 200~500자로 작성하며, 아래 요소를 복합적으로 포함합니다:

### 자기주도성 서술어 (과정 중심)
"스스로 제기", "반복적으로 점검", "주도적으로 확장", "초기 가설의 한계를 인식하고 탐구 주제를 구체화했다", "탐구 방법을 재설정했다"
→ 무엇을 어떻게 조정했는지 **구체적으로** 서술합니다

### 탐구력 서술어 — "질문/탐구/확장"의 누적 맥락
탐구력 영역: ▲탐구 동기/과정 ▲탐구의 깊이 ▲결과와 과정의 정합성 ▲교육과정 적정성
- **심화형**: "본질적 질문 제기", "재해석", "비판적 검토", "원리 탐구", "대안 제시", "가설 설정"
- **확장형**: "융합적 발견", "새로운 관점 제시"
→ 질문 제기→탐구→확장의 흐름이 드러나고, 동기/과정/결과가 유기적으로 연결되어야 합니다

### 진로역량 + 학업역량 융합
- 탐구 목적/결과에 따른 **관찰 및 성장 평가**를 포함합니다
- 목표 지향적 행동이 반복 확인되는 서술 패턴을 사용합니다
- 도전적 과목 선택의 의지와 노력을 반영합���다

### 작성 톤
- 교사가 학생을 관찰한 시점에서 3인칭으로 서술합니다
- 자발성/과정 중심 서술어가 일관되게 사용되어야 합니다`;
}

/**
 * 학생 프로필 맥락 — 있으면 진로 연계 지시, 없으면 범용 지침
 */
export function buildStudentProfilePrompt(
  profile?: StudentProfileContext,
): string {
  if (!profile?.targetMajor) {
    return `## 범용 작성 지침
- 특정 전공을 전제하지 않고, 다양한 계열의 학생이 활용할 수 있도록 작성합니다
- 탐구 주제의 학제간(interdisciplinary) 가치를 강조��니다`;
  }

  const lines: string[] = [];
  lines.push(`## 학생 프로필 맥락`);
  lines.push(`- **희망 전공**: ${profile.targetMajor}`);

  if (profile.desiredCareerField) {
    lines.push(`- **관련 계열**: ${profile.desiredCareerField}`);
  }
  if (profile.topCompetencies?.length) {
    lines.push(`- **핵심 역량**: ${profile.topCompetencies.join(", ")}`);
  }
  if (profile.weakCompetencies?.length) {
    lines.push(
      `- **보완 필요 역량**: ${profile.weakCompetencies.join(", ")}`,
    );
  }
  if (profile.recommendedCourses) {
    lines.push(
      `- **전공 권장교과**: ${profile.recommendedCourses.general.join(", ")}`,
    );
    if (profile.recommendedCourses.career.length > 0) {
      lines.push(
        `- **진로 교과**: ${profile.recommendedCourses.career.join(", ")}`,
      );
    }
  }
  if (profile.storylineKeywords?.length) {
    lines.push(
      `- **탐구 키워드**: ${profile.storylineKeywords.join(", ")}`,
    );
  }

  lines.push(`
## 진로 연계 지침
- 탐구 동기에 학생의 진로/전공 관심과 연결되는 개인적 경험을 포함합니다
- 탐구 이론에서 전공 분야의 관점을 자연스럽게 녹여냅니다
- 탐구 고찰에서 이 탐구가 전공 적합성에 어떻게 기여하는지 해석합니다
- 느낀점에서 이 탐구가 진로 결정에 미친 영향을 서술합니다
- 세특 예시에 진로역량+학업역량+탐구력 키워드를 포함합니다
- 스토리라인 키워드와의 서사적 연결을 자연스럽게 보여줍니다`);

  return lines.join("\n");
}

/**
 * 목차형 아웃라인 작성 규칙 — 🗂️[outline 필수] 표기된 섹션에 적용
 */
export function buildOutlineFormatPrompt(): string {
  return `## 목차형 아웃라인 (outline) 작성 규칙

🗂️[outline 필수] 표기된 섹션(탐구이론/활동내용)에는 **content(산문)와 outline(목차)를 모두** 생성합니다.

### outline 배열 구조
각 항목은 \`{depth, text, tip?, resources?}\` 형태입니다:
- **depth=0** — 대주제 (예: "1. 사전탐구이론", "2. 실험설계")
- **depth=1** — 중주제 (예: "가. 핵심 개념 정의", "나. 변수 설계")
- **depth=2** — 세부항목 (예: "- 엔트로피의 열역학적 정의와 의미", "- 독립변인: 구조 형태")

### ⭐ outline 분량/밀도 기준 (필수 — 미달 시 불합격)
content_sections **전체를 합산**한 수치이며, 아래 기준을 **반드시** 충족해야 합니다.
이 기준은 최소 요구사항이므로, 미달 시 출력이 거부됩니다.

| 항목 | 최소 (MUST) | 목표 (SHOULD) |
|------|-------------|---------------|
| depth=0 (대주제) | **5개 이상** | 6~8개 |
| depth=1 (중주제) | 대주제당 **2개 이상** | 3~5개 |
| depth=2 (세부항목) | 중주제당 **2개 이상** | 3~4개 |
| **전체 outline 항목 합계** | **40개 이상** | 50~60개 |
| tip | **6개 이상** | 8~10개 |
| resources | **5개 이상** | 6~8개 |

⚠️ **자가 검증**: outline 생성 후, 위 표의 "최소(MUST)" 열을 전부 만족하는지 확인하세요.
하나라도 미달이면 항목을 추가하여 기준을 충족시키세요.

### depth=2 세부항목 작성 기준
세부항목은 **학생이 바로 조사/실행할 수 있는 구체적 내용**이어야 합니다:
- ❌ 추상적: "관련 이론 조사"
- ✅ 구체적: "다르시 법칙: Q = K × A × (Δh/L) — 각 변수의 물리적 의미 정리"
- ❌ 추상적: "실험 준비물 확인"
- ✅ 구체적: "투명 아크릴 원통 (직경 8cm, 높이 30cm) × 5개"
- ❌ 추상적: "데이터 분석"
- ✅ 구체적: "시료별 평균 침투율, 표준편차, 변이계수(CV) 산출 → 막대그래프 + 오차막대 시각화"

### outline의 역할
outline은 **학생이 따라갈 탐구 로드맵(학습 경로)**입니다:
- "어떤 내용을 조사/탐구/실험하라"는 안내
- "어떤 순서로 진행하라"는 흐름
- "어떤 자료를 참고하라"는 리소스 안내
→ content(산문)이 "탐구 결과물"이라면, outline은 "탐구 안내서"입니다.

### 🔴 tip 사용 규칙 (필수 — 0개는 불합격)
tip은 **학생에게 직접 보이는 안내**입니다.
⚠️ **tip이 0개인 outline은 불합격입니다. 반드시 6개 이상 포함하세요.**
tip을 배치할 위치: 주로 depth=0 또는 depth=1 항목에 붙입니다. depth=2에도 가능합니다.

좋은 예:
- "반드시 본인의 경험과 연결지어 해석할 것"
- "5회 이상 반복 실험하여 표준편차 산출 — 확률적 신뢰도 확보"
- "수학적 의미를 이해한 후 반드시 본인의 언어로 설명할 것"
- "단순 결론이 아닌 '이 실험의 한계가 실제 현장과 어떻게 다른지' 반드시 서술할 것"
- "각 경우의 대표적 예시를 반드시 작성하여 비교표에 포함할 것"
- **금지**: 내부 코멘트, AI 관련 지시, 컨설턴트 메모 (예: "AI 의존도 낮출 것")

### 🔴 resources 사용 규칙 (필수 — 0개는 불합격)
⚠️ **resources가 0개인 outline은 불합격입니다. 반드시 5개 이상 포함하세요.**
resources는 \`{description, consultantHint?}\` 구조입니다.

**description** (필수, 1~2문장, **100자 이내**): 학생에게 보이는 추가 맥락. URL 포함 금지.
**consultantHint** (선택, **30자 이내**): 컨설턴트용 검색 안내.

⚠️ description이 너무 길면 토큰 한도를 초과합니다. **핵심 정보만 간결하게** 작성하세요.

좋은 예:
- \`{description: "니켈 촉매 활성 온도 300-400°C 범위(김○○, 2022)", consultantHint: "RISS: 니켈 촉매 메탄화"}\`
- \`{description: "반트호프 방정식으로 K의 온도 의존성을 정량 분석 가능", consultantHint: "Khan Academy: van't Hoff equation"}\`
- \`{description: "CH₄ 표준 생성 엔탈피 -74.87 kJ/mol (NIST)", consultantHint: "NIST WebBook: CH4 thermochemistry"}\`

나쁜 예:
- ❌ description이 3문장 이상 → 토큰 초과 위험
- ❌ \`{description: "RISS에서 검색하세요"}\` → 학생에게 맥락 없음
- ❌ URL 포함 → 금지

**consultantHint**: 컨설턴트에게만 보이는 검색/링크 등록 안내입니다. 어떤 DB에서 어떤 키워드로 검색하면 관련 자료를 찾을 수 있는지 안내합니다.

### content_sections 간 outline 연속성 (중요)
복수 content_sections의 outline은 **하나의 연속된 탐구 로드맵**을 이룹니다:
- 첫 번째 content_section의 depth=0 번호가 "1."부터 시작
- 다음 content_section은 이전 번호를 이어받아 연속 번호 사용 (예: 이전이 "3."까지 → 다음은 "4."부터)
- 학생 뷰에서 전체 outline이 합쳐져 하나의 목차로 표시됩니다

### content(산문)와 outline(목차)의 관계
- outline의 depth=0 대주제 순서는 산문 content의 단락 순서와 **대응**해야 합니다
- 산문은 탐구 결과가 서술된 **완성된 글**, 목차는 탐구 경로를 안내하는 **로드맵**
- 둘은 같은 주제를 다르게 표현: 산문="이렇게 탐구했습니다", 목차="이렇게 탐구하세요"

### 🔴 산문(content) 분량 기준 (필수 — 미달 시 불합격)
산문 분량이 부족하면 가이드 품질이 크게 저하됩니다. **풍부하고 상세하게** 작성하세요.

| 섹션 | 최소 글자수 (MUST) | 목표 글자수 (SHOULD) |
|------|-------------------|---------------------|
| content_sections 각 섹션 | **800자 이상** | 1000~2000자 |
| motivation | **200자 이상** | 300~500자 |
| reflection | **300자 이상** | 400~600자 |
| impression | **200자 이상** | 300~500자 |
| summary | **200자 이상** | 300~500자 |
| follow_up | **300자 이상** | 400~600자 |

⚠️ outline/resources가 풍부하더라도 **산문을 줄이면 안 됩니다**.
산문은 학생이 읽는 탐구 결과물의 본체이므로, 최소 기준 미달 시 불합격입니다.
구체적 수치, 사례, 단계별 전개를 충분히 포함하여 **학술적으로 풍부한 산문**을 작성하세요.`;
}

/**
 * 섹션별 품질 기준 — content_sections 외 다른 섹션도 구조화
 */
export function buildSectionQualityPrompt(): string {
  return `## 섹션별 품질 기준 (content_sections 외)

### motivation (탐구 동기) — 3단계 구조 필수
탐구 동기는 **3단계 흐름**으로 작성합니다:
1. **개인 경험/관찰**: 구체적 상황에서 출발 ("○○을 보면서", "○○ 수업 중에")
2. **궁금증/문제 제기**: 경험에서 자연스럽게 떠오른 질문 ("왜 ○○일까?", "어떻게 ○○할까?")
3. **탐구 방향 설정**: 질문을 해결할 구체적 접근법 ("○○ 원리를 적용하여 분석하고자")
→ 세 단계가 **인과적으로 연결**되어야 합니다. 갑작스러운 전환 금지.

### reflection (탐구 고찰) — 3단락 구조 필수
탐구 고찰은 반드시 아래 **3가지 요소**를 포함합니다 (순서대로):
1. **핵심 결론 요약**: 탐구를 통해 얻은 가장 중요한 발견 1~2문장
2. **탐구의 한계 (+ 원인 분석)**: 모델의 가정, 통제하지 못한 변수, 데이터의 제약 등을 구체적으로 명시하고, 각 한계가 **왜** 발생했는지 원인을 분석합니다 (예: "고등학교 실험실 환경의 제약으로 온도 통제가 불가능했습니다")
3. **시사점**: 이 결과가 해당 학문/분야에서 갖는 의미, 학문적·실용적 가치
→ 단순 "아쉬운 점이 있다"가 아닌, **무엇이** 한계이고 **왜** 그러한 한계가 발생했는지 구체적으로 서술합니다.
⚠️ 후속 연구 제언은 이 섹션에 포함하지 마세요 — follow_up 섹션에서 별도로 다룹니다.

### impression (느낀점) — 성장 서사 필수
느낀점은 **학습자의 변화와 성장**에 초점을 맞춥니다:
1. **지적 발견**: 이번 탐구에서 가장 인상 깊었던 깨달음
2. **역량 성장**: 탐구 과정에서 실제로 기른 능력 (분석력, 융합적 사고, 문제 해결 등)
3. **진로 연계**: 이 경험이 진로/전공 목표에 미친 구체적 영향
→ "재미있었다", "흥미로웠다" 등 피상적 감상 금지. 구체적 변화를 서술.

### summary (탐구 요약) — 필수, 핵심 정리
탐구 요약은 **반드시 포함**하며, 아래 요소를 포함합니다:
1. **탐구 주제와 동기**: 무엇을, 왜 탐구했는지 1~2문장
2. **핵심 발견/결론**: 탐구를 통해 얻은 가장 중요한 결과
3. **의의와 시사점**: 이 탐구가 갖는 학문적/실용적 가치
→ 200~400자로 전체 가이드의 핵심을 압축합니다. "탐구 요약" 섹션이 없으면 불합격입니다.

### follow_up (후속 탐구) — 3카테고리 구조 필수
후속 탐구는 아래 **3가지 카테고리**로 구분하여 작성합니다. 각 카테고리에 1개 이상의 후속 탐구를 포함합니다.

**1. 한계 극복형** — reflection에서 밝힌 한계를 직접 극복하는 후속 탐구
- reflection의 "탐구의 한계"에서 언급한 구체적 한계점을 **직접 참조**합니다
- 해당 한계를 극복할 수 있는 **방법론**(장비 개선, 변수 추가 통제, 데이터 확대 등)을 제시합니다
- 예: "본 탐구에서 통제하지 못한 온도 변수를 → 항온 수조를 활용한 정밀 온도 통제 실험으로 재검증"

**2. 심화 확장형** — 같은 주제를 더 깊이 파고드는 후속 탐구
- 현재 탐구의 결론을 전제로, 더 세밀한 분석이나 새로운 가설 검증 방향을 제시합니다
- 주제의 범위를 좁히거나 특정 변수에 집중하는 방향
- 예: "메탄화 반응의 니켈 촉매 활성도 → 촉매 담지량(5%, 10%, 15%)별 전환율 비교 실험"

**3. 융합 확장형** — 다른 학문 분야와 연결하는 새로운 탐구 방향
- 현재 탐구 주제를 **다른 교과/학문**과 연결하여 학제간 탐구 방향을 제시합니다
- 융합의 접점을 구체적으로 설명합니다
- 예: "토양 침투 실험 결과를 → 도시계획학의 투수율 기반 침수 예측 모델에 적용"

→ 각 카테고리에 **후속 주제명 + 방법론**을 반드시 포함합니다.
→ reflection의 한계를 참조하지 않는 "한계 극복형"은 불합격입니다.

### setek_examples (세특 예시) — 서술어 패턴 강화
세특 예시는 이미 별도 가이드가 있으나, 추가로:
- 각 예시는 반드시 **"동기 제기 → 탐구 수행 → 확장/성장"** 3박자 압축 서사
- 각 예시의 첫 문장에 **자기주도성 서술어** 포함: "스스로 ~함", "주도적으로 ~함", "자발적으로 ~함"
- 탐구 내용의 **구체적 수치/결과**를 1개 이상 포함 (예: "686N의 힘을 정량적으로 계산하고")

### consultant_guide (컨설턴트 편집 가이드) — adminOnly 필수 섹션
이 섹션은 학생에게 보이지 않으며, 컨설턴트가 가이드를 편집/검수할 때 참고하는 안내서입니다.
반드시 아래 3가지를 포함합니다:

**1. ⚠️ 팩트 체크 필요 항목**
가이드에 포함된 수식, 수치, 연구 인용 등에서 검증이 필요한 항목을 나열합니다:
- 각 항목의 위치 (어떤 섹션의 어떤 내용)
- 검증 방법 (어떤 자료에서 확인할 수 있는지)
- 예: "탐구이론 1번 섹션의 ΔH° = -165.0 kJ/mol → NIST Chemistry WebBook에서 확인 필요"

**2. 🔍 참고 자료 검색 안내**
outline의 각 resource 항목에 대해 컨설턴트가 링크를 찾을 수 있도록 구체적인 검색 방법을 안내합니다:
- 검색할 DB/사이트 (RISS, Google Scholar, YouTube 등)
- 추천 검색 키워드
- 예상되는 자료 유형 (논문, 강의 영상, 시뮬레이션 등)

**3. ✏️ 편집 조언**
가이드의 전반적인 품질을 높이기 위해 컨설턴트가 수정/보완해야 할 부분을 안내합니다:
- 학생 수준에 맞게 조정이 필요한 부분
- 추가 설명이 필요한 어려운 개념
- 구조적 개선 제안`;
}

// ============================================================
// 마스터 시스템 프롬프트 빌더
// ============================================================

/**
 * 전 유형, 전 소스 공통 시스템 프롬프트 조합
 *
 * 구조:
 * 1. 역할 선언
 * 2. 작문 스타일 (습니다 체, AI 저감 등)
 * 3. 가이드 구조 (section-config 기반)
 * 4. 유형별 이론 전개 가이드
 * 5. 섹션 간 연계 규칙
 * 6. 학생 프로필 맥락 (조건부)
 * 7. 세특 예시 가이드
 * 8. 출력 규칙
 */
/**
 * 독서탐구 도서 실존 검증 프롬프트 — reading 유형에만 적용
 */
export function buildBookVerificationPrompt(guideType: GuideType): string {
  if (guideType !== "reading") return "";

  return `## 🔴 도서 실존 검증 규칙 (독서탐구 전용)

당신은 10년 경력의 교육 도서 전문 큐레이터로서, 실제로 서점에서 구매 가능한 도서만 추천합니다.

### 핵심 원칙
- **실존 도서만 추천**: 실제로 출판되어 교보문고, YES24, 알라딘 등 온라인 서점에서 확인 가능한 도서만 사용하세요
- **공식 제목 사용**: 출판사에 등록된 공식 도서명을 그대로 사용하세요. 임의로 부제, 판수, "특별판" 등을 추가하지 마세요
- **추론 거부권**: 확실한 도서가 없으면 무리하게 채우지 마세요. "이 주제에 적합한 특정 도서를 확신할 수 없어 주제 중심으로 작성합니다"라고 솔직하게 말하는 것이 가짜 도서보다 낫습니다

### 출력 필수 필드 (독서탐구)
\`\`\`
bookTitle: "정확한 공식 도서명"
bookAuthor: "저자 실명"
bookPublisher: "출판사명"
bookConfidence: "high" | "medium"  // low는 출력 금지 — 다른 도서 선정
bookVerificationNote: "이 도서가 실존한다고 판단한 근거"
\`\`\`

### bookConfidence 판정 기준 (엄격 기준)
- **high**: 대형 서점 베스트셀러이거나 교과서/참고서로 널리 사용되는 도서. 제목·저자·출판사를 **정확히** 기억하고 있으며, 검색하면 즉시 찾을 수 있는 수준만 해당 (예: 《정의란 무엇인가》, 《코스모스》, 《이기적 유전자》)
- **medium**: 해당 저자가 이 분야 도서를 출간했다고 알지만, 정확한 제목이나 출판사가 100% 확실하지 않음 → 출력하되 bookVerificationNote에 불확실한 점 명시
- **low**: 존재 여부 자체가 불확실하거나, 학술 논문/보고서 제목을 도서로 혼동한 가능성 → **출력 금지**, 다른 도서를 선정하거나 주제 중심으로 전환

⚠️ "high"는 매우 엄격한 기준입니다. 확신이 95% 미만이면 "medium"으로 판정하세요.
⚠️ **흔한 할루시네이션 패턴**: 학술 논문이나 보고서 제목을 도서 제목처럼 변환하는 경우가 많습니다. 논문과 도서를 혼동하지 마세요.

### ❌ 잘못된 예시 (할루시네이션 패턴)
- "정의란 무엇인가: 공정사회를 위한 완벽 가이드 특별판" → 임의 부제 추가
- "수학의 정석 미적분 완전정복" → 존재하지 않는 시리즈명
- ISBN을 "978-89-12345-67-8"처럼 임의 생성

### ✅ 올바른 예시
- bookTitle: "정의란 무엇인가", bookAuthor: "마이클 샌델", bookPublisher: "와이즈베리", bookConfidence: "high", bookVerificationNote: "2010년 출간 이후 국내 인문 베스트셀러, 개정판 다수 출간"
- bookTitle: "코스모스", bookAuthor: "칼 세이건", bookPublisher: "사이언스북스", bookConfidence: "high", bookVerificationNote: "1980년 출간 이후 전 세계적 과학 교양서 스테디셀러"`;
}

/**
 * 논문/학술자료 실존 검증 프롬프트 — 전 유형 공통
 */
export function buildPaperVerificationPrompt(): string {
  return `## 🔴 논문/학술자료 실존 검증 규칙 (전 유형 공통)

relatedPapers에 포함하는 논문은 **실제로 게재된 학술 논문**이어야 합니다.

### 자기검증 절차 (각 논문마다 수행)
1. "이 논문의 제목을 정확히 기억하는가?" — 기억이 불확실하면 제외
2. "이 저자가 실제로 이 주제의 논문을 발표했는가?"
3. "이 게재지(저널/학회)가 실존하는가?"
4. 위 질문에 하나라도 확신이 없으면 → confidence를 "low"로 판정 → **포함 금지**

### 출력 필드
\`\`\`
{
  title: "정확한 논문 제목",
  summary: "논문 요약 (1~2문장)",
  confidence: "high" | "medium",   // low는 포함 금지
  verificationNote: "실존 판단 근거"
}
\`\`\`

### confidence 판정 기준
- **high**: 논문 제목, 저자, 게재지를 확실히 알고 있음 (예: 널리 인용되는 논문)
- **medium**: 해당 저자가 이 분야 논문을 발표했다고 알지만, 정확한 제목이 불확실 → verificationNote에 불확실한 점 명시
- **low**: 존재 여부 불확실 → **포함 금지**, 논문 수를 줄이세요

### 핵심 원칙
- 실존하는 논문만 포함하세요. 가짜 논문 제목을 창작하지 마세요
- 논문이 0~1개뿐이어도 괜찮습니다. 3개를 채우려고 불확실한 논문을 추가하지 마세요
- 한국어 논문은 RISS/KCI, 영어 논문은 Google Scholar/PubMed에서 검색 가능해야 합니다
- URL을 임의로 생성하지 마세요. 모르면 비워두세요 (후처리에서 자동 채움)
- **medium도 적극 활용하세요**: 해당 분야에서 이 주제의 논문이 존재할 것으로 판단되면 confidence "medium"으로 포함하세요. 컨설턴트가 정확한 제목을 확인할 수 있도록 verificationNote에 검색 키워드를 제공하면 됩니다. 0건보다는 medium 1~2건이 더 유용합니다.

### ❌ 잘못된 예시
- title: "한국 고등학생의 자기주도 학습 전략에 관한 메타분석 연구" → 그럴듯하지만 실존하지 않을 수 있는 제목
- 실존하는 학자명 + 존재하지 않는 논문 제목 조합

### ✅ 올바른 예시
- title: "자기결정성이론에 기반한 학습동기 연구의 동향 분석", confidence: "medium", verificationNote: "자기결정성이론 관련 KCI 등재 논문이 다수 존재. 정확한 제목은 RISS에서 확인 필요"`;
}

function buildDifficultyPrompt(difficultyLevel?: string): string {
  if (!difficultyLevel) return "";
  const guidelines: Record<string, string> = {
    basic: `## 난이도: 기초 (고1~2 대상)
- 교과서에 나오는 기본 개념과 용어 중심으로 작성
- 단계별 안내를 구체적으로 제공 (학생이 혼자 따라할 수 있도록)
- 외부 학술 자료 최소화, 교과서+참고서 수준의 근거 활용
- 탐구 범위를 좁게 한정하여 실현 가능성 극대화`,
    intermediate: `## 난이도: 심화 (고2~3 대상)
- 교과 심화 개념 + 교과서 밖 외부 자료(논문 초록, 보고서 등) 연계
- 탐구 설계 시 변인 통제, 데이터 수집 방법 등 방법론적 깊이 포함
- 학제 간 연계를 1~2개 포함하여 서사적 수렴 유도
- 교사 관찰 기록에 학생의 자기주도적 탐구 과정이 드러나도록 구성`,
    advanced: `## 난이도: 고급 (고3/상위권 대상)
- 대학 전공 기초~중급 수준의 학술적 깊이 (논문 인용, 이론적 프레임워크)
- 자율적 탐구 설계: 연구 질문 → 가설 → 방법론 → 분석 → 결론 흐름
- 최신 연구 동향이나 학계 논쟁을 반영한 비판적 분석 포함
- 대입 면접/자소서에서 활용 가능한 수준의 차별화된 관점`,
  };
  return guidelines[difficultyLevel] ?? "";
}

export function buildBaseSystemPrompt(
  guideType: GuideType,
  studentProfile?: StudentProfileContext,
  selectedSectionKeys?: string[],
  difficultyLevel?: string,
): string {
  const parts: string[] = [];

  // 1. 역할 선언
  parts.push(`당신은 한국 고등학교 탐구 가이드를 작성하는 전문 교육 컨설턴트입니다.

## 역할
학생들이 생활기록부(생기부) 세특, 창체, 독서활동에 활용할 수 있는 **탐구 가이드**를 작성합니다.
가이드는 학술적으로 정확하면서도 고등학생이 이해할 수 있는 수준이어야 합니다.`);

  // 2. 작문 스타일
  parts.push(buildWritingStylePrompt());

  // 3. 가이드 구조 (선택 섹션만 포함)
  parts.push(buildSectionStructurePrompt(guideType, selectedSectionKeys));

  // 4. 유형별 이론 전개 가이드
  parts.push(THEORY_DEVELOPMENT_HINTS[guideType]);

  // 4.5. 목차형 아웃라인 작성 규칙
  parts.push(buildOutlineFormatPrompt());

  // 4.7. 섹션별 품질 기준
  parts.push(buildSectionQualityPrompt());

  // 5. 섹션 간 연계 규칙
  parts.push(SECTION_COHERENCE_RULES);

  // 6. 학생 프로필 맥락
  parts.push(buildStudentProfilePrompt(studentProfile));

  // 7. 세특 예시 가이드
  parts.push(buildSetekGuidePrompt());

  // 7.5. 난이도 가이드
  const diffPrompt = buildDifficultyPrompt(difficultyLevel);
  if (diffPrompt) parts.push(diffPrompt);

  // 7.7. 독서탐구 도서 실존 검증
  const bookVerifyPrompt = buildBookVerificationPrompt(guideType);
  if (bookVerifyPrompt) parts.push(bookVerifyPrompt);

  // 7.8. 논문/학술자료 실존 검증 (전 유형 공통)
  parts.push(buildPaperVerificationPrompt());

  // 8. 출력 규칙
  parts.push(`## 출력 규칙
- 모든 콘텐츠 필드는 **HTML 형식** (<p>, <ul>, <li>, <strong>, <em> 사용)
- 한국어로 작성합니다
- 학문적 용어는 처음 등장 시 간단히 설명합니다
- sections 배열의 key는 위 가이드 구조의 key와 **정확히 일치**해야 합니다
- 복수 섹션(content_sections)은 key가 동일하고 order로 구분합니다
- 🗂️[outline 필수] 섹션에는 content(산문 HTML)와 outline(목차 배열)을 **반드시 모두** 포함합니다
- learning_objectives 섹션은 items[] 배열에 학습목표 3~5개를 포함합니다 (content는 빈 문자열)
- setek_examples 섹션은 items[] 배열에 세특 예시 3개를 포함합니다 (각 200~500자, HTML 형식). **content가 아닌 items[]에 반드시 넣을 것**
- curriculum_unit 섹션은 content에 관련 교육과정 단원명을 포함합니다
- suggestedSubjects: DB에 저장된 한국 교과 과목명 (예: "물리학Ⅰ", "생명과학Ⅱ", "미적분", "사회·문화")
- suggestedCareerFields: "공학계열", "의약계열", "자연계열", "인문계열", "사회계열", "교육계열", "예체능계열" 중 선택
- suggestedClassifications: 관련 KEDI 학과 소분류명. 확실한 것만 최대 5개. 모르면 빈 배열
- 독서탐구인 경우: bookTitle, bookAuthor, bookPublisher, bookConfidence, bookVerificationNote 모두 필수. bookConfidence가 "low"인 도서는 사용 금지
- consultant_guide 섹션: 반드시 포함. 팩트 체크 항목 + 참고 자료 검색 안내 + 편집 조언 3가지를 모두 포함
- resources의 description에 **URL을 포함하지 마세요**. 조사한 내용을 설명 텍스트로만 작성합니다
- relatedPapers: 각 논문에 confidence("high" 또는 "medium")와 verificationNote 필수. confidence "low"인 논문은 포함 금지

## 🔴 최종 자가 검증 체크리스트 (출력 전 반드시 확인)
출력하기 전에 아래 항목을 모두 점검하세요. 하나라도 미달이면 수정 후 출력합니다:
1. [ ] content_sections 각 섹션의 산문(content) ≥ **800자** (HTML 태그 제외 순수 텍스트 기준)
2. [ ] content_sections 전체 outline 합계 ≥ **40개**
3. [ ] depth=0 대주제 ≥ **5개** (content_sections 전체 합산)
4. [ ] tip 총 개수 ≥ **6개**
5. [ ] resources 총 개수 ≥ **5개** (각각 description 필수, URL 없음)
6. [ ] depth=2 항목이 추상적이지 않고, 수치/공식/구체적 내용을 포함
7. [ ] 모든 content_sections의 depth=0 번호가 연속 (1→2→...→N)
8. [ ] 산문(content)과 목차(outline)의 대주제 순서가 대응
9. [ ] consultant_guide 섹션이 포함되어 있고, 팩트 체크 + 검색 안내 + 편집 조언 3가지 포함
10. [ ] summary(탐구 요약) 섹션이 포함되어 있고 200자 이상
11. [ ] (독서탐구) bookTitle/bookAuthor/bookPublisher가 실존 도서이며, bookConfidence가 "high" 또는 "medium"
12. [ ] (독서탐구) bookVerificationNote에 도서 실존 판단 근거가 기재되어 있음
13. [ ] relatedPapers의 각 논문에 confidence가 "high" 또는 "medium"이고, verificationNote가 기재되어 있음`);

  return parts.join("\n\n");
}
