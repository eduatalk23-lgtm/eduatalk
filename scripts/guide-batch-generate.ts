#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
/**
 * 탐구 가이드 + 주제 배치 생성 CLI 스크립트
 *
 * 사용법:
 *   npx tsx scripts/guide-batch-generate.ts [phase] [options]
 *
 * Phase:
 *   topics    - Phase 1: 주제(Topic) 대량 생성 (AI → DB)
 *   guides    - Phase 2: 주제 기반 가이드 생성 (AI → DB)
 *   review    - Phase 3: 생성된 가이드 AI 리뷰
 *   all       - Phase 1→2→3 순차 실행
 *
 * 옵션:
 *   --dry-run        실제 API 호출 없이 대상 조합만 출력
 *   --career=HUM     특정 계열만 (HUM,SOC,EDU,ENG,NAT,MED,ART)
 *   --difficulty=basic  특정 난이도만 (basic,intermediate,advanced)
 *   --type=reading   특정 가이드 유형만
 *   --limit=N        생성 대상 제한
 *   --delay=N        API 호출 간 딜레이 ms (기본: 3000)
 *   --topics-per=N   주제 생성 시 호출당 주제 수 (기본: 10, AI 응답)
 *   --guides-per=N   계열×과목당 생성할 가이드 수 (기본: 2)
 *   --all-unused     미사용 주제 전체에서 1:1 가이드 생성 (guides 모드)
 *
 * 예시:
 *   npx tsx scripts/guide-batch-generate.ts topics --dry-run
 *   npx tsx scripts/guide-batch-generate.ts topics --career=ENG --limit=5
 *   npx tsx scripts/guide-batch-generate.ts guides --career=NAT --difficulty=basic
 *   npx tsx scripts/guide-batch-generate.ts all --limit=10 --delay=5000
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  SUGGEST_TOPICS_SYSTEM_PROMPT,
  buildSuggestTopicPrompt,
} from "../lib/domains/guide/llm/prompts/suggest-topics";
import {
  buildKeywordSystemPrompt,
  buildKeywordUserPrompt,
} from "../lib/domains/guide/llm/prompts/keyword-guide";
import {
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
} from "../lib/domains/guide/llm/prompts/review";
import {
  generatedGuideSchema,
  suggestedTopicsSchema,
  guideReviewSchema,
  scoreToQualityTier,
  scoreToStatus,
} from "../lib/domains/guide/llm/types";
import { splitSetekExamplesBlob } from "../lib/domains/guide/section-config";
import type { GuideType } from "../lib/domains/guide/types";
import { GUIDE_TYPE_LABELS } from "../lib/domains/guide/types";

// ─────────────────────────────────────────────────────────────
// 환경 변수 체크
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  process.exit(1);
}
if (!GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY 환경변수가 없습니다.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 계열-과목 자연매칭 매트릭스
// ─────────────────────────────────────────────────────────────

type CareerCode = "HUM" | "SOC" | "EDU" | "ENG" | "NAT" | "MED" | "ART";

interface CareerSubjectEntry {
  code: CareerCode;
  label: string;
  subjects: string[];
  /** 가이드 유형 우선순위 (앞쪽이 높은 우선순위) */
  preferredTypes: GuideType[];
  /** Tier 2 전공 키 (역량 맥락 주입용) */
  majors: string[];
}

const CAREER_SUBJECT_MATRIX: CareerSubjectEntry[] = [
  {
    code: "HUM",
    label: "인문계열",
    subjects: [
      "공통국어1", "공통국어2", "윤리와 사상",
      "한국사1", "한국사2", "세계사", "한국지리 탐구",
    ],
    preferredTypes: ["reading", "topic_exploration", "subject_performance"],
    majors: ["국어", "외국어", "사학·철학"],
  },
  {
    code: "SOC",
    label: "사회계열",
    subjects: [
      "통합사회1", "통합사회2", "정치", "경제",
      "사회와 문화", "세계시민과 지리", "현대사회와 윤리",
    ],
    preferredTypes: ["topic_exploration", "reading", "subject_performance"],
    majors: ["법·행정", "경영·경제", "심리", "정치·외교", "사회"],
  },
  {
    code: "EDU",
    label: "교육계열",
    subjects: [
      "인문학과 윤리", "통합사회1", "현대사회와 윤리",
    ],
    preferredTypes: ["topic_exploration", "program", "reading"],
    majors: ["교육"],
  },
  {
    code: "ENG",
    label: "공학계열",
    subjects: [
      "물리학", "역학과 에너지", "전자기와 양자",
      "정보", "공통수학1", "대수", "미적분Ⅰ", "기술·가정",
    ],
    preferredTypes: ["experiment", "topic_exploration", "subject_performance"],
    majors: ["컴퓨터·정보", "전기·전자", "기계·자동차·로봇"],
  },
  {
    code: "NAT",
    label: "자연계열",
    subjects: [
      "생명과학", "세포와 물질대사", "생물의 유전",
      "화학", "화학 반응의 세계",
      "지구과학", "지구시스템과학",
      "대수", "미적분Ⅰ", "확률과 통계",
    ],
    preferredTypes: ["experiment", "topic_exploration", "subject_performance"],
    majors: ["수리·통계", "물리·천문", "생명·바이오"],
  },
  {
    code: "MED",
    label: "의약계열",
    subjects: [
      "생명과학", "세포와 물질대사", "생물의 유전",
      "화학", "화학 반응의 세계",
    ],
    preferredTypes: ["topic_exploration", "reading", "experiment"],
    majors: ["의학·약학", "보건"],
  },
  {
    code: "ART",
    label: "예체능계열",
    subjects: ["미술", "음악", "체육"],
    preferredTypes: ["program", "topic_exploration", "subject_performance"],
    majors: [],
  },
];

const DIFFICULTY_LEVELS = ["basic", "intermediate", "advanced"] as const;
type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// ─────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const phase = (args.find((a) => !a.startsWith("--")) ?? "topics") as
  | "topics"
  | "guides"
  | "review"
  | "all";
const isDryRun = args.includes("--dry-run");

function getArgValue(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
}

const filterCareer = getArgValue("career") as CareerCode | undefined;
const filterDifficulty = getArgValue("difficulty") as DifficultyLevel | undefined;
const filterType = getArgValue("type") as GuideType | undefined;
const limit = getArgValue("limit") ? parseInt(getArgValue("limit")!, 10) : undefined;
const delay = getArgValue("delay") ? parseInt(getArgValue("delay")!, 10) : 3000;
const guidesPerCombo = getArgValue("guides-per")
  ? parseInt(getArgValue("guides-per")!, 10)
  : 2;
/** --all-unused: 미사용 주제 전체에서 1:1로 가이드 생성 (guidesPerCombo 무시) */
const allUnused = args.includes("--all-unused");

// ─────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
}
function logSection(title: string) {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

// AI 모델 — ai-sdk.ts의 fallback 체인과 동일
const FAST_MODEL = google("gemini-2.5-flash");
const ADVANCED_FALLBACK_CHAIN = [
  google("gemini-3.1-pro-preview"),
  google("gemini-3-pro-preview"),
  google("gemini-2.5-pro"),
];

/** Rate limit 대응 재시도 래퍼 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes("429") ||
        msg.includes("overloaded") ||
        msg.includes("high demand") ||
        msg.includes("503") ||
        msg.includes("RESOURCE_EXHAUSTED");
      if (!isRetryable || attempt === maxRetries) throw err;
      const waitMs = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      log(`  ⏳ Rate limit — ${Math.round(waitMs / 1000)}초 대기 후 재시도 (${attempt + 1}/${maxRetries})`);
      await sleep(waitMs);
    }
  }
  throw new Error("unreachable");
}

// ─────────────────────────────────────────────────────────────
// 조합 생성
// ─────────────────────────────────────────────────────────────

interface TopicCombo {
  career: CareerSubjectEntry;
  /** 교과명 (예: "과학과") */
  subjectArea: string | undefined;
  /** 과목명 (예: "물리학") */
  subject: string;
  /** 대단원명 (예: "힘과 에너지") */
  majorUnit: string | undefined;
  /** 소단원명 (예: "뉴턴 운동 법칙") */
  minorUnit: string | undefined;
  guideType: GuideType;
  difficulty: DifficultyLevel;
  major: string | undefined;
}

/** 교육과정 단원 정보 (교과 + 대단원 + 소단원) */
interface CurriculumInfo {
  subjectArea: string;
  majors: Array<{
    name: string;
    minors: string[];
  }>;
}

/** DB에서 교육과정 전체 계층을 로드: 교과 → 과목 → 대단원 → 소단원 */
async function loadCurriculumHierarchy(
  supabase: SupabaseClient,
): Promise<Map<string, CurriculumInfo>> {
  const { data, error } = await supabase
    .from("exploration_guide_curriculum_units")
    .select("id, subject_area, subject_name, unit_type, unit_name, parent_unit_id")
    .eq("curriculum_year", 2022)
    .order("sort_order");

  if (error) {
    log(`⚠ 교육과정 단원 로드 실패: ${error.message} — 과목 수준으로 fallback`);
    return new Map();
  }

  const rows = data ?? [];
  const result = new Map<string, CurriculumInfo>();

  // 1차: 과목별 교과 + 대단원 수집
  const majorIdMap = new Map<string, string>(); // id → unit_name
  for (const row of rows) {
    if (row.unit_type === "major") {
      majorIdMap.set(row.id, row.unit_name);
      if (!result.has(row.subject_name)) {
        result.set(row.subject_name, {
          subjectArea: row.subject_area ?? "",
          majors: [],
        });
      }
      result.get(row.subject_name)!.majors.push({
        name: row.unit_name,
        minors: [],
      });
    }
  }

  // 2차: 소단원을 부모 대단원에 연결
  for (const row of rows) {
    if (row.unit_type === "minor" && row.parent_unit_id) {
      const parentName = majorIdMap.get(row.parent_unit_id);
      if (parentName) {
        const info = result.get(row.subject_name);
        const majorEntry = info?.majors.find((m) => m.name === parentName);
        majorEntry?.minors.push(row.unit_name);
      }
    }
  }

  return result;
}

function buildTopicCombos(
  curriculumMap: Map<string, CurriculumInfo>,
): TopicCombo[] {
  const combos: TopicCombo[] = [];
  const matrix = filterCareer
    ? CAREER_SUBJECT_MATRIX.filter((c) => c.code === filterCareer)
    : CAREER_SUBJECT_MATRIX;

  const difficulties = filterDifficulty ? [filterDifficulty] : [...DIFFICULTY_LEVELS];

  for (const career of matrix) {
    const types = filterType
      ? [filterType]
      : career.preferredTypes.slice(0, 2);

    const major = career.majors[0];

    for (const subject of career.subjects) {
      const info = curriculumMap.get(subject);

      if (info && info.majors.length > 0) {
        for (const majorEntry of info.majors) {
          if (majorEntry.minors.length > 0) {
            // 소단원이 있으면 소단원별로 조합 생성
            for (const minorUnit of majorEntry.minors) {
              for (const guideType of types) {
                for (const difficulty of difficulties) {
                  combos.push({
                    career, subjectArea: info.subjectArea, subject,
                    majorUnit: majorEntry.name, minorUnit,
                    guideType, difficulty, major,
                  });
                }
              }
            }
          } else {
            // 소단원 없으면 대단원 수준
            for (const guideType of types) {
              for (const difficulty of difficulties) {
                combos.push({
                  career, subjectArea: info.subjectArea, subject,
                  majorUnit: majorEntry.name, minorUnit: undefined,
                  guideType, difficulty, major,
                });
              }
            }
          }
        }
      } else {
        // 교육과정 단원이 없는 과목 (예체능 등) → 과목 수준
        for (const guideType of types) {
          for (const difficulty of difficulties) {
            combos.push({
              career, subjectArea: undefined, subject,
              majorUnit: undefined, minorUnit: undefined,
              guideType, difficulty, major,
            });
          }
        }
      }
    }
  }

  return limit ? combos.slice(0, limit) : combos;
}

// ─────────────────────────────────────────────────────────────
// Phase 1: 주제 생성
// ─────────────────────────────────────────────────────────────

interface GeneratedTopic {
  title: string;
  reason: string;
  relatedSubjects: string[];
  difficulty: DifficultyLevel;
  career: CareerCode;
  careerLabel: string;
  subjectArea: string | undefined;
  subject: string;
  majorUnit: string | undefined;
  minorUnit: string | undefined;
  guideType: GuideType;
  major: string | undefined;
}

async function phaseTopics(supabase: SupabaseClient): Promise<GeneratedTopic[]> {
  logSection("Phase 1: 주제(Topic) 대량 생성");

  // DB에서 교육과정 계층 로드 (교과 → 과목 → 대단원 → 소단원)
  const curriculumMap = await loadCurriculumHierarchy(supabase);
  const totalUnits = [...curriculumMap.values()].reduce(
    (s, info) => s + info.majors.reduce((ms, m) => ms + Math.max(m.minors.length, 1), 0), 0,
  );
  log(`교육과정 로드: ${curriculumMap.size}개 과목, ${totalUnits}개 단원 (대+소)`);

  const combos = buildTopicCombos(curriculumMap);
  log(`총 조합: ${combos.length}개 (각 10개 주제 → ~${combos.length * 10}개 예상)`);

  if (isDryRun) {
    logSection("조합 목록 (dry-run)");
    combos.forEach((c, i) => {
      const typeLabel = GUIDE_TYPE_LABELS[c.guideType] ?? c.guideType;
      const unitPath = [c.subjectArea, c.subject, c.majorUnit, c.minorUnit]
        .filter(Boolean).join(" > ");
      log(
        `  ${String(i + 1).padStart(3)}. [${c.career.code}] ${unitPath} / ${typeLabel} / ${c.difficulty}`,
      );
    });
    log(`\n→ 예상 API 호출: ${combos.length}회`);
    log(`→ 예상 소요 시간: ~${Math.ceil((combos.length * (delay + 5000)) / 60000)}분`);
    return [];
  }

  const allTopics: GeneratedTopic[] = [];
  const stats = { success: 0, failed: 0, topics: 0 };
  const startTime = Date.now();

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const typeLabel = GUIDE_TYPE_LABELS[combo.guideType] ?? combo.guideType;
    const unitPath = [combo.subject, combo.majorUnit, combo.minorUnit]
      .filter(Boolean).join(" > ");
    const progress = `[${String(i + 1).padStart(3)}/${combos.length}]`;
    log(
      `${progress} ${combo.career.code} / ${unitPath} / ${typeLabel} / ${combo.difficulty}`,
    );

    try {
      // 기존 주제 제목 조회 (중복 회피)
      const { data: existing } = await supabase
        .from("suggested_topics")
        .select("title")
        .eq("guide_type", combo.guideType)
        .eq("subject_name", combo.subject)
        .eq("career_field", combo.career.label)
        .limit(10);

      const existingTitles = (existing ?? []).map(
        (t: { title: string }) => t.title,
      );

      const userPrompt = buildSuggestTopicPrompt({
        guideType: combo.guideType,
        subject: combo.subject,
        careerField: combo.career.label,
        targetMajor: combo.major,
        curriculumYear: 2022,
        majorUnit: combo.majorUnit,
        minorUnit: combo.minorUnit,
        existingTitles,
        difficultyLevel: combo.difficulty,
      });

      const { object: result } = await withRetry(() =>
        generateObject({
          model: FAST_MODEL,
          system: SUGGEST_TOPICS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          schema: suggestedTopicsSchema,
          temperature: 0.7,
          maxTokens: 2048,
        }),
      );

      // DB 저장
      const rows = result.topics.map((t) => ({
        tenant_id: null,
        guide_type: combo.guideType,
        subject_name: combo.subject,
        subject_group: combo.subjectArea ?? null,
        career_field: combo.career.label,
        curriculum_year: 2022,
        target_major: combo.major ?? null,
        major_unit: combo.majorUnit ?? null,
        minor_unit: combo.minorUnit ?? null,
        title: t.title,
        reason: t.reason,
        related_subjects: t.relatedSubjects,
        difficulty_level: t.difficulty,
        ai_model_version: "gemini-2.5-flash",
        used_count: 0,
        guide_created_count: 0,
      }));

      // tenant_id IS NULL 글로벌 주제: 유니크 인덱스 idx_st_title_global(title)
      // 중복 무시를 위해 개별 insert + catch
      let savedCount = 0;
      for (const row of rows) {
        const { error: rowErr } = await supabase
          .from("suggested_topics")
          .insert(row);
        if (!rowErr) savedCount++;
        // 중복(23505) 에러는 무시
      }

      if (savedCount < rows.length) {
        log(`  ℹ DB 저장: ${savedCount}/${rows.length} (${rows.length - savedCount}개 중복 스킵)`);
      }

      const topics: GeneratedTopic[] = result.topics.map((t) => ({
        title: t.title,
        reason: t.reason,
        relatedSubjects: t.relatedSubjects,
        difficulty: t.difficulty as DifficultyLevel,
        career: combo.career.code,
        careerLabel: combo.career.label,
        subjectArea: combo.subjectArea,
        subject: combo.subject,
        majorUnit: combo.majorUnit,
        minorUnit: combo.minorUnit,
        guideType: combo.guideType,
        major: combo.major,
      }));

      allTopics.push(...topics);
      stats.success++;
      stats.topics += topics.length;
      log(`  ✅ ${topics.length}개 주제 생성`);
    } catch (err) {
      stats.failed++;
      log(`  ❌ 실패: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < combos.length - 1) await sleep(delay);
  }

  logSection("Phase 1 완료");
  log(`성공: ${stats.success}/${combos.length}, 실패: ${stats.failed}`);
  log(`총 주제: ${stats.topics}개`);
  log(`소요 시간: ${formatDuration(Date.now() - startTime)}`);

  return allTopics;
}

// ─────────────────────────────────────────────────────────────
// Phase 2: 가이드 생성
// ─────────────────────────────────────────────────────────────

async function phaseGuides(
  supabase: SupabaseClient,
  topics?: GeneratedTopic[],
): Promise<string[]> {
  logSection("Phase 2: 주제 기반 가이드 생성");

  // 주제가 없으면 DB에서 가이드 미생성 주제를 가져옴
  let sourceTopics: GeneratedTopic[];
  if (topics && topics.length > 0) {
    sourceTopics = topics;
  } else {
    log("DB에서 가이드 미생성 주제 조회 중...");
    let query = supabase
      .from("suggested_topics")
      .select("*")
      .eq("guide_created_count", 0)
      .order("created_at", { ascending: false });

    if (filterCareer) {
      const careerEntry = CAREER_SUBJECT_MATRIX.find(
        (c) => c.code === filterCareer,
      );
      if (careerEntry) {
        query = query.eq("career_field", careerEntry.label);
      }
    }
    if (filterDifficulty) {
      query = query.eq("difficulty_level", filterDifficulty);
    }
    if (filterType) {
      query = query.eq("guide_type", filterType);
    }

    const { data, error } = await query.limit(limit ?? 500);
    if (error) {
      log(`❌ 주제 조회 실패: ${error.message}`);
      return [];
    }

    sourceTopics = (data ?? []).map((t: Record<string, unknown>) => ({
      title: t.title as string,
      reason: (t.reason as string) ?? "",
      relatedSubjects: (t.related_subjects as string[]) ?? [],
      difficulty: (t.difficulty_level as DifficultyLevel) ?? "intermediate",
      career: (CAREER_SUBJECT_MATRIX.find(
        (c) => c.label === t.career_field,
      )?.code ?? "HUM") as CareerCode,
      careerLabel: (t.career_field as string) ?? "",
      subjectArea: (t.subject_group as string) ?? undefined,
      subject: (t.subject_name as string) ?? "",
      majorUnit: (t.major_unit as string) ?? undefined,
      minorUnit: (t.minor_unit as string) ?? undefined,
      guideType: (t.guide_type as GuideType) ?? "topic_exploration",
      major: (t.target_major as string) ?? undefined,
    }));
  }

  // 계열×과목×유형×난이도당 guidesPerCombo개씩 선택
  const selected = allUnused
    ? (limit ? sourceTopics.slice(0, limit) : sourceTopics)
    : selectTopicsForGuideGeneration(sourceTopics, guidesPerCombo);
  log(`가이드 생성 대상: ${selected.length}개 (총 주제 풀: ${sourceTopics.length}개)`);

  if (isDryRun) {
    selected.forEach((t, i) => {
      log(
        `  ${String(i + 1).padStart(3)}. [${t.career}] ${t.subject} / ${t.guideType} / ${t.difficulty} — "${t.title}"`,
      );
    });
    log(`\n→ 예상 API 호출: ${selected.length}회 (가이드 생성)`);
    log(`→ 예상 소요 시간: ~${Math.ceil((selected.length * (delay + 15000)) / 60000)}분`);
    return [];
  }

  // 과목명/계열명 → ID 매핑 미리 로드
  const [subjectRows, careerRows, classificationRows] = await Promise.all([
    supabase.from("subjects").select("id, name").then((r) => r.data ?? []),
    supabase
      .from("exploration_guide_career_fields")
      .select("id, code, name_kor")
      .then((r) => r.data ?? []),
    supabase
      .from("department_classification")
      .select("id, sub_name")
      .then((r) => r.data ?? []),
  ]);

  const subjectMap = new Map(
    subjectRows.map((s: { id: string; name: string }) => [s.name, s.id]),
  );
  const careerFieldMap = new Map(
    careerRows.map(
      (c: { id: string; code: string; name_kor: string }) => [c.name_kor, c.id],
    ),
  );
  const classificationMap = new Map(
    classificationRows.map(
      (c: { id: string; sub_name: string }) => [c.sub_name, c.id],
    ),
  );

  const guideIds: string[] = [];
  const stats = { success: 0, failed: 0 };
  const startTime = Date.now();

  for (let i = 0; i < selected.length; i++) {
    const topic = selected[i];
    const progress = `[${String(i + 1).padStart(3)}/${selected.length}]`;
    log(`${progress} "${topic.title}" (${topic.career}/${topic.subject}/${topic.difficulty})`);

    try {
      const systemPrompt = buildKeywordSystemPrompt(
        topic.guideType,
        undefined, // no student profile
        undefined, // all sections
        topic.difficulty,
      );
      const userPrompt = buildKeywordUserPrompt({
        keyword: topic.title,
        guideType: topic.guideType,
        targetSubject: topic.subject,
        targetCareerField: topic.careerLabel,
      });

      // advanced 우선, fallback to fast
      let generated;
      let modelId: string;
      // Pro fallback 체인: 3.1-pro → 3-pro → 2.5-pro → Flash
      let proSuccess = false;
      for (let ci = 0; ci < ADVANCED_FALLBACK_CHAIN.length; ci++) {
        try {
          // fallback 체인 내에서는 재시도 1회만 (quota 에러는 재시도 무의미)
          const result = await withRetry(() =>
            generateObject({
              model: ADVANCED_FALLBACK_CHAIN[ci],
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }],
              schema: generatedGuideSchema,
              temperature: 0.5,
              maxTokens: 65536,
            }),
          );
          generated = result.object;
          modelId = ["gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-2.5-pro"][ci];
          proSuccess = true;
          break;
        } catch (proErr) {
          const msg = proErr instanceof Error ? proErr.message : "";
          const isRetryable = msg.includes("429") || msg.includes("503") || msg.includes("overloaded") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
          if (isRetryable && ci < ADVANCED_FALLBACK_CHAIN.length - 1) {
            log(`  ⚠ ${["3.1-pro", "3-pro", "2.5-pro"][ci]} 실패 → 다음 Pro 시도`);
            continue;
          }
          break;
        }
      }
      if (!proSuccess) {
        log(`  ⚠ Pro 체인 전부 실패 → Flash fallback`);
        const result = await withRetry(() =>
          generateObject({
            model: FAST_MODEL,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            schema: generatedGuideSchema,
            temperature: 0.5,
            maxTokens: 40960,
          }),
        );
        generated = result.object;
        modelId = "gemini-2.5-flash (fallback)";
      }

      // DB 저장: exploration_guides
      const { data: guide, error: guideError } = await supabase
        .from("exploration_guides")
        .insert({
          tenant_id: null,
          guide_type: generated.guideType,
          title: generated.title,
          book_title: generated.bookTitle ?? null,
          book_author: generated.bookAuthor ?? null,
          book_publisher: generated.bookPublisher ?? null,
          curriculum_year: 2022,
          subject_area: topic.subjectArea ?? null,
          subject_select: topic.subject,
          unit_major: topic.majorUnit ?? null,
          unit_minor: topic.minorUnit ?? null,
          status: "draft",
          source_type: "ai_keyword",
          content_format: "html",
          quality_tier: "ai_draft",
          ai_model_version: modelId,
          ai_prompt_version: "batch-v1",
          difficulty_level: generated.difficultyLevel ?? topic.difficulty,
          difficulty_auto: true,
          version: 1,
          is_latest: true,
        })
        .select("id")
        .single();

      if (guideError || !guide) {
        throw new Error(`가이드 INSERT 실패: ${guideError?.message}`);
      }

      // DB 저장: exploration_guide_content
      const sections = generated.sections.map((s) => {
        let items = s.items;
        if (s.key === "setek_examples" && !s.items?.length) {
          const split = s.content ? splitSetekExamplesBlob(s.content) : null;
          items =
            split ??
            generated.setekExamples ??
            (s.content ? [s.content] : undefined);
        }
        return {
          key: s.key,
          label: s.label,
          content: s.content,
          content_format: "html",
          items,
          order: s.order,
          outline: s.outline,
        };
      });

      // 레거시 필드 변환
      const motivation = generated.sections.find(
        (s) => s.key === "motivation",
      )?.content;
      const reflection = generated.sections.find(
        (s) => s.key === "reflection",
      )?.content;
      const impression = generated.sections.find(
        (s) => s.key === "impression",
      )?.content;
      const summary = generated.sections.find(
        (s) => s.key === "summary",
      )?.content;
      const theorySections = generated.sections
        .filter((s) => s.key === "content_sections")
        .map((s, idx) => ({
          order: s.order ?? idx + 1,
          title: s.label,
          content: s.content,
          content_format: "html",
          outline: s.outline,
        }));

      await supabase.from("exploration_guide_content").insert({
        guide_id: guide.id,
        motivation: motivation ?? generated.motivation ?? "",
        theory_sections: theorySections.length > 0 ? theorySections : (generated.theorySections ?? []),
        reflection: reflection ?? generated.reflection ?? "",
        impression: impression ?? generated.impression ?? "",
        summary: summary ?? generated.summary ?? "",
        follow_up:
          generated.sections.find((s) => s.key === "follow_up")?.content ??
          generated.followUp ??
          "",
        book_description:
          generated.sections.find((s) => s.key === "book_description")
            ?.content ??
          generated.bookDescription ??
          null,
        related_papers: generated.relatedPapers ?? [],
        setek_examples:
          generated.sections
            .find((s) => s.key === "setek_examples")
            ?.items ?? generated.setekExamples ?? [],
        content_sections: sections,
      });

      // 과목 매핑
      const matchedSubjectIds = generated.suggestedSubjects
        .map((name) => subjectMap.get(name))
        .filter(Boolean) as string[];
      if (matchedSubjectIds.length > 0) {
        await supabase.from("exploration_guide_subject_mappings").insert(
          matchedSubjectIds.map((subjectId) => ({
            guide_id: guide.id,
            subject_id: subjectId,
          })),
        );
      }

      // 계열 매핑
      const matchedCareerIds = generated.suggestedCareerFields
        .map((name) => careerFieldMap.get(name))
        .filter(Boolean) as string[];
      if (matchedCareerIds.length > 0) {
        await supabase.from("exploration_guide_career_mappings").insert(
          [...new Set(matchedCareerIds)].map((careerFieldId) => ({
            guide_id: guide.id,
            career_field_id: careerFieldId,
          })),
        );
      }

      // 소분류 매핑
      const matchedClassIds = (generated.suggestedClassifications ?? [])
        .map((name) => classificationMap.get(name))
        .filter(Boolean) as string[];
      if (matchedClassIds.length > 0) {
        await supabase.from("exploration_guide_classification_mappings").insert(
          [...new Set(matchedClassIds)].map((classificationId) => ({
            guide_id: guide.id,
            classification_id: classificationId,
          })),
        );
      }

      // 주제 사용 카운트 증가 (수동 업데이트)
      try {
        await supabase
          .from("suggested_topics")
          .update({ guide_created_count: 1, used_count: 1 })
          .eq("title", topic.title)
          .eq("guide_type", topic.guideType);
      } catch {
        // 실패 무시
      }

      guideIds.push(guide.id);
      stats.success++;
      log(`  ✅ 가이드 생성 완료 (${guide.id})`);
    } catch (err) {
      stats.failed++;
      log(`  ❌ 실패: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < selected.length - 1) await sleep(delay);
  }

  logSection("Phase 2 완료");
  log(`성공: ${stats.success}/${selected.length}, 실패: ${stats.failed}`);
  log(`소요 시간: ${formatDuration(Date.now() - startTime)}`);

  return guideIds;
}

/** 계열×과목×유형×난이도당 N개씩 균등 선택 */
function selectTopicsForGuideGeneration(
  topics: GeneratedTopic[],
  perCombo: number,
): GeneratedTopic[] {
  const grouped = new Map<string, GeneratedTopic[]>();
  for (const t of topics) {
    const key = `${t.career}|${t.subject}|${t.guideType}|${t.difficulty}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  const selected: GeneratedTopic[] = [];
  for (const [, group] of grouped) {
    // 랜덤 셔플 후 N개 선택
    const shuffled = group.sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, perCombo));
  }

  return limit ? selected.slice(0, limit) : selected;
}

// ─────────────────────────────────────────────────────────────
// Phase 3: AI 리뷰
// ─────────────────────────────────────────────────────────────

async function phaseReview(
  supabase: SupabaseClient,
  guideIds?: string[],
): Promise<void> {
  logSection("Phase 3: AI 리뷰");

  // 가이드 ID가 없으면 DB에서 미리뷰 draft 가이드 조회
  let targetIds: string[];
  if (guideIds && guideIds.length > 0) {
    targetIds = guideIds;
  } else {
    log("DB에서 미리뷰 가이드 조회 중...");
    const { data, error } = await supabase
      .from("exploration_guides")
      .select("id")
      .eq("status", "draft")
      .eq("source_type", "ai_keyword")
      .is("quality_score", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 500);

    if (error) {
      log(`❌ 가이드 조회 실패: ${error.message}`);
      return;
    }
    targetIds = (data ?? []).map((d: { id: string }) => d.id);
  }

  log(`리뷰 대상: ${targetIds.length}개`);

  if (isDryRun) {
    log(`→ 예상 API 호출: ${targetIds.length}회`);
    log(`→ 예상 소요 시간: ~${Math.ceil((targetIds.length * (delay + 8000)) / 60000)}분`);
    return;
  }

  const stats = { success: 0, failed: 0, approved: 0, pending: 0, rejected: 0 };
  const startTime = Date.now();

  for (let i = 0; i < targetIds.length; i++) {
    const guideId = targetIds[i];
    const progress = `[${String(i + 1).padStart(3)}/${targetIds.length}]`;
    log(`${progress} ${guideId}`);

    try {
      // 가이드 + 콘텐츠 로드
      const { data: guide } = await supabase
        .from("exploration_guides")
        .select(
          "*, content:exploration_guide_content(*), subjects:exploration_guide_subject_mappings(subject_id, subject:subjects(id, name)), career_fields:exploration_guide_career_mappings(career_field_id, career_field:exploration_guide_career_fields(id, code, name_kor))",
        )
        .eq("id", guideId)
        .single();

      if (!guide || !guide.content) {
        log(`  ⚠ 가이드/콘텐츠 없음 — 스킵`);
        continue;
      }

      // 상태를 ai_reviewing으로 전환
      await supabase
        .from("exploration_guides")
        .update({ status: "ai_reviewing" })
        .eq("id", guideId);

      const { object: review } = await withRetry(() =>
        generateObject({
          model: ADVANCED_FALLBACK_CHAIN[0],
          system: buildReviewSystemPrompt(guide.guide_type as GuideType),
          messages: [
            { role: "user", content: buildReviewUserPrompt(guide) },
          ],
          schema: guideReviewSchema,
          temperature: 0.2,
          maxTokens: 8192,
        }),
      );

      const tier = scoreToQualityTier(review.overallScore);
      const status = scoreToStatus(review.overallScore);

      await supabase
        .from("exploration_guides")
        .update({
          status,
          quality_score: review.overallScore,
          quality_tier: tier,
          review_result: {
            dimensions: review.dimensions,
            feedback: review.feedback,
            strengths: review.strengths,
            reviewedAt: new Date().toISOString(),
            modelId: "gemini-3.1-pro-preview",
          },
        })
        .eq("id", guideId);

      stats.success++;
      if (status === "pending_approval") stats.pending++;
      else stats.rejected++;
      if (review.overallScore >= 80) stats.approved++;

      log(
        `  ✅ 점수: ${review.overallScore} → ${tier} (${status})`,
      );
    } catch (err) {
      stats.failed++;
      // 리뷰 실패 시 상태 복원
      await supabase
        .from("exploration_guides")
        .update({ status: "draft" })
        .eq("id", guideId)
        .catch(() => {});
      log(`  ❌ 실패: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < targetIds.length - 1) await sleep(delay);
  }

  logSection("Phase 3 완료");
  log(`성공: ${stats.success}/${targetIds.length}, 실패: ${stats.failed}`);
  log(`승인: ${stats.approved}, 보류: ${stats.pending}, 반려: ${stats.rejected}`);
  log(`소요 시간: ${formatDuration(Date.now() - startTime)}`);
}

// ─────────────────────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────────────────────

async function main() {
  logSection("탐구 가이드 배치 생성");
  log(`Phase: ${phase}`);
  log(`모드: ${isDryRun ? "DRY-RUN" : "LIVE"}`);
  if (filterCareer) log(`계열 필터: ${filterCareer}`);
  if (filterDifficulty) log(`난이도 필터: ${filterDifficulty}`);
  if (filterType) log(`유형 필터: ${filterType}`);
  if (limit) log(`대상 제한: ${limit}개`);
  log(`API 딜레이: ${delay}ms`);
  log(`계열×과목당 가이드 수: ${guidesPerCombo}개`);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  switch (phase) {
    case "topics": {
      await phaseTopics(supabase);
      break;
    }
    case "guides": {
      await phaseGuides(supabase);
      break;
    }
    case "review": {
      await phaseReview(supabase);
      break;
    }
    case "all": {
      const topics = await phaseTopics(supabase);
      if (isDryRun) {
        // dry-run에서는 guides/review도 조합만 출력
        await phaseGuides(supabase, topics);
        await phaseReview(supabase);
      } else {
        const guideIds = await phaseGuides(supabase, topics);
        await phaseReview(supabase, guideIds);
      }
      break;
    }
    default:
      log(`❌ 알 수 없는 phase: ${phase}`);
      log(`사용 가능: topics, guides, review, all`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("스크립트 실행 실패:", err);
  process.exit(1);
});
