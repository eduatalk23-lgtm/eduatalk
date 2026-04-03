/**
 * 생기부 품질 평가 골든 데이터셋
 *
 * 50개 샘플: 세특(36) + 창체(8) + 행특(6)
 * 각 샘플은 예상 품질 기준(점수 범위, 이슈 감지 여부)을 포함.
 *
 * 사용처:
 *   - scripts/eval-student-record.ts (회귀 스크립트)
 *   - lib/domains/student-record/__tests__/golden-dataset-eval.test.ts (CI 검증)
 *
 * 이슈 코드 접두사 매칭 규칙:
 *   mustHaveIssues: 코드 접두사가 issues 배열 어딘가에 포함되어야 함 (부분 매칭)
 *   mustNotHaveIssues: 코드 접두사가 issues 배열에 전혀 없어야 함
 *
 * 카테고리:
 *   A: 고품질 세특 (score ≥ 65) — 8단계 완전, 교사관찰, 성장서사
 *   B: P1 나열식 — 단원명/개념 열거, 연결성 없음
 *   C: F2 인과단절 — 비약적 논리 도약
 *   D: F10 성장부재 — 변화/극복/깨달음 없음
 *   E: F16 진로과잉도배 — 모든 교과에 진로 억지 연결
 *   F: M1 교사관찰불가 — 교사 관찰·평가 문장 부재
 *   G: P3 키워드만 — 탐구 과정 없이 개념어 나열
 *   H: F12 자기주도성부재 — 수동적 수용, 학생 주도 활동 없음
 *   I: P4 내신탐구불일치 — 내신 고등급 주장 vs 탐구 내용 미흡
 *   G-창: 창체 고품질
 *   P-창: 창체 저품질
 *   H-행: 행특 고품질
 *   L-행: 행특 저품질
 *   Z: 경계값/복합 패턴
 */

export interface EvalExpectation {
  /** contentQuality.overallScore >= this */
  minScore?: number;
  /** contentQuality.overallScore <= this */
  maxScore?: number;
  /** 이 코드들이 issues 배열에 모두 포함되어야 함 (접두사 매칭) */
  mustHaveIssues?: string[];
  /** 이 코드들이 issues 배열에 하나도 없어야 함 (접두사 매칭) */
  mustNotHaveIssues?: string[];
}

export interface EvalSample {
  id: string;
  description: string;
  recordType: "setek" | "changche" | "haengteuk";
  subjectName?: string;
  grade?: number;
  content: string;
  expected: EvalExpectation;
}

export const GOLDEN_DATASET: EvalSample[] = [
  // ─── 카테고리 A: 고품질 세특 (score ≥ 65) ─────────────────────────────────

  {
    id: "setek-high-math",
    description: "수학I — 8단계 완전, 자기주도 탐구, 교사 평가 구체",
    recordType: "setek",
    subjectName: "수학I",
    grade: 2,
    content:
      "미분과 적분의 관계를 탐구하는 과정에서 단순 공식 암기를 넘어 극한의 개념에서 미분이 유도되는 과정을 직접 증명함. ε-δ 정의를 통해 연속성과 미분가능성의 관계를 탐구하고, 연속이지만 미분 불가능한 바이어슈트라스 함수를 조사하여 발표함. 수업 중 리만 합의 한계를 발견하고 르베그 적분의 개념을 교사에게 질문하여 토론함. 처음에는 ε-δ 논법의 추상성에 어려움을 겪었으나 수학적 귀납법과 연결하여 이해하게 됨. 교사는 '수학적 사고의 깊이가 고등학생 수준을 넘는다'고 평가함. 이를 통해 수학의 엄밀성이 응용보다 선행되어야 함을 깨달음.",
    expected: {
      minScore: 68,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-physics",
    description: "물리학I — 실험설계, 오차 분석, 성장서사 완비",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 2,
    content:
      "빛의 파동-입자 이중성 탐구에서 이중 슬릿 실험을 직접 설계하여 간섭무늬를 관찰함. 예상 파장과 실측값의 오차율 7.3%를 분석하여 슬릿 폭의 부정확성과 단색광 순도가 원인임을 밝힘. 드브로이 파장 공식을 적용하여 전자의 파동성을 수리적으로 검증함. 교사는 '오차 분석의 깊이가 고등학생 수준을 넘는다'고 평가함. 초기에는 간섭무늬 재현이 어려웠으나 광원 정렬을 개선하여 문제를 극복함. 이 경험을 통해 측정 불확실성이 양자역학의 불확정성 원리와 근본적으로 다름을 이해하게 됨.",
    expected: {
      minScore: 68,
      mustNotHaveIssues: ["P1", "F10", "F2"],
    },
  },

  {
    id: "setek-high-chem",
    description: "화학I — 갈바니전지 실험, 네른스트 방정식, 전공 연계",
    recordType: "setek",
    subjectName: "화학I",
    grade: 2,
    content:
      "산화-환원 반응에서 전자 전달 메커니즘을 탐구하여 갈바니 전지의 기전력(EMF) 변화를 실험으로 확인함. 네른스트 방정식을 이용하여 이론값(1.10V)과 실측값(1.07V)의 차이를 반응물 농도 변화로 설명함. 리튬이온 전지에서 흑연 대신 실리콘 음극재를 사용할 때의 이론적 에너지 밀도를 계산하여 발표함. 교사는 열역학적 접근 방식이 탁월하다고 평가함. 실험 초기 오차가 컸으나 온도 보정을 추가하여 정확도를 높임. 배터리 연구자를 목표로 구체적인 진로를 설계하게 됨.",
    expected: {
      minScore: 68,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-bio",
    description: "생명과학I — CRISPR 탐구, 윤리적 검토, 교사 평가",
    recordType: "setek",
    subjectName: "생명과학I",
    grade: 1,
    content:
      "유전자 편집 기술에 관심을 가지고 CRISPR-Cas9의 작동 원리를 탐구함. gRNA의 염기 서열 설계 원리와 Cas9 단백질의 절단 메커니즘을 논문을 통해 이해하고 이를 도식화하여 발표함. 특히 off-target 편집 문제를 발견하고 이를 최소화하는 고정밀 Cas9 변이체에 대한 최신 연구를 조사함. 교사는 생명윤리 쟁점까지 균형 있게 검토했다고 평가함. 처음에는 분자생물학 개념이 낯설었으나 생화학 교재를 참고하여 이해를 심화함. 이 탐구를 통해 기초과학 연구의 사회적 책임을 실감하게 됨.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-lit",
    description: "문학 — 텍스트 비판적 분석, 사회문화적 맥락 연결",
    recordType: "setek",
    subjectName: "문학",
    grade: 3,
    content:
      "김승옥의 「무진기행」을 읽고 안개의 상징성을 분석하여 발표함. 안개를 현실 회피와 자아 분열의 메타포로 읽으면서, 1960년대 산업화 시대의 지식인이 겪는 실존적 위기를 사회문화적 맥락에서 해석함. 주인공 윤희중의 귀향과 이탈 구조를 카뮈의 이방인과 비교하여 실존주의적 독해를 시도함. 교사는 문학작품을 사회사적 텍스트로 읽는 시각이 탁월하다고 평가함. 처음에는 텍스트 표면 읽기에 머물렀으나 토론을 통해 심층 읽기의 방법을 익히게 됨. 비판적 읽기가 모든 인문학의 출발점임을 깨달음.",
    expected: {
      minScore: 63,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-calculus",
    description: "미적분 — ε-δ 극한 증명, 테일러급수 응용, 교사 관찰",
    recordType: "setek",
    subjectName: "미적분",
    grade: 3,
    content:
      "테일러급수를 이용하여 삼각함수와 지수함수의 근사 정확도를 분석함. sin(x)의 3차 근사에서 오차가 x=0.5 rad일 때 0.0026임을 계산하고, 항수 증가에 따른 수렴 속도를 수치적으로 비교함. 급수 수렴의 반지름 개념을 복소평면으로 확장하여 오일러 공식과 연결함. 교사는 '해석학적 사고의 전개가 대학 수준에 근접한다'고 평가함. 처음에는 수렴반경의 기하학적 의미를 파악하지 못하여 어려움을 겪었으나 복소수 표현을 학습하며 돌파구를 찾음. 엄밀한 수학적 사고와 직관이 병행될 때 깊은 이해가 가능함을 깨달음.",
    expected: {
      minScore: 67,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-prob-stat",
    description: "확률과 통계 — 베이즈 정리 탐구, 조건부확률 실생활 모델링",
    recordType: "setek",
    subjectName: "확률과 통계",
    grade: 2,
    content:
      "의료 검진에서 위양성률이 진단 정확도에 미치는 영향을 분석함. 민감도 95%, 특이도 90%인 검사와 질병 유병률 1%를 조합하여 실제 양성 예측도를 베이즈 정리로 계산한 결과 8.7%임을 도출함. 이를 500명 가상 환자 시뮬레이션으로 검증하고, 유병률 변화에 따른 예측도 그래프를 작성함. 교사는 통계적 사고를 실용 문제에 정교하게 적용했다고 평가함. 초기에는 직관과 계산 결과의 괴리에 혼란을 겪었으나 시뮬레이션을 통해 확인하며 이해를 굳힘. 통계적 판단의 맥락 의존성을 인식하게 됨.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-geo",
    description: "기하 — 공간도형 증명, 외접구 반지름 유도, 교사 평가",
    recordType: "setek",
    subjectName: "기하",
    grade: 3,
    content:
      "정사면체 외접구의 반지름을 두 가지 방법으로 유도함. 첫째, 무게중심과 꼭짓점 거리 관계를 이용하고 둘째, 좌표계를 설정하여 내접구와 외접구 반지름의 비가 1:3임을 증명함. 사면체의 내접구 공식을 일반 삼각뿔로 확장하는 조건을 탐구하였음. 교사는 '하나의 문제를 다양한 방법으로 접근하는 수학적 유연성이 탁월하다'고 평가함. 처음에는 두 풀이의 일치 여부에 확신을 갖지 못했으나 수치 검증으로 증명의 정확성을 확인함. 동치인 두 증명이 각기 다른 기하학적 직관을 제공함을 깨달음.",
    expected: {
      minScore: 67,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-earth",
    description: "지구과학I — 판구조론 탐구, 지진파 데이터 분석",
    recordType: "setek",
    subjectName: "지구과학I",
    grade: 1,
    content:
      "2011년 동일본 대지진 지진파 데이터를 분석하여 P파와 S파의 도달 시간 차이로 진원 거리를 계산하는 3소법을 직접 적용함. 여러 관측소 데이터를 조합하여 진원지를 지도에 표시하고 실제 위치와 오차 15km 이내로 일치함을 확인함. 하와이 열점 화산 활동과 태평양판 이동 속도를 가중치 회귀분석으로 추정함. 교사는 실제 데이터를 활용한 과학적 탐구가 인상적이라고 평가함. 초기에는 데이터 잡음으로 오차가 컸으나 이상값 제거 기법을 적용하여 정확도를 높임. 지구물리학이 수리적 분석과 긴밀히 연결되어 있음을 실감함.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-socio",
    description: "사회·문화 — 계층이동 연구방법론 비교, 교사 평가",
    recordType: "setek",
    subjectName: "사회·문화",
    grade: 2,
    content:
      "사회 이동의 측정 방법론을 비교하는 탐구를 수행함. 세대 내 이동과 세대 간 이동의 측정에서 종단연구와 횡단연구의 장단점을 검토하고, 한국노동패널조사(KLIPS) 방법론을 분석하여 표집 편향 가능성을 지적함. 절대적 이동과 상대적 이동의 개념 차이를 이동표(mobility table)를 통해 설명하고 소득 5분위 전환 행렬을 작성함. 교사는 사회과학 방법론에 대한 비판적 이해가 돋보인다고 평가함. 처음에는 이동표의 해석 방향이 헷갈렸으나 행과 열을 각각 출발 계층과 도착 계층으로 명확히 정의하며 해결함. 측정 방식에 따라 계층이동의 '진실'이 달라질 수 있음을 인식하게 됨.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-politics",
    description: "정치와 법 — 위헌심사기준 탐구, 비례원칙 사례 분석",
    recordType: "setek",
    subjectName: "정치와 법",
    grade: 3,
    content:
      "기본권 제한의 합헌성을 심사하는 비례원칙(과잉금지원칙)의 4단계 구조를 탐구함. 목적의 정당성·수단의 적합성·침해의 최소성·법익의 균형성 기준을 헌법재판소 결정례 3건에 적용하여 위헌 여부를 스스로 분석함. 특히 야간 옥외집회 금지 사건에서 침해의 최소성 판단이 어떻게 이루어졌는지를 소수 의견과 비교하며 검토함. 교사는 법적 추론의 엄밀성과 논거 구조가 탁월하다고 평가함. 처음에는 소수 의견의 논거가 다수 의견보다 설득력이 있는지 판단하기 어려웠으나 학술 논문을 읽으며 쟁점을 분리하는 방법을 익힘. 민주주의에서 기본권과 공익의 긴장이 사법 판단을 통해 매개됨을 실감함.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-econ",
    description: "경제 — 소비자 잉여·생산자 잉여, 조세 귀착 분석",
    recordType: "setek",
    subjectName: "경제",
    grade: 2,
    content:
      "담배 소비세 인상이 소비자와 생산자에게 어떻게 귀착되는지를 수요·공급 탄력성 모형으로 분석함. 담배 수요의 가격탄력성이 -0.4임을 문헌에서 확인하고, 1,000원 증세 시 소비자 귀착 비율이 약 73%임을 계산함. 소비자 잉여와 생산자 잉여의 감소분, 사중손실 넓이를 그래프로 도식화하여 발표함. 교사는 경제모형을 실제 정책에 적용한 분석이 논리적이라고 평가함. 처음에는 탄력성 계산에서 부호 처리를 잘못하여 오류가 발생했으나 수식을 다시 정리하며 수정함. 조세 정책이 효율성과 형평성 사이의 선택임을 경제학적으로 이해하게 됨.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  // ─── 카테고리 B: P1 나열식 ────────────────────────────────────────────────

  {
    id: "setek-p1-bio",
    description: "생명과학 나열식 — 단원명만 열거, 연결성 없음",
    recordType: "setek",
    subjectName: "생명과학I",
    grade: 1,
    content:
      "세포 분열에 대해 배웠다. 체세포 분열은 간기·전기·중기·후기·말기로 이루어진다. 감수 분열도 배웠다. 감수 1분열과 감수 2분열로 나뉜다. DNA 복제를 배웠다. 전사와 번역 과정을 배웠다. 리보솜에서 단백질이 합성된다. 다양한 실험을 하였다. 교사가 성실하다고 칭찬하였다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-p1-chem",
    description: "화학I 나열식 — 개념 열거, 탐구 흐름 없음",
    recordType: "setek",
    subjectName: "화학I",
    grade: 1,
    content:
      "원소 주기율표를 공부했다. 원소의 전자배치를 배웠다. 이온화 에너지를 배웠다. 전기음성도를 배웠다. 공유결합, 이온결합, 금속결합을 배웠다. 분자의 구조를 배웠다. 루이스 전자점식을 배웠다. 문제를 열심히 풀었다. 수업에 성실히 참여하였다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-p1-social",
    description: "사회 나열식 — 키워드만, 과정 서술 없음",
    recordType: "setek",
    subjectName: "사회·문화",
    grade: 2,
    content:
      "문화의 속성, 문화 변동, 문화 상대주의, 자문화 중심주의, 문화 사대주의를 배웠다. 사회화, 사회 집단, 일탈 행동 이론도 공부했다. 사회 계층, 사회 이동, 사회 불평등을 배웠다. 각 단원의 개념을 이해하고 문제를 풀었다. 발표도 하였다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-p1-music",
    description: "음악 나열식 — 장르·악기 열거, 감상 경험 서술 없음",
    recordType: "setek",
    subjectName: "음악",
    grade: 1,
    content:
      "클래식 음악을 감상하였다. 바로크, 고전, 낭만 시대를 배웠다. 바흐, 모차르트, 베토벤, 슈베르트를 배웠다. 국악도 배웠다. 판소리, 민요, 가야금, 거문고를 배웠다. 리코더 연주를 하였다. 노래도 불렀다. 음악 감상문을 작성하였다.",
    expected: {
      maxScore: 52,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-p1-prob-stat",
    description: "확률과 통계 나열식 — 공식 열거, 탐구 없음",
    recordType: "setek",
    subjectName: "확률과 통계",
    grade: 2,
    content:
      "순열과 조합을 배웠다. 이항분포를 공부했다. 정규분포 공식을 외웠다. 표준화 z점수를 배웠다. 모평균 추정 공식을 배웠다. 신뢰구간을 배웠다. 문제를 많이 풀었다. 수업에 집중하였다.",
    expected: {
      maxScore: 52,
      mustHaveIssues: ["P1"],
    },
  },

  // ─── 카테고리 C: F2 인과단절 ──────────────────────────────────────────────

  {
    id: "setek-f2-physics",
    description: "물리학 → 블랙홀 → 환경문제: 논리 비약 3단 도약",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 2,
    content:
      "뉴턴의 운동법칙을 공부하다가 블랙홀에 관심이 생겨 호킹 복사를 조사하였다. 양자역학과 일반 상대성이론의 통합 문제를 알게 되었다. 이를 통해 환경오염 문제의 심각성을 깨달았고, 탄소중립 실현을 위해 헌신하고 싶다는 생각을 하게 되었다. 앞으로 환경 정책을 연구하는 사회학자가 되고 싶다.",
    expected: {
      maxScore: 65,
      mustHaveIssues: ["F2"],
    },
  },

  {
    id: "setek-f2-math",
    description: "수학 미적분 → AI → 사회 불평등: 비약적 결론",
    recordType: "setek",
    subjectName: "수학II",
    grade: 2,
    content:
      "미적분을 공부하다가 AI 알고리즘에 관심을 갖게 되었다. AI 기술이 발전하면 일자리를 빼앗아 사회 불평등이 심화될 것이라고 생각했다. 따라서 기본소득제 도입이 반드시 필요하다고 결론 내렸다. 앞으로 복지정책을 연구하는 사회학자가 되고 싶다.",
    expected: {
      maxScore: 65,
      mustHaveIssues: ["F2"],
    },
  },

  {
    id: "setek-f2-geo",
    description: "기하 → 건축 → 환경 도시계획: 중간 연결고리 없음",
    recordType: "setek",
    subjectName: "기하",
    grade: 3,
    content:
      "공간벡터를 공부하다가 건축 설계에 수학이 쓰인다는 것을 알게 되었다. 가우디의 사그라다 파밀리아 성당이 수학적으로 아름답다고 생각했다. 이를 통해 지구 온난화로 인한 도시 홍수 문제에 관심이 생겼고, 지속가능한 도시 인프라를 연구하는 환경공학자가 되기로 결심하였다.",
    expected: {
      maxScore: 65,
      mustHaveIssues: ["F2"],
    },
  },

  // ─── 카테고리 D: F10 성장부재 ────────────────────────────────────────────

  {
    id: "setek-f10-physics",
    description: "전자기 학습 — 활동 나열, 성장·깨달음 서사 없음",
    recordType: "setek",
    subjectName: "물리학II",
    grade: 3,
    content:
      "전기와 자기 단원에서 쿨롱 법칙, 가우스 법칙, 앙페르 법칙을 학습하였다. 맥스웰 방정식의 의미를 파악하고 정리하여 발표하였다. 전자기 유도와 패러데이 법칙을 이해하고 문제를 풀었다. 교사가 이해력이 좋다고 평가하였다. 다음 단원도 열심히 공부할 계획이다.",
    expected: {
      maxScore: 62,
      mustHaveIssues: ["F10"],
    },
  },

  {
    id: "setek-f10-chem",
    description: "유기화합물 — 개념 정리, 변화·극복 서사 없음",
    recordType: "setek",
    subjectName: "화학II",
    grade: 3,
    content:
      "유기화합물 단원에서 알케인, 알켄, 알카인의 구조와 성질을 공부하였다. 작용기별 반응 특성을 표로 정리하였다. 고분자 화합물의 합성 과정을 이해하였다. 수업 중 제시된 문제를 모두 해결하였다. 화학에 대한 관심이 높아졌다.",
    expected: {
      maxScore: 62,
      mustHaveIssues: ["F10"],
    },
  },

  {
    id: "setek-f10-earth",
    description: "지구과학 대기순환 — 개념 서술, 변화 서사 없음",
    recordType: "setek",
    subjectName: "지구과학II",
    grade: 3,
    content:
      "대기 대순환의 해들리, 페렐, 극 세포 구조를 학습하였다. 코리올리 힘에 의한 무역풍과 편서풍의 형성 원리를 이해하였다. 해양 표층 순환과 열염 순환의 관계를 도식화하였다. 교사가 개념 이해가 정확하다고 하였다. 다음 단원도 열심히 공부하겠다.",
    expected: {
      maxScore: 60,
      mustHaveIssues: ["F10"],
    },
  },

  // ─── 카테고리 E: F16 진로과잉도배 ───────────────────────────────────────

  {
    id: "setek-f16-pe",
    description: "체육 — 모든 활동에 의학 진로 억지 연결",
    recordType: "setek",
    subjectName: "체육",
    grade: 2,
    content:
      "체육 수업에서 달리기 훈련을 하며 심폐기능 향상을 위한 유산소 운동의 의학적 효과를 탐구하였다. 의사가 되기 위해 심박수와 심장질환의 상관관계를 조사하였다. 배드민턴 경기에서 부상 예방을 위한 의학적 원리를 적용하여 의사의 관점으로 운동을 분석하였다. 근육 회복 메커니즘을 의학 교재로 조사하며 의과대학 진학 준비를 하였다. 모든 체육 활동을 의사가 되기 위한 과정으로 연결하여 진로를 구체화하였다.",
    expected: {
      mustHaveIssues: ["F16"],
    },
  },

  {
    id: "setek-f16-art",
    description: "미술 — 모든 작품에 인테리어 디자이너 진로 도배",
    recordType: "setek",
    subjectName: "미술",
    grade: 1,
    content:
      "미술 시간에 정물화를 그리며 인테리어 디자이너로서 공간 색채의 중요성을 탐구하였다. 인테리어 디자이너의 눈으로 원근법을 분석하였다. 콜라주 작업을 통해 미래의 인테리어 포트폴리오 제작 역량을 키웠다. 조소 활동에서 3D 입체 구조를 인테리어 디자인 관점에서 분석하였다. 미술관 견학에서 작품을 인테리어 디자이너 시각으로 감상하며 진로를 구체화하였다.",
    expected: {
      mustHaveIssues: ["F16"],
    },
  },

  // ─── 카테고리 F: M1 교사관찰불가 ────────────────────────────────────────

  {
    id: "setek-m1-math",
    description: "수학 — 교사 관찰·평가 문장 완전 부재, 학생 자술",
    recordType: "setek",
    subjectName: "수학I",
    grade: 1,
    content:
      "함수의 극값과 변곡점을 직접 계산하는 연습을 많이 했다. 복잡한 합성함수의 미분도 할 수 있게 되었다. 정적분의 기하학적 의미를 이해하고 넓이 계산에 적용할 수 있다. 로피탈 정리를 적용하는 방법을 익혔다. 앞으로도 꾸준히 공부할 것이다.",
    expected: {
      mustHaveIssues: ["M1"],
    },
  },

  {
    id: "setek-m1-econ",
    description: "경제 — 학생 서술 중심, 교사 관찰 서사 전무",
    recordType: "setek",
    subjectName: "경제",
    grade: 2,
    content:
      "시장 실패의 원인을 공부하였다. 외부효과, 공공재, 정보 비대칭, 독과점의 개념을 이해하였다. 탄소세가 부정적 외부효과를 내부화하는 원리를 학습하였다. 코즈 정리도 이해하였다. 이를 통해 정부의 시장 개입이 필요한 경우를 정리하였다.",
    expected: {
      mustHaveIssues: ["M1"],
    },
  },

  // ─── 카테고리 G: P3 키워드만 ────────────────────────────────────────────

  {
    id: "setek-p3-bio",
    description: "생명과학 — 개념어만 나열, 탐구 과정 부재",
    recordType: "setek",
    subjectName: "생명과학II",
    grade: 2,
    content:
      "효소, 기질 특이성, 활성화에너지, 보조인자, 억제제, pH 최적점, 온도 최적점, 알로스테릭 조절, 피드백 저해, 비경쟁적 저해, 경쟁적 저해에 대해 학습하였다. 효소 반응 속도론(Michaelis-Menten)을 이해하였다. Km값의 의미를 파악하였다. 이를 통해 효소학을 이해하게 되었다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P3"],
    },
  },

  {
    id: "setek-p3-physics",
    description: "물리학 — 핵심 용어만 나열, 실험·탐구 과정 서술 없음",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 1,
    content:
      "파동, 횡파, 종파, 진폭, 파장, 진동수, 속도, 굴절, 반사, 간섭, 회절, 도플러 효과, 공명, 정상파, 음파, 초음파, 초음파 진단, 소나. 이러한 개념들을 학습하여 파동에 대한 이해를 갖추었다.",
    expected: {
      maxScore: 50,
      mustHaveIssues: ["P3"],
    },
  },

  // ─── 카테고리 H: F12 자기주도성부재 ─────────────────────────────────────

  {
    id: "setek-f12-chem",
    description: "화학 — 수동적 수용, 학생 주도 활동 없음",
    recordType: "setek",
    subjectName: "화학I",
    grade: 1,
    content:
      "교사가 산-염기 반응의 원리를 설명해 주었다. 브뢴스테드-로우리 산-염기 이론을 강의를 통해 이해하였다. 교사가 중화 반응 실험을 보여주었으며 지시약의 색 변화를 관찰하였다. 교사의 설명에 따라 문제를 풀었다. 수업 내용을 노트에 정리하였다. 이해하지 못한 부분은 교사에게 질문하였다.",
    expected: {
      mustHaveIssues: ["F12"],
    },
  },

  {
    id: "setek-f12-socio",
    description: "사회 — 교사·교과서 의존적, 자기주도 학습 부재",
    recordType: "setek",
    subjectName: "사회·문화",
    grade: 2,
    content:
      "교사가 사회 불평등의 원인을 설명해 주었다. 기능론과 갈등론의 차이를 강의 내용을 통해 이해하였다. 교과서에 제시된 계층 구조 도표를 보고 이해하였다. 교사가 제시한 읽기 자료를 읽고 요약하였다. 수업 시간에 제시된 토론 주제로 조별 토론에 참여하였다.",
    expected: {
      mustHaveIssues: ["F12"],
    },
  },

  // ─── 카테고리 I: P4 내신탐구불일치 ─────────────────────────────────────

  {
    id: "setek-p4-bio",
    description: "생명과학 내신 1등급 주장 vs 탐구 내용 단순",
    recordType: "setek",
    subjectName: "생명과학I",
    grade: 2,
    content:
      "생명과학에서 전교 1등을 하였으며 모든 단원에서 높은 성취를 보였다. 유전, 진화, 생태계를 배웠다. 세포 분열 관련 문제를 잘 풀었다. 시험에서 100점을 받았다. 교사가 생명과학에 재능이 있다고 칭찬하였다. 앞으로 의대에 진학할 계획이다.",
    expected: {
      mustHaveIssues: ["P4"],
    },
  },

  // ─── 카테고리 G-창: 창체 ──────────────────────────────────────────────────

  {
    id: "changche-high-club",
    description: "수학탐구 동아리 — 몬테카를로, 주도적 역할, 발견",
    recordType: "changche",
    grade: 2,
    content:
      "수학 탐구 동아리에서 뷔퐁의 바늘 실험을 프로그래밍으로 구현하여 몬테카를로 시뮬레이션의 원리를 탐구함. 반복 횟수 증가에 따른 π 근사값의 수렴 속도를 분석하고 중심극한정리와의 연관성을 발견함. 1만 회 시뮬레이션에서 오차율 0.02%를 달성하여 부원들에게 발표함. 교사는 확률론적 사고의 깊이가 놀랍다고 평가함. 처음에는 수렴 속도가 느려 실망했으나 난수 생성 알고리즘을 개선하여 극복함. 확률론이 현실 세계 모델링의 핵심임을 깨달음.",
    expected: {
      minScore: 63,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "changche-high-science-club",
    description: "과학탐구 동아리 — 독립 실험 설계, 결과 발표, 교사 평가",
    recordType: "changche",
    grade: 1,
    content:
      "생명과학 탐구 동아리에서 항생제 내성 메커니즘을 탐구하는 독립 실험을 설계함. 대장균 배양 실험에서 암피실린 농도를 4단계로 달리하여 최소억제농도(MIC)를 측정하고 결과를 교내 학술지에 투고함. 실험 중 오염 문제가 발생하자 멸균 프로토콜을 강화하여 재실험함. 교사는 '고등학생 수준을 넘는 실험 설계 역량'이라고 평가함. 이 경험을 통해 과학 연구에서 재현성 확보가 결론만큼 중요함을 깨달음.",
    expected: {
      minScore: 63,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "changche-high-career",
    description: "진로 창체 — 직접 탐방, 직업인 인터뷰, 구체적 성찰",
    recordType: "changche",
    grade: 2,
    content:
      "진로 활동으로 국립과학수사연구원 견학을 직접 신청하여 법의학 전문가 인터뷰를 진행함. 사망 시각 추정에 사용되는 시체온도 감소 방정식(뉴턴 냉각 법칙 응용)을 배우고 이를 수학 시간에 배운 지수함수와 연결함. 견학 후 법의학 교재를 구입하여 독학을 시작함. 교사는 진로 탐색의 주도성과 깊이가 돋보인다고 평가함. 막연히 의사가 되고 싶었으나 법의학이라는 구체적 세부 진로를 탐색하게 됨.",
    expected: {
      minScore: 62,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "changche-p1-career",
    description: "진로 창체 나열식 — 활동명만 나열, 성과 없음",
    recordType: "changche",
    grade: 1,
    content:
      "진로 동아리 활동에 참여하였다. 직업 탐색 활동을 하였다. 봉사 활동을 다녀왔다. 진로 체험 학습에 참가하였다. 자기 이해 검사를 실시하였다. 다양한 활동을 통해 진로에 대해 알게 되었다.",
    expected: {
      maxScore: 52,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "changche-p1-volunteer",
    description: "봉사 창체 나열식 — 봉사 시간만 나열, 성찰 부재",
    recordType: "changche",
    grade: 2,
    content:
      "노인 요양원에서 봉사 활동을 하였다. 환경 정화 봉사에 참여하였다. 헌혈을 하였다. 유기견 보호소 봉사를 하였다. 총 40시간의 봉사 활동을 이수하였다. 봉사 활동을 통해 보람을 느꼈다.",
    expected: {
      maxScore: 50,
      mustHaveIssues: ["P1"],
    },
  },

  // ─── 카테고리 H-행: 행특 ──────────────────────────────────────────────────

  {
    id: "haengteuk-high",
    description: "행특 고품질 — 5단계(태도·학습·관계·리더십·전망) 완비",
    recordType: "haengteuk",
    grade: 3,
    content:
      "학습에 대한 자발적 의지가 강하며 어려운 개념도 포기하지 않고 끝까지 이해하려는 태도가 돋보임. 수학 시간에 동급생이 이해하지 못한 부분을 스스로 정리하여 친구들에게 설명하는 등 협력적 학습자의 면모를 보임. 학생회 부회장으로서 축제 준비 과정에서 갈등 상황을 중재하고 팀원들의 의견을 조율하는 리더십을 발휘함. 실패한 기획에서도 원인을 분석하고 개선안을 제시하는 성숙한 태도를 보임. 3년간 꾸준한 성장세를 보이며 명확한 진로 계획을 갖추고 있어 앞으로의 발전이 기대됨.",
    expected: {
      minScore: 60,
      mustNotHaveIssues: ["P1"],
    },
  },

  {
    id: "haengteuk-high-2",
    description: "행특 고품질 — 구체적 사례·갈등해결·성장 3년 서사",
    recordType: "haengteuk",
    grade: 2,
    content:
      "자기 주도적 학습 습관이 확립되어 있으며 과목별로 학습 전략을 달리 적용하는 메타인지 능력이 뛰어남. 화학 수업에서 이해되지 않는 부분을 그냥 넘기지 않고 교사에게 질문하거나 참고서적을 찾아 해결하는 태도를 보임. 학급 내 학습 멘토링을 자발적으로 조직하여 취약 과목 친구들을 지원하는 리더십을 발휘함. 2학기에 접어들며 성적이 하락하자 주간 학습 계획을 새로 설계하여 극복함. 타인의 어려움에 공감하는 따뜻한 인성을 갖추어 학급의 신뢰를 얻고 있으며, 향후 지속적인 성장이 기대됨.",
    expected: {
      minScore: 60,
      mustNotHaveIssues: ["P1"],
    },
  },

  {
    id: "haengteuk-low",
    description: "행특 단순 — 형식적 칭찬, 구체성 없음",
    recordType: "haengteuk",
    grade: 1,
    content:
      "수업에 성실히 참여하고 과제를 잘 수행함. 친구들과 사이가 좋고 학교생활에 잘 적응함. 예의 바르고 성실한 학생임. 앞으로도 발전할 것으로 기대됨.",
    expected: {
      maxScore: 58,
    },
  },

  {
    id: "haengteuk-low-2",
    description: "행특 저품질 — 활동 나열, 인성 서사 없음",
    recordType: "haengteuk",
    grade: 2,
    content:
      "학교 행사에 참여하였다. 체험학습에 참가하였다. 봉사 활동을 이수하였다. 수업 태도가 바르다. 발전 가능성이 있다.",
    expected: {
      maxScore: 55,
    },
  },

  // ─── 카테고리 Z: 경계값/복합 ──────────────────────────────────────────────

  {
    id: "setek-borderline",
    description: "생명과학 기본 탐구 — 완성도 중간, 구체성 부족",
    recordType: "setek",
    subjectName: "생명과학II",
    grade: 3,
    content:
      "줄기세포의 종류와 특성을 조사하여 발표하였다. 전능성, 만능성, 다능성 줄기세포의 차이를 이해함. 유도만능줄기세포(iPSC) 기술의 의학적 활용 가능성을 검토하였다. 교사는 자료 조사가 충실하다고 평가함. 더 깊이 탐구하고 싶다는 생각을 가지게 됨.",
    expected: {
      minScore: 42,
      maxScore: 72,
    },
  },

  {
    id: "setek-p1-f10-combo",
    description: "물리 나열식 + 성장부재 복합 — 두 패턴 동시 감지",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 1,
    content:
      "힘과 운동을 배웠다. 뉴턴의 운동 3법칙을 배웠다. 등가속도 운동을 배웠다. 포물선 운동을 배웠다. 원운동을 배웠다. 각 단원의 공식을 외우고 문제를 풀었다. 교사가 문제 풀이 능력이 좋다고 평가하였다.",
    expected: {
      maxScore: 50,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-borderline-econ",
    description: "경제 중간 품질 — 구조는 있으나 데이터·출처 부족",
    recordType: "setek",
    subjectName: "경제",
    grade: 2,
    content:
      "최저임금 인상이 고용에 미치는 영향을 탐구함. 단기에는 노동 수요 감소가 발생할 수 있음을 학습함. 실제 우리나라 최저임금 인상 데이터를 찾아보았으나 고용 감소 여부는 연구자마다 다른 결론이 나옴을 확인함. 교사는 경제 현상의 복잡성을 파악하는 안목이 생겼다고 평가함. 향후 더 엄밀한 분석이 필요함을 느꼈다.",
    expected: {
      minScore: 40,
      maxScore: 70,
    },
  },

  // ─── 추가 샘플: 수학/과학/사회/예체능 보완 ──────────────────────────────────

  {
    id: "setek-high-math2",
    description: "수학II — 극한·연속 탐구, 참고문헌 명시, 교사 관찰",
    recordType: "setek",
    subjectName: "수학II",
    grade: 1,
    content:
      "함수의 연속성과 불연속점의 유형을 분류하는 탐구를 수행함. 제거 가능 불연속, 도약 불연속, 무한 불연속의 세 유형을 정의하고 각각을 그래프로 시각화함. 디리클레 함수가 어떤 점에서도 연속이 아님을 ε-δ 정의로 증명하고, 중간값 정리의 성립 조건을 탐구함. 토마스 미적분학(12판) 2.4절을 참고하여 증명 과정을 보완함. 교사는 '불연속의 유형 분류가 매우 정확하고 증명 서술이 논리적'이라고 평가함. 처음에는 ε-δ 증명 기법이 낯설어 어려움을 겪었으나 예시를 반복 적용하며 익힘. 정의의 엄밀함이 직관적 이해와 분리되지 않음을 깨달음.",
    expected: {
      minScore: 67,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-music",
    description: "음악 — 조성 분석, 화성 진행 탐구, 구체적 성찰",
    recordType: "setek",
    subjectName: "음악",
    grade: 2,
    content:
      "베토벤 피아노 소나타 14번 '월광'의 1악장을 분석하여 3연음부 반주 패턴이 감정 표현에 미치는 영향을 탐구함. 도달하지 않는 코드(deceptive cadence) 기법이 악장 전체에 걸쳐 불안감을 조성함을 화성 기호로 분석함. 모차르트 K331 소나타와 비교하여 고전-낭만 전환기의 화성 어법 변화를 서술함. 음악 이론 교재(Aldwell & Schachter, Harmony and Voice Leading)를 참고함. 교사는 화성 분석이 이론과 감상을 연결한 수준이 높다고 평가함. 처음에는 화성 기호 표기가 헷갈렸으나 반복 분석으로 정확도를 높임. 이론적 분석이 음악을 더 깊이 감상하게 함을 실감함.",
    expected: {
      minScore: 63,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-p1-geo",
    description: "기하 나열식 — 개념·공식 열거, 탐구 흐름 없음",
    recordType: "setek",
    subjectName: "기하",
    grade: 3,
    content:
      "이차곡선을 배웠다. 포물선, 타원, 쌍곡선의 정의와 방정식을 배웠다. 초점, 준선, 이심률의 개념을 배웠다. 공간도형을 배웠다. 직선과 평면의 위치 관계를 배웠다. 공간벡터를 배웠다. 내적과 외적 공식을 배웠다. 문제를 열심히 풀었다.",
    expected: {
      maxScore: 52,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-f2-bio",
    description: "생명과학 유전 → 철학 → 종교 윤리: 비약 논리",
    recordType: "setek",
    subjectName: "생명과학I",
    grade: 2,
    content:
      "멘델 유전 법칙을 공부하다가 유전과 환경의 관계에 궁금증이 생겼다. 유전자 결정론의 한계를 생각하게 되었다. 이를 통해 인간에게 자유의지가 있는지에 대한 철학적 의문이 생겼고, 종교적 인간관이 유전학과 양립할 수 있는지 궁금해졌다. 결국 종교 철학자가 되기로 결심하였다.",
    expected: {
      maxScore: 65,
      mustHaveIssues: ["F2"],
    },
  },

  {
    id: "setek-f10-socio",
    description: "사회·문화 개념 학습 — 내용 정리, 변화 서사 전무",
    recordType: "setek",
    subjectName: "사회·문화",
    grade: 1,
    content:
      "문화의 속성 다섯 가지(학습성, 공유성, 축적성, 변동성, 전체성)를 이해하고 정리하였다. 문화 변동의 원인인 발명, 발견, 전파를 구분하였다. 문화 접변의 유형과 결과를 정리하였다. 교사가 개념 파악이 정확하다고 평가하였다. 앞으로도 사회 개념 학습에 충실히 임하겠다.",
    expected: {
      maxScore: 60,
      mustHaveIssues: ["F10"],
    },
  },

  {
    id: "changche-high-self-study",
    description: "자율 창체 — 독서·자기설계·성찰 서사 완비",
    recordType: "changche",
    grade: 3,
    content:
      "자율 활동 시간을 활용하여 행동경제학 입문서(리처드 탈러, 넛지)를 읽고 행동 편향 14가지를 분류하여 학급 발표를 진행함. 매몰비용 오류를 자신의 학습 계획에 적용하여 비효율적인 과목 배분을 개선한 구체적 사례를 서술함. 교사는 독서 내용을 자기 행동 변화와 연결한 성찰 깊이가 탁월하다고 평가함. 처음에는 인지 편향 개념이 추상적이었으나 실생활 예시를 수집하며 구체화함. 합리적 인간 모델의 한계를 인식하고 의사결정 과학에 대한 진로 관심이 깊어짐.",
    expected: {
      minScore: 60,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },
];
