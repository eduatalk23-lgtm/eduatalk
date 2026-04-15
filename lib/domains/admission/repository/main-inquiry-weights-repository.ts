/**
 * 탐구 정합성 축 전용 — 트랙별 탐구 카테고리 가중치 조회
 *
 * university_profile_main_inquiry_weights 테이블 (8 track × 10 category = 80 seed 행).
 *
 * DB 접근이 있으므로 서버사이드 전용. 순수 함수 엔진(main-inquiry-alignment.ts)과 분리.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UniversityTrack } from "@/lib/domains/record-analysis/eval/university-profile-matcher";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

/**
 * 탐구 카테고리 식별자 (10개)
 *
 * DB enum university_inquiry_category_enum 과 1:1 대응.
 */
export type InquiryCategory =
  | "natural_science"
  | "life_medical"
  | "engineering"
  | "it_software"
  | "social_science"
  | "humanities"
  | "law_policy"
  | "business_economy"
  | "education"
  | "arts_sports";

/** DB 행 1개에 대응하는 도메인 타입 */
export interface MainInquiryWeight {
  track: UniversityTrack;
  inquiry_category: InquiryCategory;
  /** 0.0 ~ 1.0 */
  weight: number;
}

// ─── 공개 함수 ──────────────────────────────────────────────────────────────

/**
 * 전체 80행을 반환한다.
 *
 * @param client  생략 시 createSupabaseServerClient() 사용
 */
export async function listMainInquiryWeights(
  client?: SupabaseClient,
): Promise<MainInquiryWeight[]> {
  const supabase = client ?? (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from("university_profile_main_inquiry_weights")
    .select("track, inquiry_category, weight")
    .order("track")
    .order("inquiry_category");

  if (error) {
    throw new Error(
      `listMainInquiryWeights: DB 조회 실패 — ${error.message}`,
    );
  }

  return (data ?? []).map((row) => ({
    track: row.track as UniversityTrack,
    inquiry_category: row.inquiry_category as InquiryCategory,
    weight: Number(row.weight),
  }));
}

/**
 * 단일 track 의 10 카테고리 가중치 맵을 반환한다.
 *
 * DB에 해당 track 행이 없는 카테고리는 0으로 채운다.
 *
 * @param track   조회할 트랙
 * @param client  생략 시 createSupabaseServerClient() 사용
 */
export async function getWeightsForTrack(
  track: UniversityTrack,
  client?: SupabaseClient,
): Promise<Record<InquiryCategory, number>> {
  const supabase = client ?? (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from("university_profile_main_inquiry_weights")
    .select("inquiry_category, weight")
    .eq("track", track);

  if (error) {
    throw new Error(
      `getWeightsForTrack(${track}): DB 조회 실패 — ${error.message}`,
    );
  }

  return buildWeightMap(data ?? []);
}

/**
 * 전체 8×10 matrix를 Record<track, Record<category, weight>> 형태로 반환한다.
 *
 * @param client  생략 시 createSupabaseServerClient() 사용
 */
export async function getWeightsByTrackMap(
  client?: SupabaseClient,
): Promise<Record<UniversityTrack, Record<InquiryCategory, number>>> {
  const rows = await listMainInquiryWeights(client);

  const all = rows.reduce(
    (acc, row) => {
      if (!acc[row.track]) {
        acc[row.track] = emptyWeightMap();
      }
      acc[row.track][row.inquiry_category] = row.weight;
      return acc;
    },
    {} as Record<UniversityTrack, Record<InquiryCategory, number>>,
  );

  return all;
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

const ALL_CATEGORIES: InquiryCategory[] = [
  "natural_science",
  "life_medical",
  "engineering",
  "it_software",
  "social_science",
  "humanities",
  "law_policy",
  "business_economy",
  "education",
  "arts_sports",
];

/** 10개 카테고리 모두 0으로 초기화한 맵 */
function emptyWeightMap(): Record<InquiryCategory, number> {
  return ALL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = 0;
      return acc;
    },
    {} as Record<InquiryCategory, number>,
  );
}

/**
 * DB 행 배열에서 가중치 맵 빌드.
 * DB에 없는 카테고리는 0으로 채운다.
 */
function buildWeightMap(
  rows: Array<{ inquiry_category: string; weight: number }>,
): Record<InquiryCategory, number> {
  const map = emptyWeightMap();
  for (const row of rows) {
    const cat = row.inquiry_category as InquiryCategory;
    map[cat] = Number(row.weight);
  }
  return map;
}
