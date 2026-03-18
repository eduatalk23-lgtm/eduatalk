// ============================================
// Import 오케스트레이션 — 매핑된 데이터 → DB upsert
// 기존 repository 함수 재사용
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as repo from "../repository";
import type { MappedRecordData } from "./mapper";
import type { ImportResult } from "./types";

interface ImportOptions {
  overwriteExisting: boolean;
}

/** 매핑된 레코드 데이터를 DB에 일괄 저장 */
export async function executeImport(
  mapped: MappedRecordData,
  options: ImportOptions,
): Promise<ImportResult> {
  const counts = { seteks: 0, changche: 0, haengteuk: 0, readings: 0, attendance: 0, grades: 0 };
  const skipped: ImportResult["skipped"] = [];

  // 미매칭 과목 스킵 기록 (세특)
  if (mapped.seteks.skipped.length > 0) {
    skipped.push({
      reason: "세특 과목 미매칭으로 건너뜀",
      items: mapped.seteks.skipped.map((s) => s.subject),
    });
  }

  // 미매칭 과목 스킵 기록 (성적)
  if (mapped.grades.skipped.length > 0) {
    skipped.push({
      reason: "성적 과목 미매칭으로 건너뜀",
      items: mapped.grades.skipped.map((s) => s.subject),
    });
  }

  try {
    // 세특 upsert (기존 데이터 있으면 덮어쓰기)
    for (const setek of mapped.seteks.items) {
      await repo.upsertSetek(setek);
      counts.seteks++;
    }

    // 창체 upsert
    for (const changche of mapped.changche) {
      await repo.upsertChangche(changche);
      counts.changche++;
    }

    // 행특 upsert
    for (const haengteuk of mapped.haengteuk) {
      await repo.upsertHaengteuk(haengteuk);
      counts.haengteuk++;
    }

    // 독서 insert (중복 체크: 같은 학년+제목이면 스킵)
    for (const reading of mapped.readings) {
      if (!options.overwriteExisting) {
        const existing = await repo.findReadingsByStudentYear(
          reading.student_id,
          reading.school_year,
          reading.tenant_id,
        );
        const isDuplicate = existing.some(
          (r) => r.book_title === reading.book_title && r.grade === reading.grade,
        );
        if (isDuplicate) {
          continue; // 중복 건너뜀
        }
      }
      await repo.insertReading(reading);
      counts.readings++;
    }

    // 출결 upsert
    for (const attendance of mapped.attendance) {
      await repo.upsertAttendance(attendance);
      counts.attendance++;
    }

    // 성적 upsert (student_internal_scores)
    if (mapped.grades.items.length > 0) {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        for (const g of mapped.grades.items) {
          // upsert: 같은 학생+학년+학기+과목이면 업데이트
          const { error } = await supabase
            .from("student_internal_scores")
            .upsert(
              {
                student_id: g.student_id,
                tenant_id: g.tenant_id,
                grade: g.grade,
                semester: g.semester,
                credit_hours: g.credit_hours,
                raw_score: g.raw_score,
                avg_score: g.avg_score,
                std_dev: g.std_dev,
                achievement_level: g.achievement_level,
                total_students: g.total_students,
                rank_grade: g.rank_grade,
                subject_id: g.subject_id,
                subject_group_id: g.subject_group_id,
                subject_type_id: g.subject_type_id,
                curriculum_revision_id: g.curriculum_revision_id,
              },
              { onConflict: "student_id,grade,semester,subject_id", ignoreDuplicates: false },
            );

          if (error) {
            // unique constraint 없으면 insert로 fallback
            if (error.code === "42P10" || error.message.includes("unique")) {
              await supabase.from("student_internal_scores").insert({
                student_id: g.student_id,
                tenant_id: g.tenant_id,
                grade: g.grade,
                semester: g.semester,
                credit_hours: g.credit_hours,
                raw_score: g.raw_score,
                avg_score: g.avg_score,
                std_dev: g.std_dev,
                achievement_level: g.achievement_level,
                total_students: g.total_students,
                rank_grade: g.rank_grade,
                subject_id: g.subject_id,
                subject_group_id: g.subject_group_id,
                subject_type_id: g.subject_type_id,
                curriculum_revision_id: g.curriculum_revision_id,
              });
            } else {
              throw error;
            }
          }
          counts.grades++;
        }
      }
    }

    return { success: true, counts, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { success: false, error: message, counts, skipped };
  }
}
