// ============================================
// α1-2: 봉사 역량 태깅 프롬프트
// community_caring / community_leadership 중심 공동체 역량 분석
// ============================================

import type { VolunteerAnalysisInput } from "../types";

// ============================================
// 시스템 프롬프트
// ============================================

export const VOLUNTEER_COMPETENCY_SYSTEM_PROMPT = `당신은 대입 학종(학생부 종합전형) 전문 컨설턴트입니다.
학생의 봉사활동 기록을 분석하여 공동체 역량을 태깅합니다.

## 분석 목적

학종 정성평가에서 봉사활동은 "공동체 역량(community_caring, community_leadership)"의 근거로 활용됩니다.
LLM은 각 봉사 활동의 description을 읽고, 해당 활동이 어떤 역량을 드러내는지 태깅합니다.

## 역량 코드 (봉사 관련)

- **community_caring**: 타인/공동체를 돌보는 마음. 지속적 참여, 취약계층 지원, 공감 행동이 근거.
  예: 복지시설 반복 방문, 장애인·노인 지원, 환경 보전, 공동체 헌신
- **community_leadership**: 봉사 활동 내 주도적 역할, 조직화, 리더십 발휘.
  예: 봉사 모임 조직, 행사 기획·진행, 팀장 역할, 새로운 봉사 프로그램 제안
- **career_exploration** (선택): 봉사가 전공 탐색과 명확히 연결된 경우만.
  예: 의료봉사(의대 지망), 교육봉사(교육 지망)

## 태깅 규칙

1. **근거 중심**: description에 명시된 내용만 태깅합니다. 추측 금지.
2. **평가 구분**:
   - positive: 해당 역량이 긍정적으로 드러남
   - needs_review: 내용이 부족하거나 컨설턴트 확인 필요
   - negative: 거의 사용하지 않음 (봉사활동 특성상 드문 케이스)
3. **description 없음 또는 단순 시간 기록**: community_caring needs_review로 기본 태깅.
4. **competencyTags는 봉사 1건 = 1~2개 태그**가 적정합니다.
5. **JSON 형식으로만 응답합니다.**

## 출력 형식

\`\`\`json
{
  "recurringThemes": ["환경 보전", "복지 지원"],
  "caringEvidence": [
    "노인복지관 정기 방문을 통해 공동체 돌봄 의지를 지속적으로 보여줌",
    "교내 환경 정화 활동 참여로 공동체 환경 개선에 기여"
  ],
  "leadershipEvidence": [
    "봉사 팀장 역할로 후배 봉사자 교육 및 일정 조율"
  ],
  "competencyTags": [
    {
      "volunteerId": "uuid-예시",
      "competencyItem": "community_caring",
      "evaluation": "positive",
      "reasoning": "복지시설 정기 방문을 통해 지속적 돌봄 행동이 확인됨"
    },
    {
      "volunteerId": "uuid-예시-2",
      "competencyItem": "community_leadership",
      "evaluation": "positive",
      "reasoning": "봉사 모임 조직 및 행사 기획 역할이 description에 명시됨"
    }
  ]
}
\`\`\`

주의: totalHours는 응답에 포함하지 마세요. 시간은 서버에서 별도 계산합니다.`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

export function buildVolunteerCompetencyPrompt(
  input: VolunteerAnalysisInput,
): { system: string; user: string } {
  const lines: string[] = [];

  lines.push(`## 분석 대상: ${input.grade}학년 봉사활동`);
  lines.push("");

  if (input.targetMajor) {
    lines.push(`**목표 전공**: ${input.targetMajor}`);
    lines.push("");
  }

  if (input.profileCard) {
    lines.push("## 이전 학년 역량 프로필 (참고용)");
    lines.push(input.profileCard);
    lines.push("");
  }

  lines.push(`## 봉사활동 목록 (${input.activities.length}건)`);
  lines.push("");

  for (const act of input.activities) {
    lines.push(`### 봉사 ID: ${act.id}`);
    lines.push(`- 활동일: ${act.activityDate ?? "미상"}`);
    lines.push(`- 시간: ${act.hours}시간`);
    if (act.description) {
      lines.push(`- 활동 내용: ${act.description}`);
    } else {
      lines.push(`- 활동 내용: (기록 없음)`);
    }
    lines.push("");
  }

  lines.push("위 봉사활동 기록을 분석하여 JSON 형식으로 역량을 태깅해주세요.");
  lines.push("각 봉사 항목(volunteerId)에 대해 1~2개 태그를 생성하고,");
  lines.push("recurringThemes(2~5개 키워드), caringEvidence(최대 3문장), leadershipEvidence(최대 2문장, 없으면 빈 배열)를 채워주세요.");

  return {
    system: VOLUNTEER_COMPETENCY_SYSTEM_PROMPT,
    user: lines.join("\n"),
  };
}
