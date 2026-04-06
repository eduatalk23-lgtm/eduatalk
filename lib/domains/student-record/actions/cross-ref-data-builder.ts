"use server";

// ============================================
// 상호 참조 데이터 빌더 (스토리라인/독서 연결 UI용)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOG_CTX = { domain: "student-record", action: "cross-ref-data" };

export interface CrossRefSourceData {
  storylineLinks: import("../types").StorylineLink[];
  readingLinks: import("../types").ReadingLink[];
  /** reading_id → book title */
  readingLabelMap: Record<string, string>;
  /** record_id → display label (세특/창체/행특/독서 등) */
  recordLabelMap: Record<string, string>;
  /** G3-5: record_id → content 텍스트 */
  recordContentMap: Record<string, string>;
  /** S4: record_id → grade */
  recordGradeMap?: Record<string, number>;
  /** S4: record_id → recordType */
  recordTypeMap?: Record<string, string>;
}

export async function fetchCrossRefData(
  studentId: string,
  tenantId: string,
): Promise<CrossRefSourceData> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const [storylineLinksResult, readingLinksResult, readingsResult, seteksResult, changcheResult, haengteukResult] =
      await Promise.all([
        // storyline_links (through storylines)
        (async () => {
          const { data: storylines } = await supabase
            .from("student_record_storylines")
            .select("id")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          if (!storylines || storylines.length === 0) return [];
          const { data } = await supabase
            .from("student_record_storyline_links")
            .select("*")
            .in("storyline_id", storylines.map((s) => s.id))
            .order("grade")
            .order("sort_order");
          return data ?? [];
        })(),
        // reading_links
        (async () => {
          const { data: readings } = await supabase
            .from("student_record_reading")
            .select("id")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          if (!readings || readings.length === 0) return [];
          const { data } = await supabase
            .from("student_record_reading_links")
            .select("*")
            .in("reading_id", readings.map((r) => r.id));
          return data ?? [];
        })(),
        // reading labels
        supabase
          .from("student_record_reading")
          .select("id, book_title")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
        // setek labels + content
        supabase
          .from("student_record_seteks")
          .select("id, grade, content, subject:subject_id(name)")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .returns<Array<{ id: string; grade: number; content: string | null; subject: { name: string } | null }>>(),
        // changche labels + content
        supabase
          .from("student_record_changche")
          .select("id, grade, activity_type, content")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
        // haengteuk content
        supabase
          .from("student_record_haengteuk")
          .select("id, grade, content")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId),
      ]);

    // Build reading label map
    const readingLabelMap: Record<string, string> = {};
    for (const r of readingsResult.data ?? []) {
      readingLabelMap[r.id] = r.book_title ?? "독서";
    }

    // Build record label map
    const changcheTypeLabels: Record<string, string> = {
      autonomy: "자율활동", club: "동아리활동", career: "진로활동",
    };
    const recordLabelMap: Record<string, string> = {};
    for (const s of seteksResult.data ?? []) {
      recordLabelMap[s.id] = `${s.grade}학년 ${s.subject?.name ?? "과목"} 세특`;
    }
    for (const c of changcheResult.data ?? []) {
      recordLabelMap[c.id] = `${c.grade}학년 ${changcheTypeLabels[c.activity_type] ?? c.activity_type}`;
    }
    for (const r of readingsResult.data ?? []) {
      recordLabelMap[r.id] = r.book_title ?? "독서";
    }
    for (const h of haengteukResult.data ?? []) {
      recordLabelMap[h.id] = `${h.grade}학년 행동특성`;
    }

    // Build record content map
    const recordContentMap: Record<string, string> = {};
    for (const s of seteksResult.data ?? []) {
      if (s.content) recordContentMap[s.id] = s.content as string;
    }
    for (const c of changcheResult.data ?? []) {
      if (c.content) recordContentMap[c.id] = c.content as string;
    }
    for (const h of haengteukResult.data ?? []) {
      if (h.content) recordContentMap[h.id] = h.content as string;
    }

    // S4: DB에서 직접 grade/recordType 맵 구성
    const recordGradeMap: Record<string, number> = {};
    const recordTypeMap: Record<string, string> = {};
    for (const s of seteksResult.data ?? []) {
      recordGradeMap[s.id] = s.grade;
      recordTypeMap[s.id] = "setek";
    }
    for (const c of changcheResult.data ?? []) {
      recordGradeMap[c.id] = c.grade;
      recordTypeMap[c.id] = "changche";
    }
    for (const h of haengteukResult.data ?? []) {
      recordGradeMap[h.id] = h.grade;
      recordTypeMap[h.id] = "haengteuk";
    }

    return {
      storylineLinks: storylineLinksResult as import("../types").StorylineLink[],
      readingLinks: readingLinksResult as import("../types").ReadingLink[],
      readingLabelMap,
      recordLabelMap,
      recordContentMap,
      recordGradeMap,
      recordTypeMap,
    };
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId });
    return { storylineLinks: [], readingLinks: [], readingLabelMap: {}, recordLabelMap: {}, recordContentMap: {} };
  }
}
