// ============================================
// StudentState — Layer 0~4 통합 학생 상태 타입 (Phase α1-1, 2026-04-19)
//
// 비전: Autonomous 학종 Coach 의 World Model.
//   - Agent 의 Perception 단계가 이 타입으로 현 상태를 관찰
//   - Reward 엔진이 이 타입으로 학종 적합도 계산
//   - 청사진 GAP 엔진이 이 타입과 blueprint(tier_plan) 거리 측정
//   - Proposal Engine 이 이 타입으로 다음 action 결정
//
// 원칙:
//   - Readonly — snapshot 은 불변. 변경은 새 snapshot 생성으로.
//   - asOf 명시 — ESS (Epistemic State Specification) 시점 경계. 미래 정보 누출 차단.
//   - 기존 enum/타입 100% 재사용 — 중복 정의 금지.
//   - Optional lenient — 신입생 / 분석 전 학년도 허용 (데이터 완결성 0% 가능).
//
// 구현 로드맵 (이 파일은 타입 스펙만):
//   α1-1: 타입 스펙 (이 파일)
//   α1-2~α1-5: 보조영역 분석 파이프라인 → competencyVector 에 채움
//   α1-3: student_state_snapshots 테이블 + builder 함수
//   α1-6: admin UI 카드
//   α2: HakjongScore 실제 계산 엔진
//   α3: BlueprintGap 실제 계산 엔진
// ============================================

import type {
  CompetencyArea,
  CompetencyItemCode,
  CompetencyGrade,
  RecordType,
  ChangcheActivityType,
  StorylineStrength,
} from "./enums";

// ─── 시점 (ESS Epistemic Boundary) ──────────────────────────────────────

/**
 * StudentState 의 시점. 모든 필드는 이 시점 기준 정보만 포함해야 한다.
 * 예: asOf.schoolYear=2026, grade=2, semester=1 이면 2학년 1학기 말까지의 정보만 반영.
 *
 * ESS 원칙: LLM 호출 시 "학생이 이 시점에 알 수 있는 것" 경계를 명시적으로 전달한다.
 * 미래 시점의 활동·진단·성적이 프롬프트에 누출되면 안 됨.
 */
export interface StudentStateAsOf {
  readonly schoolYear: number;     // 학년도 (예: 2026)
  readonly grade: 1 | 2 | 3;       // 학년
  readonly semester: 1 | 2;        // 학기
  readonly label: string;          // 표시용 (예: "2026학년도 2학년 1학기")
  readonly builtAt: string;        // snapshot 생성 timestamp (ISO8601)
}

// ─── Layer 0 — Profile Card (누적 프로필) ────────────────────────────────

/**
 * H2 profile_card 의 snapshot 참조. 빌드 비용이 커서 재사용.
 * 실제 데이터는 student_record_profile_cards 테이블에서 조회.
 */
export interface ProfileCardSnapshot {
  readonly id: string;                        // profile_card row id
  readonly targetGrade: 1 | 2 | 3;
  readonly source: "ai" | "manual";
  readonly renderedText: string;              // renderStudentProfileCard() 결과
  readonly persistentStrengths: readonly string[];
  readonly persistentWeaknesses: readonly string[];
  readonly recurringQualityIssues: readonly string[];
  readonly interestConsistency?: string | null;
  readonly updatedAt: string;
}

// ─── Layer 1 — Competencies (역량 벡터 + 품질) ───────────────────────────

/**
 * 10 역량 × 등급 벡터. 학종 3요소(학업/진로/공동체) 집계의 기초.
 * 등급은 A+/A-/B+/B/B-/C (CompetencyGrade). 숫자 변환은 reward 계산기에서.
 *
 * grade 가 null 이면 "아직 측정 안 됨" (데이터 부족). grade="C" 와 구분해야 함.
 */
export interface CompetencyAxisState {
  readonly code: CompetencyItemCode;
  readonly area: CompetencyArea;
  readonly grade: CompetencyGrade | null;
  readonly source: "ai" | "ai_projected" | "manual";
  readonly narrative: string | null;
  readonly supportingRecordIds: readonly string[];   // 근거가 된 record_id 목록
}

/**
 * 품질 5축 (세특/창체/행특 record 단위 평균).
 * ContentQualityScore 기반. null 은 데이터 부족.
 */
export interface ContentQualityAxisState {
  readonly specificity: number | null;              // 0~100
  readonly coherence: number | null;
  readonly depth: number | null;
  readonly grammar: number | null;
  readonly scientificValidity: number | null;
  readonly overallScore: number | null;
  readonly sampleSize: number;                      // 평균에 포함된 record 수
  readonly source: "ai" | "ai_projected";
}

/**
 * 설계(ai_projected) / 분석(ai) 두 관점을 병기.
 * 학종 Reward 는 분석 우선, 설계는 proposal 가상 평가에 사용.
 */
export interface CompetencyLayerState {
  readonly axes: readonly CompetencyAxisState[];    // 10 items
  readonly analysisQuality: ContentQualityAxisState;    // source='ai'
  readonly projectedQuality: ContentQualityAxisState;   // source='ai_projected'
}

// ─── Layer 2 — Hyperedges (N-ary 수렴 테마) ──────────────────────────────

export interface HyperedgeSnapshot {
  readonly id: string;
  readonly themeSlug: string;
  readonly memberRecordIds: readonly string[];
  readonly sharedCompetencies: readonly string[];
  readonly confidence: number;
  readonly hyperedgeType: string;                    // 'theme_convergence' 등
}

// ─── Layer 3 — Narrative Arc (8단계 서사) ────────────────────────────────

export type NarrativeArcPhase =
  | "curiosity" | "topic_selection" | "inquiry" | "references"
  | "conclusion" | "teacher_observation" | "growth" | "reinquiry";

export interface NarrativeArcSegment {
  readonly recordId: string;
  readonly recordType: RecordType;
  readonly phasesPresent: readonly NarrativeArcPhase[];  // 이 record 가 채운 phase
  readonly flowCompleteness: number;                     // 0~1, 8단계 충족도
}

// ─── Layer 4 — Temporal (시계열 궤적) ────────────────────────────────────

/**
 * 과거 snapshot 참조 배열. 각 포인트는 요약만 보유.
 * 상세는 student_state_snapshots 테이블에서 재조회.
 */
export interface TrajectoryPoint {
  readonly asOf: StudentStateAsOf;
  readonly snapshotId: string;                       // student_state_snapshots.id
  readonly hakjongScore: number | null;              // 당시 학종 Reward (있으면)
  readonly completenessRatio: number;                // 0~1, 당시 데이터 완결성
}

// ─── 보조 영역 (학종 공동체역량 근거) ────────────────────────────────────
//
// α1-2 봉사, α1-4 수상, α1-5 출결 분석 파이프라인이 채운다.
// 이 영역들은 CompetencyAxisState.supportingRecordIds 에도 반영되어야 함.

export interface VolunteerState {
  readonly totalHours: number;
  readonly recurringThemes: readonly string[];        // 분석 기반 주제
  readonly caringEvidence: readonly string[];         // community_caring 근거 요약
  readonly lastActivityAt: string | null;
}

export interface AwardState {
  readonly items: readonly {
    readonly recordId: string;
    readonly name: string;
    readonly level: string;                           // 교내/교외/전국 등
    readonly relatedCompetencies: readonly CompetencyItemCode[];
  }[];
  readonly leadershipEvidence: readonly string[];     // community_leadership 근거
  readonly careerRelevance: readonly string[];        // career_exploration 근거
}

export interface AttendanceState {
  readonly absenceDays: number;
  readonly lateDays: number;
  readonly earlyLeaveDays: number;
  readonly unauthorizedEvents: number;                // 무단 사유
  readonly integrityScore: number | null;             // 규칙 기반 0~100 (α1-5)
  readonly flags: readonly string[];                  // 경고 사항
}

export interface ReadingState {
  readonly totalBooks: number;
  readonly careerAlignedBooks: number;                // 진로 일관성 있는 독서
  readonly linkedRecordIds: readonly string[];        // reading_links 연결된 세특
  readonly lastReadAt: string | null;
}

// ─── 학종 Reward Score (목적 함수) ───────────────────────────────────────

/**
 * 학종 3요소 × 반영 가중치 (대교협 공통).
 * v1 규칙: 각 영역 내 competency grade 평균 → 0~100 변환 → 가중 합.
 * v2 (exemplar 학습): 합격자 분포와 거리 기반 calibration (추후).
 *
 * null 은 "데이터 부족으로 미계산" (Agent 의사결정에서 "알 수 없음" 처리).
 */
export interface HakjongScore {
  readonly academic: number | null;            // 0~100 (학업역량)
  readonly career: number | null;              // 0~100 (진로역량)
  readonly community: number | null;           // 0~100 (공동체역량)
  readonly total: number | null;               // 학업×0.3 + 진로×0.4 + 공동체×0.3
  readonly computedAt: string;
  readonly version: "v1_rule" | "v2_exemplar";
  /**
   * area 별 데이터 완결성 기반 신뢰도.
   * total = min(academic, career, community) — 가장 약한 영역이 전체 신뢰도 제약.
   */
  readonly confidence: {
    readonly academic: number;                 // 0~1
    readonly career: number;
    readonly community: number;
    readonly total: number;
  };
}

// ─── Blueprint Anchor (청사진 참조) ──────────────────────────────────────

/**
 * 현재 활성 main_exploration 의 tier_plan. GAP 엔진이 이것과 실제 state 비교.
 * null 이면 blueprint 미수립 상태 (초기 학생).
 *
 * α3-2 (2026-04-20): competencyGrowthTargets 추가.
 *   최신 blueprint 파이프라인 task_results._blueprintPhase.competencyGrowthTargets 를
 *   좁은 union type 으로 변환 후 첨부. blueprint_generation 미실행·실패 시 빈 배열.
 */
export interface BlueprintAnchor {
  readonly mainExplorationId: string;
  readonly version: number;
  readonly origin: string;                     // 'consultant' | 'auto_bootstrap_v1/v2' 등
  readonly tierPlan: {
    readonly foundational: unknown;            // tier_plan JSONB 그대로
    readonly development: unknown;
    readonly advanced: unknown;
  } | null;
  readonly targetMajor: string | null;
  readonly targetUniversityLevel: string | null;   // 서울대/연고대/인서울상위/중위 등
  readonly updatedAt: string;
  /** α3 GAP 엔진 입력용 역량 목표. blueprint 미실행 시 빈 배열. */
  readonly competencyGrowthTargets: readonly import("./blueprint-gap").CompetencyGradeTarget[];
}

// ─── 메타데이터 ──────────────────────────────────────────────────────────

/**
 * StudentState 자체의 빌드 상태. Agent 가 "이 state 로 판단해도 되는가" 결정.
 */
export interface StudentStateMetadata {
  readonly snapshotId: string | null;          // student_state_snapshots.id (persisted 시)
  readonly completenessRatio: number;          // 0~1, 전체 필드 중 데이터 있는 비율
  readonly layer0Present: boolean;
  readonly layer1Present: boolean;
  readonly layer2Present: boolean;
  readonly layer3Present: boolean;
  readonly auxVolunteerPresent: boolean;
  readonly auxAwardsPresent: boolean;
  readonly auxAttendancePresent: boolean;
  readonly auxReadingPresent: boolean;
  /**
   * area 별 Layer 1 축 채움률(0~1). community 는 aux 기여 30% 가중.
   *   academic = academic_* 3축 non-null / 3
   *   career   = career_* 3축 non-null / 3
   *   community = 0.7 × (community_* 4축 non-null / 4) + 0.3 × (aux 3종 present / 3)
   */
  readonly areaCompleteness: {
    readonly academic: number;                 // 0~1
    readonly career: number;
    readonly community: number;
  };
  /**
   * area 별 Reward 산출 가능 여부.
   *   academic : academic 축 ≥ 2 개 non-null
   *   career   : career 축 ≥ 2 개 non-null
   *   community: community 축 ≥ 2 개 non-null (aux 는 권장이지만 필수 아님)
   *   total    : 위 3 개 모두 true
   */
  readonly hakjongScoreComputable: {
    readonly academic: boolean;
    readonly career: boolean;
    readonly community: boolean;
    readonly total: boolean;
  };
  readonly blueprintPresent: boolean;
  readonly staleness: {
    readonly hasStaleLayer: boolean;
    readonly staleReasons: readonly string[];  // 예: "blueprint older than latest record"
  };
}

// ─── 메인 타입 ───────────────────────────────────────────────────────────

/**
 * 학생의 시점 기반 통합 상태. Autonomous Agent 의 World Model.
 *
 * 빌드 경로: buildStudentState(studentId, tenantId, asOf?) — α1-3 에서 구현.
 * 영속화: student_state_snapshots 테이블 (α1-3).
 *
 * 사용처:
 *   - Perception (α4): state change 감지
 *   - Reward 계산 (α2): hakjongScore 필드 사용
 *   - GAP 계산 (α3): blueprint 와 비교
 *   - Proposal (α4): Agent LLM 프롬프트에 주입
 *   - 면접 모듈 (α5): 꼬꼬무 생성 시 레퍼런스
 *   - Reflection (α6): 이전 snapshot 과 비교
 */
export interface StudentState {
  readonly studentId: string;
  readonly tenantId: string;
  readonly asOf: StudentStateAsOf;

  // Layer 0~4
  readonly profileCard: ProfileCardSnapshot | null;
  readonly competencies: CompetencyLayerState | null;
  readonly hyperedges: readonly HyperedgeSnapshot[];
  readonly narrativeArc: readonly NarrativeArcSegment[];
  readonly trajectory: readonly TrajectoryPoint[];

  // 보조 영역 (학종 공동체역량 근거)
  readonly aux: {
    readonly volunteer: VolunteerState | null;
    readonly awards: AwardState | null;
    readonly attendance: AttendanceState | null;
    readonly reading: ReadingState | null;
  };

  // 학종 목적 함수
  readonly hakjongScore: HakjongScore | null;

  // 학종 청사진 GAP (α3-2, 2026-04-20) — Reward 와 짝. target 없으면 axisGaps=[] + priority='low'.
  readonly blueprintGap: import("./blueprint-gap").BlueprintGap | null;

  // 3 시나리오 브랜치 GAP (α3-3-2, 2026-04-20) — baseline/stable/aggressive 병행.
  // target 빈 경우 null. baseline 은 blueprintGap 과 동일 수치(중복 표현이지만 UI·S7 분리 편의).
  readonly multiScenarioGap: import("./blueprint-gap").MultiScenarioBlueprintGap | null;

  // 청사진 참조
  readonly blueprint: BlueprintAnchor | null;

  // 빌드 메타데이터
  readonly metadata: StudentStateMetadata;
}

// ─── snapshot layer_flags 비트 정의 (α1-3-c) ────────────────────────────
// client-safe (client/server 공용). repository 가 이 상수로 bitmap 생성,
// UI 가 이 상수로 decode. 두 쪽 모두 `types/` 에서 import.

export const SNAPSHOT_LAYER_FLAGS = {
  LAYER0:         1,
  LAYER1:         1 << 1,
  LAYER2:         1 << 2,
  LAYER3:         1 << 3,
  AUX_VOLUNTEER:  1 << 4,
  AUX_AWARDS:     1 << 5,
  AUX_ATTENDANCE: 1 << 6,
  AUX_READING:    1 << 7,
  BLUEPRINT:      1 << 8,
} as const;

// ─── 스토리라인 / 로드맵 요약 (보조 참조) ────────────────────────────────

/**
 * StudentState 본체에는 포함 안 함 (크기 절감).
 * Agent 가 추가 조회 필요 시 별도 repository 호출.
 */
export interface StorylineRef {
  readonly id: string;
  readonly title: string;
  readonly strength: StorylineStrength;
  readonly scope: "final" | "past";
}

// ─── 변화 감지 (α4 Perception 이 사용) ──────────────────────────────────

/**
 * 두 StudentState 의 diff. Perception Trigger 가 상태 변화 감지 시 생성.
 * Agent 는 이 diff 를 읽어 "무엇이 바뀌었는가" 파악 후 proposal 생성.
 */
export interface StudentStateDiff {
  readonly from: StudentStateAsOf;
  readonly to: StudentStateAsOf;
  readonly hakjongScoreDelta: number | null;                 // total 변화
  readonly competencyChanges: readonly {
    readonly code: CompetencyItemCode;
    readonly before: CompetencyGrade | null;
    readonly after: CompetencyGrade | null;
  }[];
  readonly newRecordIds: readonly string[];                  // 새로 추가된 기록
  readonly staleBlueprint: boolean;                          // blueprint 재수립 필요
  readonly auxChanges: {
    readonly volunteerHoursDelta: number;
    readonly awardsAdded: number;
    readonly integrityChanged: boolean;
  };
}

// ─── 타입 재활용 표시 ────────────────────────────────────────────────────

// 아래 타입들은 기존 enums.ts / db-models.ts 에 정의됨. 재정의 금지.
//   - CompetencyItemCode, CompetencyArea, CompetencyGrade (enums)
//   - RecordType, ChangcheActivityType (enums)
//   - ContentQualityScore (db-models 또는 llm/types) — ContentQualityAxisState 는 snapshot 전용 경량 버전
