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
  const defs = selectedKeys
    ? allDefs.filter(
        (d) =>
          selectedKeys.includes(d.key) ||
          (d.tier ?? "core") === "core", // Core는 항상 포함
      )
    : allDefs;

  const lines: string[] = [];
  lines.push(`## 가이드 구조 (${GUIDE_TYPE_LABELS[guideType]})`);
  lines.push(
    "sections 배열의 각 항목은 아래 key와 정확히 일치해야 합니다.\n",
  );

  for (const def of defs) {
    const reqTag = def.required ? "(필수)" : "(선택)";
    const tierTag =
      def.tier === "type_extension"
        ? " [유형확장]"
        : def.tier === "optional"
          ? " [선택보강]"
          : "";
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
      `- key=\`${def.key}\` **${def.label}** ${reqTag}${tierTag}${multiHint}${lengthHint}${outlineTag}${desc}`,
    );
  }

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

### outline의 역할
outline은 **학생이 따라갈 탐구 로드맵(학습 경로)**입니다:
- "어떤 내용을 조사/탐구/실험하라"는 안내
- "어떤 순서로 진행하라"는 흐름
- "어떤 자료를 참고하라"는 리소스 안내
→ content(산문)이 "탐구 결과물"이라면, outline은 "탐구 안내서"입니다.

### tip 사용 규칙 (학생 공개)
tip은 **학생에게 직접 보이는 안내**입니다. 학생이 행동할 수 있는 구체적 지시만 작성합니다 (섹션당 1~3개):
- 좋은 예: "반드시 본인의 경험과 연결지어 해석할 것"
- 좋은 예: "5회 이상 반복 실험하여 표준편차 산출"
- 좋은 예: "교과서 p.142 적분 단원 참조"
- **금지**: 내부 코멘트, AI 관련 지시, 컨설턴트 메모 (예: "AI 의존도 낮출 것", "이 부분 검수 필요")
→ 내부 메모는 tip이 아닌 에디터 UI에서 별도로 관리합니다

### resources 사용 규칙
구체적 참고 자료를 포함합니다:
- 학술 DB: "RISS 키워드: ○○", "DBPIA 검색어: ○○"
- 교과서: "교과서 p.142-148 참조"
- 영상/웹: 관련 YouTube 채널명, 신뢰할 수 있는 웹사이트명

### content(산문)와 outline(목차)의 관계
- outline의 depth=0 대주제 순서는 산문 content의 단락 순서와 **대응**해야 합니다
- 산문은 탐구 결과가 서술된 **완성된 글**, 목차는 탐구 경로를 안내하는 **로드맵**
- 둘은 같은 주제를 다르게 표현: 산문="이렇게 탐구했습니다", 목차="이렇게 탐구하세요"`;
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
export function buildBaseSystemPrompt(
  guideType: GuideType,
  studentProfile?: StudentProfileContext,
  selectedSectionKeys?: string[],
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

  // 5. 섹션 간 연계 규칙
  parts.push(SECTION_COHERENCE_RULES);

  // 6. 학생 프로필 맥락
  parts.push(buildStudentProfilePrompt(studentProfile));

  // 7. 세특 예시 가이드
  parts.push(buildSetekGuidePrompt());

  // 8. 출력 규칙
  parts.push(`## 출력 규칙
- 모든 콘텐츠 필드는 **HTML 형식** (<p>, <ul>, <li>, <strong>, <em> 사용)
- 한국어로 작성합니다
- 학문적 용어는 처음 등장 시 간단히 설명합니다
- sections 배열의 key는 위 가이드 구조의 key와 **정확히 일치**해야 합니다
- 복수 섹션(content_sections)은 key가 동일하고 order로 구분합니다
- 🗂️[outline 필수] 섹션에는 content(산문 HTML)와 outline(목차 배열)을 **반드시 모두** 포함합니다
- learning_objectives 섹션은 items[] 배열에 학습목표 3~5개를 포함합니다
- curriculum_unit 섹션은 content에 관련 교육과정 단원명을 포함합니다
- suggestedSubjects: DB에 저장된 한국 교과 과목명 (예: "물리학Ⅰ", "생명과학Ⅱ", "미적분", "사회·문화")
- suggestedCareerFields: "공학계열", "의약계열", "자연계열", "인문계열", "사회계열", "교육계열", "예체능계열" 중 선택
- suggestedClassifications: 관련 KEDI 학과 소분류명. 확실한 것만 최대 5개. 모르면 빈 배열
- 독서탐구인 경우: 도서명(bookTitle), 저자(bookAuthor), 출판사(bookPublisher) 필수`);

  return parts.join("\n\n");
}
