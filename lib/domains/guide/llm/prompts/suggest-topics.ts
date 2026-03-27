/**
 * AI 탐구 주제 추천 프롬프트
 * 교육과정 + 역량 가중치 + 전공 권장교과 맥락을 주입하여
 * 교육적으로 의미 있는 탐구 주제 10개를 생성한다.
 */

import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";
import type { GuideType } from "@/lib/domains/guide/types";
import { getMajorRecommendedCourses } from "@/lib/domains/student-record/constants";
import { CAREER_FIELD_COMPETENCY_WEIGHTS } from "@/lib/domains/bypass-major/constants";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";

export const SUGGEST_TOPICS_SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 주제 추천 전문가입니다.

## 역할
학생의 생활기록부(생기부) 세특, 창체, 독서활동에 활용할 수 있는 **탐구 주제**를 추천합니다.

## 품질 기준 (7가지)
1. **교육과정 정합** — 해당 교과/과목의 교육과정 성취기준과 연결되는 주제
2. **역량 개발** — 목표 전공의 핵심역량 2~3개를 집중 개발할 수 있는 주제
3. **서사 연결** — 다른 교과 활동과 주제적 수렴(theme convergence)이 가능한 주제
4. **학생 접근성** — 고등학생이 실제로 탐구를 수행할 수 있는 현실적 수준
5. **세특 작성성** — 교사가 200자 관찰 기록을 작성할 수 있을 만큼 구체적인 주제
6. **후속 확장성** — 다음 학기/학년에서 심화 탐구로 이어질 수 있는 주제
7. **차별화** — 흔한 주제가 아닌 독창적 관점이 담긴 주제

## 출력 규칙
- 주제 타이틀: 20~60자, 구체적 학술 개념 포함 (예: "CRISPR-Cas9" > "유전자 편집")
- 추천 이유: 1문장 (왜 이 주제가 해당 과목+계열에 적합한지)
- 연계 과목: 이 주제로 탐구 시 활용 가능한 과목 최대 3개
- **복수 교과 연계를 권장**: 1개 주제가 2~3개 과목에서 활용될 수 있도록 설계
- **난이도**: 각 주제에 난이도를 반드시 지정
  - basic: 교과서 기본 개념 수준, 고1~2 학생이 수행 가능
  - intermediate: 교과 심화 + 외부 자료 연계, 고2~3 적합
  - advanced: 논문/학술 수준, 고3/상위권 대상
- 한국어로 작성
`;

export function buildSuggestTopicPrompt(input: {
  guideType: string;
  subject?: string;
  careerField?: string;
  targetMajor?: string;
  curriculumYear?: number;
  majorUnit?: string;
  minorUnit?: string;
  existingTitles?: string[];
}): string {
  const parts: string[] = [];

  // 기본 조건
  const typeLabel =
    GUIDE_TYPE_LABELS[input.guideType as GuideType] ?? input.guideType;
  parts.push("## 조건");
  if (input.curriculumYear) {
    parts.push(`- 개정교육과정: ${input.curriculumYear}년 개정`);
  }
  parts.push(`- 가이드 유형: ${typeLabel}`);
  if (input.subject) {
    parts.push(
      `- 주요 과목: ${input.subject} (이 과목 중심, 타 과목 연계 가능)`,
    );
  }
  if (input.majorUnit) {
    parts.push(`- 대단원: ${input.majorUnit}`);
  }
  if (input.minorUnit) {
    parts.push(`- 소단원: ${input.minorUnit} (이 단원의 학습 내용에 맞는 주제 추천)`);
  }
  if (input.careerField) {
    parts.push(`- 관련 계열: ${input.careerField}`);
  }

  // 교육적 맥락 (전공 권장교과 + 역량 가중치)
  if (input.targetMajor) {
    const courses = getMajorRecommendedCourses(
      input.targetMajor,
      input.curriculumYear,
    );
    if (courses) {
      parts.push("\n## 교육적 맥락");
      parts.push(
        `- 전공 권장 교과 (일반): ${courses.general.join(", ")}`,
      );
      if (courses.career.length > 0) {
        parts.push(`- 전공 권장 교과 (진로): ${courses.career.join(", ")}`);
      }
      if (courses.fusion && courses.fusion.length > 0) {
        parts.push(`- 전공 권장 교과 (융합): ${courses.fusion.join(", ")}`);
      }
    }

    // 핵심 역량 (가중치 1.2 이상만)
    const weights = CAREER_FIELD_COMPETENCY_WEIGHTS[input.targetMajor];
    if (weights) {
      const topCompetencies = Object.entries(weights)
        .filter(([, w]) => w >= 1.2)
        .sort(([, a], [, b]) => b - a)
        .map(([code, w]) => {
          const item = COMPETENCY_ITEMS.find((i) => i.code === code);
          return `${item?.label ?? code}(${w}배)`;
        });
      if (topCompetencies.length > 0) {
        parts.push(
          `- 핵심 역량: ${topCompetencies.join(", ")}`,
        );
      }
    }
  }

  // 중복 회피
  if (input.existingTitles && input.existingTitles.length > 0) {
    parts.push("\n## 중복 회피 (아래 주제와 다른 관점으로)");
    for (const t of input.existingTitles.slice(0, 5)) {
      parts.push(`- ${t}`);
    }
  }

  parts.push(
    "\n위 조건에 맞는 탐구 주제 10개를 제안하세요.\n한 주제가 여러 교과에 걸쳐 활용될 수 있도록 설계하세요.",
  );

  return parts.join("\n");
}
