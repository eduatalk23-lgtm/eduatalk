/**
 * Spot-check: Excel COMPUTE 결과 vs Calculator 엔진 출력 비교
 * Phase 8.2 검증
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { calculateUniversityScore } from "../lib/domains/admission/calculator/calculator";
import type { SuneungScores, UniversityScoreConfig, ConversionTable, RestrictionRule, PercentageTable, PercentageInput } from "../lib/domains/admission/calculator/types";

config({ path: resolve(process.cwd(), ".env.local") });

const EXCEL_PATH = "/Users/johyeon-u/Library/CloudStorage/GoogleDrive-eduatalk23@gmail.com/내 드라이브/ㅎ.생기부레벨업/202511고속성장분석기(실채점)20251224 홍익대등수정.xlsx";

// DB 매핑
const MATH_MAP: Record<string, UniversityScoreConfig["mathSelection"]> = {
  "가": "ga", "나": "na", "가나": "gana",
};
const INQUIRY_MAP: Record<string, UniversityScoreConfig["inquirySelection"]> = {
  "사과": "sagwa", "과": "gwa", "사": "sa",
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Excel에서 입력 점수 + 결과 읽기
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets["COMPUTE"];
  const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1, blankrows: false, raw: true,
  });

  // 학생 수능 점수
  // col 1 = 원점수 (ConversionTable lookup 키), col 2 = 표준점수
  // 영어/한국사: col 1 = 등급 (등급이 곧 lookup 키)
  const scores: SuneungScores = {
    korean: Number(raw[10]?.[2]) || null,            // 표준점수 147
    koreanRaw: Number(raw[10]?.[1]) || null,         // 원점수 128 → lookup 키
    mathCalculus: Number(raw[11]?.[2]) || null,
    mathCalculusRaw: Number(raw[11]?.[1]) || null,
    mathGeometry: Number(raw[12]?.[2]) || null,
    mathGeometryRaw: Number(raw[12]?.[1]) || null,
    mathStatistics: Number(raw[13]?.[2]) || null,    // 표준점수 137
    mathStatisticsRaw: Number(raw[13]?.[1]) || null, // 원점수 120 → lookup 키
    english: Number(raw[17]?.[1]) || null,           // 등급 3 → lookup 키
    history: Number(raw[18]?.[1]) || null,           // 등급 4 → lookup 키
    inquiry: {},                                     // 원점수 → lookup 키
    foreignLang: null,
  };

  // 탐구 과목 (원점수 = col 1 → ConversionTable lookup 키)
  const inquiryRows = [
    [19, "물리학 Ⅰ"], [20, "물리학 Ⅱ"],
    [21, "생명과학 Ⅰ"], [22, "생명과학 Ⅱ"],
    [23, "지구과학 Ⅰ"], [24, "지구과학 Ⅱ"],
    [25, "화학 Ⅰ"], [26, "화학 Ⅱ"],
    [27, "경제"], [28, "동아시아사"],
    [29, "사회·문화"], [30, "생활과 윤리"],
    [31, "세계사"], [32, "세계지리"],
    [33, "윤리와 사상"], [34, "정치와 법"],
    [35, "한국지리"],
  ] as const;

  for (const [rowIdx, name] of inquiryRows) {
    const val = Number(raw[rowIdx]?.[1]); // col 1 = 원점수
    if (val > 0) {
      scores.inquiry[name] = val;
    }
  }

  console.log("=== 학생 수능 점수 ===");
  console.log(`국어: 원=${scores.koreanRaw}/표=${scores.korean}, 수학(확통): 원=${scores.mathStatisticsRaw}/표=${scores.mathStatistics}, 영어: ${scores.english}등급, 한국사: ${scores.history}등급`);
  console.log(`탐구(원점수): ${JSON.stringify(scores.inquiry)}`);
  console.log("");

  // 2. 대학 목록 + Excel 결과
  const univNames = raw[1];
  const excelScores = raw[2]; // Row 2 = 수능점수 환산결과

  // Excel 점수계산 상세 (Row 58=필수, 59=선택, 60=가중택)
  const excelMandatory = raw[58];
  const excelOptional = raw[59];
  const excelWeighted = raw[60];

  // 샘플 대학
  const targets = [
    "연세인문", "연세자연", "고려인문", "고려자연",
    "성균인문", "성균자연", "중앙인문", "중앙자연",
    "한양인문가군", "숙명인문", "숭실인문", "경희인문",
  ];

  console.log("=== Spot-check: Excel vs Calculator ===");
  console.log("대학명".padEnd(20) + "Excel총점".padStart(12) + "Calc총점".padStart(12) + "차이".padStart(10) + "  Excel필수".padStart(12) + "Calc필수".padStart(12) + " 판정");
  console.log("-".repeat(100));

  let matchCount = 0;
  let mismatchCount = 0;

  for (const target of targets) {
    // Excel에서 해당 대학 컬럼 찾기
    let colIdx = -1;
    for (let c = 5; c < univNames.length; c++) {
      if (univNames[c] === target) { colIdx = c; break; }
    }
    if (colIdx === -1) {
      console.log(`${target}: 컬럼 못찾음`);
      continue;
    }

    const excelTotal = Number(excelScores[colIdx]) || 0;
    const excelMand = Number(excelMandatory?.[colIdx]) || 0;
    const excelOpt = Number(excelOptional?.[colIdx]) || 0;
    const excelWgt = Number(excelWeighted?.[colIdx]) || 0;

    // DB에서 config 조회
    const { data: configData } = await supabase
      .from("university_score_configs")
      .select("*")
      .eq("data_year", 2026)
      .eq("university_name", target)
      .single();

    if (!configData) {
      console.log(`${target.padEnd(20)} Excel=${excelTotal.toFixed(2).padStart(10)}  DB config 없음`);
      continue;
    }

    const scoringPath = configData.scoring_path ?? "subject";
    const univConfig: UniversityScoreConfig = {
      universityName: configData.university_name,
      mandatoryPattern: configData.mandatory_pattern,
      optionalPattern: configData.optional_pattern,
      weightedPattern: configData.weighted_pattern,
      inquiryCount: configData.inquiry_count,
      mathSelection: MATH_MAP[configData.math_selection] ?? "gana",
      inquirySelection: INQUIRY_MAP[configData.inquiry_selection] ?? "sagwa",
      historySubstitute: null,
      foreignSubstitute: null,
      bonusRules: configData.bonus_rules ?? {},
      conversionType: configData.conversion_type,
      scoringPath,
    };

    // DB에서 conversion table 조회 (대학당 ~1000행 이상 → 페이지네이션)
    const convData: { subject: string; raw_score: number; converted_score: number }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("university_score_conversions")
        .select("subject, raw_score, converted_score")
        .eq("data_year", 2026)
        .eq("university_name", target)
        .range(from, from + pageSize - 1);
      if (!page || page.length === 0) break;
      convData.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    const conversionTable: ConversionTable = new Map();
    for (const row of convData ?? []) {
      conversionTable.set(`${row.subject}-${row.raw_score}`, Number(row.converted_score));
    }

    // DB에서 restrictions 조회
    const { data: restrData } = await supabase
      .from("university_score_restrictions")
      .select("*")
      .eq("data_year", 2026)
      .eq("university_name", target);

    const restrictions: RestrictionRule[] = (restrData ?? []).map((d) => ({
      universityName: d.university_name,
      departmentName: d.department_name,
      restrictionType: d.restriction_type,
      ruleConfig: d.rule_config ?? {},
      description: d.description,
    }));

    // 가중택 경로: PERCENTAGE 테이블 + 등수 필요
    let percentageInput: PercentageInput | undefined;
    let percentageTable: PercentageTable | undefined;

    if (scoringPath === "percentage") {
      // COMPUTE row 7 = 문과등수(동점포함)
      const rankF = raw[7]?.[colIdx];
      if (rankF && typeof rankF === "number") {
        percentageInput = { track: "문과", percentile: rankF };
      }

      // DB에서 percentage table 조회
      const pctData: { track: string; percentile: number; converted_score: number }[] = [];
      let pFrom = 0;
      while (true) {
        const { data: pPage } = await supabase
          .from("university_percentage_conversions")
          .select("track, percentile, converted_score")
          .eq("data_year", 2026)
          .eq("university_name", target)
          .range(pFrom, pFrom + 999);
        if (!pPage || pPage.length === 0) break;
        pctData.push(...pPage);
        if (pPage.length < 1000) break;
        pFrom += 1000;
      }
      percentageTable = new Map();
      for (const row of pctData) {
        percentageTable.set(`${row.track}-${row.percentile}`, Number(row.converted_score));
      }
    }

    // Calculator 실행
    const result = calculateUniversityScore(scores, univConfig, conversionTable, restrictions, {
      percentageInput,
      percentageTable,
    });

    const diff = Math.abs(excelTotal - result.totalScore);
    const mandDiff = Math.abs(excelMand - result.mandatoryScore);
    const isMatch = diff < 0.01;

    const verdict = isMatch ? "✅ 일치" : diff < 1 ? "⚠️ 근사" : "❌ 불일치";
    if (isMatch || diff < 1) matchCount++;
    else mismatchCount++;

    console.log(
      `${target.padEnd(20)}${excelTotal.toFixed(2).padStart(12)}${result.totalScore.toFixed(2).padStart(12)}${diff.toFixed(4).padStart(10)}  ${excelMand.toFixed(2).padStart(10)}${result.mandatoryScore.toFixed(2).padStart(12)} ${verdict}`
    );

    // 불일치 시 상세 출력
    if (diff >= 1) {
      console.log(`  config: 필수=${univConfig.mandatoryPattern}, 선택=${univConfig.optionalPattern ?? "없음"}, 가중택=${univConfig.weightedPattern ?? "없음"}`);
      console.log(`  calc: mandatory=${result.mandatoryScore.toFixed(2)}, optional=${result.optionalScore.toFixed(2)}, weighted=${result.weightedScore.toFixed(2)}, bonus=${result.bonusScore}`);
      console.log(`  excel: 필수=${excelMand.toFixed(2)}, 선택=${excelOpt.toFixed(2)}, 가중택=${excelWgt.toFixed(2)}`);
      console.log(`  convTable size: ${conversionTable.size}`);
      if (!result.isEligible) {
        console.log(`  결격: ${result.disqualificationReasons.join(", ")}`);
      }
    }
  }

  console.log("");
  console.log(`=== 결과: 일치/근사 ${matchCount}건, 불일치 ${mismatchCount}건 ===`);
}

main();
