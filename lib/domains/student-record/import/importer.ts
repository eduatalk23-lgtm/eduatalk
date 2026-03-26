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

/** 덮어쓰기 시 학년도별 기존 데이터 삭제 */
async function deleteByStudentYear(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: "student_record_reading" | "student_record_awards" | "student_record_volunteer",
  studentId: string,
  schoolYear: number,
  tenantId: string,
) {
  if (!supabase) return;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId);
  if (error) throw error;
}

/** 매핑된 레코드 데이터를 DB에 일괄 저장 */
export async function executeImport(
  mapped: MappedRecordData,
  options: ImportOptions,
): Promise<ImportResult> {
  const counts = { seteks: 0, changche: 0, haengteuk: 0, readings: 0, attendance: 0, grades: 0, awards: 0, volunteer: 0 };
  const skipped: ImportResult["skipped"] = [];
  const supabaseAdmin = createSupabaseAdminClient();

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

    // 독서/수상/봉사: 덮어쓰기 시 기존 삭제 후 insert, 아니면 중복 체크
    // 학년별 삭제 대상 수집
    if (options.overwriteExisting) {
      const studentId = mapped.readings[0]?.student_id
        ?? mapped.awards[0]?.student_id
        ?? mapped.volunteer[0]?.student_id
        ?? mapped.attendance[0]?.student_id;
      const tenantId = mapped.readings[0]?.tenant_id
        ?? mapped.awards[0]?.tenant_id
        ?? mapped.volunteer[0]?.tenant_id
        ?? mapped.attendance[0]?.tenant_id;

      if (studentId && tenantId) {
        const years = new Set<number>();
        for (const r of mapped.readings) years.add(r.school_year);
        for (const a of mapped.awards) years.add(a.school_year);
        for (const v of mapped.volunteer) years.add(v.school_year);

        for (const sy of years) {
          await deleteByStudentYear(supabaseAdmin, "student_record_reading", studentId, sy, tenantId);
          await deleteByStudentYear(supabaseAdmin, "student_record_awards", studentId, sy, tenantId);
          await deleteByStudentYear(supabaseAdmin, "student_record_volunteer", studentId, sy, tenantId);
        }
      }
    }

    // 독서 insert
    for (const reading of mapped.readings) {
      if (!options.overwriteExisting) {
        const existing = await repo.findReadingsByStudentYear(
          reading.student_id, reading.school_year, reading.tenant_id,
        );
        if (existing.some((r) => r.book_title === reading.book_title && r.grade === reading.grade)) continue;
      }
      await repo.insertReading(reading);
      counts.readings++;
    }

    // 출결 upsert (학반정보 포함)
    for (const attendance of mapped.attendance) {
      await repo.upsertAttendance(attendance);
      counts.attendance++;
    }

    // 수상 insert (school_year별 조회 캐싱으로 N+1 방지)
    if (!options.overwriteExisting) {
      const awardCache = new Map<number, Awaited<ReturnType<typeof repo.findAwardsByStudentYear>>>();
      for (const award of mapped.awards) {
        if (!awardCache.has(award.school_year)) {
          awardCache.set(award.school_year, await repo.findAwardsByStudentYear(award.student_id, award.school_year, award.tenant_id));
        }
        if (awardCache.get(award.school_year)!.some((a) => a.award_name === award.award_name && a.grade === award.grade)) continue;
        await repo.insertAward(award);
        counts.awards++;
      }
    } else {
      for (const award of mapped.awards) {
        await repo.insertAward(award);
        counts.awards++;
      }
    }

    // 봉사 insert (school_year별 조회 캐싱으로 N+1 방지)
    if (!options.overwriteExisting) {
      const volCache = new Map<number, Awaited<ReturnType<typeof repo.findVolunteerByStudentYear>>>();
      for (const vol of mapped.volunteer) {
        if (!volCache.has(vol.school_year)) {
          volCache.set(vol.school_year, await repo.findVolunteerByStudentYear(vol.student_id, vol.school_year, vol.tenant_id));
        }
        if (volCache.get(vol.school_year)!.some((v) => v.activity_date === vol.activity_date && v.grade === vol.grade && v.hours === vol.hours)) continue;
        await repo.insertVolunteer(vol);
        counts.volunteer++;
      }
    } else {
      for (const vol of mapped.volunteer) {
        await repo.insertVolunteer(vol);
        counts.volunteer++;
      }
    }

    // 성적 upsert (student_internal_scores)
    if (mapped.grades.items.length > 0) {
      if (supabaseAdmin) {
        // 덮어쓰기 시 기존 성적 삭제
        if (options.overwriteExisting) {
          const sid = mapped.grades.items[0].student_id;
          const tid = mapped.grades.items[0].tenant_id;
          const gradeYears = new Set(mapped.grades.items.map((g) => `${g.grade}-${g.semester}`));
          for (const gy of gradeYears) {
            const [grade, semester] = gy.split("-").map(Number);
            await supabaseAdmin
              .from("student_internal_scores")
              .delete()
              .eq("student_id", sid)
              .eq("grade", grade)
              .eq("semester", semester);
          }
        }
        for (const g of mapped.grades.items) {
          const payload = {
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
            achievement_ratio_a: g.achievement_ratio_a,
            achievement_ratio_b: g.achievement_ratio_b,
            achievement_ratio_c: g.achievement_ratio_c,
            achievement_ratio_d: g.achievement_ratio_d,
            achievement_ratio_e: g.achievement_ratio_e,
            subject_id: g.subject_id,
            subject_group_id: g.subject_group_id,
            subject_type_id: g.subject_type_id,
            curriculum_revision_id: g.curriculum_revision_id,
          };

          const { error } = await supabaseAdmin
            .from("student_internal_scores")
            .upsert(payload, { onConflict: "student_id,grade,semester,subject_id", ignoreDuplicates: false });

          if (error) {
            if (error.code === "42P10" || error.message.includes("unique")) {
              await supabaseAdmin.from("student_internal_scores").insert(payload);
            } else {
              throw error;
            }
          }
          counts.grades++;
        }
      }
    }

    // Phase 2-1: 임포트 후 가이드 배정 재연결 (fire-and-forget)
    if (mapped.seteks.items.length > 0) {
      const sid = mapped.seteks.items[0].student_id;
      const tid = mapped.seteks.items[0].tenant_id;
      try {
        const { relinkAssignmentsAfterImport } = await import("@/lib/domains/guide/repository");
        await relinkAssignmentsAfterImport(sid, tid);
      } catch {
        // 가이드 재연결 실패해도 임포트 성공은 유지
      }
    }

    return { success: true, counts, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { success: false, error: message, counts, skipped };
  }
}
