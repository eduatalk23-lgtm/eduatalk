/**
 * 콜드 스타트 강사 정보 DB 저장
 *
 * 강의 추천 시 수집된 강사 정보를 master_instructors 테이블에 저장하고,
 * 해당 강의(master_lectures)와 연결합니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RecommendationItem, InstructorInfo } from "../types";
import type { Json } from "@/lib/supabase/database.types";
import type {
  SaveRecommendationOptions,
  ColdStartInstructorInsert,
  SavedInstructorItem,
  SaveInstructorsResult,
} from "./types";

/**
 * InstructorInfo → master_instructors Insert 데이터 변환
 */
function mapToInstructorInsert(
  info: InstructorInfo,
  options: SaveRecommendationOptions = {}
): ColdStartInstructorInsert {
  // 강사 메타데이터 빌드
  const instructorMetadata: Record<string, unknown> = {
    meta: {
      collectedAt: new Date().toISOString(),
      sources: ["cold_start"],
      reliability: 0.7, // AI 검색 기반 데이터
    },
  };

  // 추천 이유가 있으면 추가
  if (info.recommendationReasons && info.recommendationReasons.length > 0) {
    instructorMetadata.recommendations = {
      reasons: info.recommendationReasons,
    };
  }

  return {
    tenant_id: options.tenantId ?? null,
    name: info.name,
    platform: info.platform ?? null,
    profile_summary: info.profileSummary ?? null,
    subject_categories: info.subjectCategories ?? (options.subjectCategory ? [options.subjectCategory] : []),
    subjects: info.subjects ?? (options.subject ? [options.subject] : []),
    specialty: info.specialty ?? null,
    teaching_style: info.teachingStyle ?? null,
    difficulty_focus: info.difficultyFocus ?? options.difficultyLevel ?? null,
    lecture_pace: info.lecturePace ?? null,
    explanation_style: info.explanationStyle ?? null,
    review_score: info.reviewScore ?? null,
    review_count: info.reviewCount ?? 0,
    target_students: info.targetStudents ?? [],
    strengths: info.strengths ?? [],
    weaknesses: info.weaknesses ?? [],
    instructor_metadata: instructorMetadata as Json,
    source: "cold_start",
    is_active: true,
  };
}

/**
 * 강사명 + 플랫폼으로 중복 검사 (배치)
 */
async function checkInstructorDuplicatesBatch(
  instructors: Array<{ name: string; platform: string | null }>,
  tenantId: string | null
): Promise<Map<string, string>> {
  const supabase = createSupabaseAdminClient();

  if (!supabase || instructors.length === 0) {
    return new Map();
  }

  const names = instructors.map((i) => i.name);

  // 이름으로 조회 (플랫폼은 클라이언트에서 필터)
  const { data, error } = await supabase
    .from("master_instructors")
    .select("id, name, platform")
    .in("name", names)
    .eq("is_active", true);

  if (error) {
    console.error("[checkInstructorDuplicatesBatch] 중복 검사 실패:", error);
    return new Map();
  }

  // name + platform 조합으로 매핑
  const existingMap = new Map<string, string>();
  if (data) {
    for (const row of data) {
      const key = `${row.name}::${row.platform ?? ""}`;
      existingMap.set(key, row.id);
    }
  }

  return existingMap;
}

/**
 * 강사 정보를 추출하여 저장하고 강의와 연결
 *
 * @param recommendations - 추천 항목 목록 (lecture 타입에서 instructorInfo 추출)
 * @param savedLectureMap - 저장된 강의 제목 → ID 맵
 * @param options - 저장 옵션
 * @returns 강사 저장 결과
 */
export async function saveInstructorsAndLinkLectures(
  recommendations: RecommendationItem[],
  savedLectureMap: Map<string, string>,
  options: SaveRecommendationOptions = {}
): Promise<SaveInstructorsResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      success: false,
      savedInstructors: [],
      skippedDuplicates: 0,
      linkedLectures: 0,
      errors: [{ name: "system", error: "Admin 클라이언트 생성 실패" }],
    };
  }

  const savedInstructors: SavedInstructorItem[] = [];
  const errors: Array<{ name: string; error: string }> = [];
  let skippedDuplicates = 0;
  let linkedLectures = 0;

  const tenantId = options.tenantId ?? null;

  // 1. 강사 정보가 있는 강의만 필터링
  const lecturesWithInstructor = recommendations.filter(
    (r) => r.contentType === "lecture" && r.instructorInfo?.name
  );

  if (lecturesWithInstructor.length === 0) {
    return {
      success: true,
      savedInstructors: [],
      skippedDuplicates: 0,
      linkedLectures: 0,
      errors: [],
    };
  }

  // 2. 고유 강사 목록 생성 (name + platform 조합으로 중복 제거)
  const uniqueInstructors = new Map<string, { info: InstructorInfo; lectureTitle: string }>();
  for (const lecture of lecturesWithInstructor) {
    const info = lecture.instructorInfo!;
    const key = `${info.name}::${info.platform ?? ""}`;
    if (!uniqueInstructors.has(key)) {
      uniqueInstructors.set(key, { info, lectureTitle: lecture.title });
    }
  }

  // 3. 배치 중복 검사
  const instructorList = Array.from(uniqueInstructors.values()).map((v) => ({
    name: v.info.name,
    platform: v.info.platform ?? null,
  }));

  const existingMap = await checkInstructorDuplicatesBatch(instructorList, tenantId);

  // 4. 신규 강사 저장 + 기존 강사 ID 수집
  const instructorIdMap = new Map<string, string>(); // name::platform → instructor_id

  for (const [key, { info }] of uniqueInstructors) {
    const existingId = existingMap.get(key);

    if (existingId) {
      // 이미 존재하는 강사
      instructorIdMap.set(key, existingId);
      savedInstructors.push({
        id: existingId,
        name: info.name,
        platform: info.platform ?? null,
        isNew: false,
      });
      skippedDuplicates++;
    } else {
      // 신규 강사 저장
      const insertData = mapToInstructorInsert(info, options);

      const { data, error } = await supabase
        .from("master_instructors")
        .insert(insertData)
        .select("id, name, platform")
        .single();

      if (error) {
        errors.push({ name: info.name, error: error.message });
      } else if (data) {
        instructorIdMap.set(key, data.id);
        savedInstructors.push({
          id: data.id,
          name: data.name,
          platform: data.platform,
          isNew: true,
        });
      }
    }
  }

  // 5. 강의 - 강사 연결 (instructor_id 업데이트)
  for (const lecture of lecturesWithInstructor) {
    const info = lecture.instructorInfo!;
    const key = `${info.name}::${info.platform ?? ""}`;
    const instructorId = instructorIdMap.get(key);
    const lectureId = savedLectureMap.get(lecture.title);

    if (instructorId && lectureId) {
      const { error } = await supabase
        .from("master_lectures")
        .update({ instructor_id: instructorId })
        .eq("id", lectureId);

      if (error) {
        console.error(`[saveInstructorsAndLinkLectures] 강의 연결 실패 (${lecture.title}):`, error);
      } else {
        linkedLectures++;
      }
    }
  }

  return {
    success: errors.length === 0,
    savedInstructors,
    skippedDuplicates,
    linkedLectures,
    errors,
  };
}
