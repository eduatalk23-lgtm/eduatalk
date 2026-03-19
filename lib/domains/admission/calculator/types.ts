// ============================================
// 정시 환산 엔진 타입
// Phase 8.2
// ============================================

/** 수능 원점수/표준점수 입력 */
export interface SuneungScores {
  /** 국어 표준점수 */
  korean: number | null;
  /** 국어 원점수 (ConversionTable lookup 키) */
  koreanRaw: number | null;
  /** 수학(미적분) 표준점수 */
  mathCalculus: number | null;
  /** 수학(미적분) 원점수 */
  mathCalculusRaw: number | null;
  /** 수학(기하) 표준점수 */
  mathGeometry: number | null;
  /** 수학(기하) 원점수 */
  mathGeometryRaw: number | null;
  /** 수학(확률과통계) 표준점수 */
  mathStatistics: number | null;
  /** 수학(확률과통계) 원점수 */
  mathStatisticsRaw: number | null;
  /** 영어 등급 (1-9) — ConversionTable도 등급으로 lookup */
  english: number | null;
  /** 한국사 등급 (1-9) */
  history: number | null;
  /** 탐구 과목별 원점수 { "사회·문화": 63, "생활과 윤리": 62 } — ConversionTable lookup 키 */
  inquiry: Record<string, number>;
  /** 제2외국어/한문 등급 (1-9) */
  foreignLang: number | null;
}

/** 대학별 환산 설정 (DB → 변환) */
export interface UniversityScoreConfig {
  universityName: string;
  mandatoryPattern: string | null;
  optionalPattern: string | null;
  weightedPattern: string | null;
  inquiryCount: number;
  mathSelection: "ga" | "na" | "gana";
  inquirySelection: "sagwa" | "gwa" | "sa";
  historySubstitute: "to_inquiry" | "to_english" | null;
  foreignSubstitute: "to_inquiry" | null;
  bonusRules: Record<string, unknown>;
  conversionType: string;
  /** 환산 경로: 'subject' (SUBJECT3 lookup) | 'percentage' (PERCENTAGE lookup) */
  scoringPath: "subject" | "percentage";
}

/** PERCENTAGE 변환 테이블: "트랙-퍼센타일" → 환산점수 */
export type PercentageTable = Map<string, number>;

/** 가중택 경로 입력 (등수) */
export interface PercentageInput {
  track: "문과" | "이과";
  percentile: number; // 0.01 ~ 80.00
}

/** 과목 슬롯 (패턴 파싱 결과) */
export type SubjectSlot =
  | { type: "korean" }
  | { type: "math" }
  | { type: "english" }
  | { type: "history" }
  | { type: "foreign" }
  | { type: "inquiry"; count: number };

/** 필수 패턴 파싱 결과 */
export interface ParsedMandatoryPattern {
  subjects: SubjectSlot[];
}

/** 선택 패턴 파싱 결과 */
export interface ParsedOptionalPattern {
  pool: SubjectSlot[];
  pickCount: number;
}

/** 가중택 패턴 파싱 결과 */
export interface ParsedWeightedPattern {
  pool: SubjectSlot[];
  pickCount: number;
}

/** 변환 테이블: "과목-점수" → 환산점수 */
export type ConversionTable = Map<string, number>;

/** 해결된 과목별 환산점수 */
export interface ResolvedScores {
  korean: number;
  math: number;
  english: number;
  history: number;
  inquiry: number;      // top-N 합산
  inquiry1: number;     // 탐구 1순위
  inquiry2: number;     // 탐구 2순위
  foreign: number;
  /** 개별 과목 환산점수 맵 (선택/가중용) */
  subjectScores: Record<string, number>;
}

/** 결격사유 규칙 */
export interface RestrictionRule {
  universityName: string;
  departmentName: string | null;
  restrictionType: "no_show" | "grade_sum" | "subject_req";
  ruleConfig: Record<string, unknown>;
  description: string | null;
}

/** 결격 체크 결과 */
export interface EligibilityResult {
  isEligible: boolean;
  reasons: string[];
}

/** 과목별 점수 상세 */
export interface SubjectBreakdown {
  subject: string;
  rawScore: number;
  convertedScore: number;
}

/** 최종 환산 결과 */
export interface ScoreCalculationResult {
  universityName: string;
  isEligible: boolean;
  disqualificationReasons: string[];
  mandatoryScore: number;
  optionalScore: number;
  weightedScore: number;
  bonusScore: number;
  totalScore: number;
  breakdown: {
    math: SubjectBreakdown | null;
    inquiry: SubjectBreakdown[];
    mandatory: SubjectBreakdown[];
    optional: SubjectBreakdown[];
  };
}
