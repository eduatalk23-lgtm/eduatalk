// ============================================
// ExemplarParsedData → DB 저장 (Supabase Admin Client)
// 서버 전용 — scripts 또는 Server Action에서 호출
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  ExemplarParsedData,
  ExemplarImportFileResult,
  SourceFileFormat,
} from "../types";
import { generateAnonymousId } from "./metadata-extractor";

/**
 * 파싱된 생기부 데이터를 DB에 저장
 * Admin Client 사용 (RLS 바이패스)
 */
export async function importExemplarToDb(
  data: ExemplarParsedData,
  tenantId: string,
  options?: { overwriteExisting?: boolean }
): Promise<ExemplarImportFileResult> {
  const supabase = createSupabaseAdminClient();

  const counts: ExemplarImportFileResult["counts"] = {
    admissions: 0,
    enrollment: 0,
    attendance: 0,
    awards: 0,
    certifications: 0,
    careerAspirations: 0,
    creativeActivities: 0,
    volunteerRecords: 0,
    grades: 0,
    seteks: 0,
    peArtGrades: 0,
    reading: 0,
    haengteuk: 0,
  };

  try {
    const { name, schoolName, enrollmentYear } = data.studentInfo;
    const anonymousId = generateAnonymousId(name, schoolName, enrollmentYear);

    // 1. 기존 레코드 확인
    const { data: existing } = await supabase
      .from("exemplar_records")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("anonymous_id", anonymousId)
      .eq("enrollment_year", enrollmentYear)
      .maybeSingle();

    let exemplarId: string;

    if (existing) {
      if (!options?.overwriteExisting) {
        return {
          filePath: data.metadata.sourceFilePath,
          success: false,
          error: `이미 존재하는 레코드 (anonymous_id: ${anonymousId.slice(0, 8)}...)`,
          counts,
        };
      }
      // 기존 레코드 삭제 (CASCADE로 child 일괄 삭제)
      await supabase.from("exemplar_records").delete().eq("id", existing.id);
    }

    // 2. Root 레코드 생성
    const { data: record, error: recordError } = await supabase
      .from("exemplar_records")
      .insert({
        tenant_id: tenantId,
        anonymous_id: anonymousId,
        school_name: schoolName,
        school_category: data.studentInfo.schoolCategory ?? null,
        enrollment_year: enrollmentYear,
        graduation_year: data.studentInfo.graduationYear ?? null,
        curriculum_revision: data.studentInfo.curriculumRevision ?? "2015",
        source_file_path: data.metadata.sourceFilePath,
        source_file_format: data.metadata.sourceFileFormat as SourceFileFormat,
        parse_quality_score: data.metadata.parseQualityScore,
        parse_errors: data.metadata.parseErrors,
        raw_content: null, // 별도 패스에서 채움
        raw_content_by_page: data.rawContentByPage ?? null,
        parsed_at: new Date().toISOString(),
        parsed_by: data.metadata.parsedBy,
      })
      .select("id")
      .single();

    if (recordError || !record) {
      throw new Error(`exemplar_records insert 실패: ${recordError?.message}`);
    }

    exemplarId = record.id;

    // 3. Child 테이블들 일괄 삽입 (병렬)
    const insertPromises: Promise<void>[] = [];

    // admissions
    if (data.admissions?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_admissions", data.admissions.map((a) => ({
          exemplar_id: exemplarId,
          university_name: a.universityName,
          department: a.department ?? null,
          admission_type: a.admissionType ?? null,
          admission_round: a.admissionRound ?? null,
          admission_year: a.admissionYear,
          is_primary: a.isPrimary ?? false,
        }))).then(() => { counts.admissions = data.admissions.length; })
      );
    }

    // enrollment
    if (data.enrollment?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_enrollment", data.enrollment.map((e) => ({
          exemplar_id: exemplarId,
          grade: e.grade,
          class_name: e.className ?? null,
          student_number: e.studentNumber ?? null,
          homeroom_teacher: e.homeroomTeacher ?? null,
          enrollment_status: e.enrollmentStatus ?? null,
          enrollment_date: e.enrollmentDate ?? null,
        }))).then(() => { counts.enrollment = data.enrollment.length; })
      );
    }

    // attendance
    if (data.attendance?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_attendance", data.attendance.map((a) => ({
          exemplar_id: exemplarId,
          grade: a.grade,
          school_days: a.schoolDays ?? null,
          absence_sick: a.absenceSick ?? 0,
          absence_unauthorized: a.absenceUnauthorized ?? 0,
          absence_other: a.absenceOther ?? 0,
          lateness_sick: a.latenessSick ?? 0,
          lateness_unauthorized: a.latenessUnauthorized ?? 0,
          lateness_other: a.latenessOther ?? 0,
          early_leave_sick: a.earlyLeaveSick ?? 0,
          early_leave_unauthorized: a.earlyLeaveUnauthorized ?? 0,
          early_leave_other: a.earlyLeaveOther ?? 0,
          class_absence_sick: a.classAbsenceSick ?? 0,
          class_absence_unauthorized: a.classAbsenceUnauthorized ?? 0,
          class_absence_other: a.classAbsenceOther ?? 0,
          notes: a.notes ?? null,
        }))).then(() => { counts.attendance = data.attendance.length; })
      );
    }

    // awards
    if (data.awards?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_awards", data.awards.map((a) => ({
          exemplar_id: exemplarId,
          grade: a.grade,
          award_name: a.awardName,
          award_level: a.awardLevel ?? null,
          award_date: a.awardDate ?? null,
          awarding_body: a.awardingBody ?? null,
          participants: a.participants ?? null,
        }))).then(() => { counts.awards = data.awards.length; })
      );
    }

    // certifications
    if (data.certifications?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_certifications", data.certifications.map((c) => ({
          exemplar_id: exemplarId,
          cert_name: c.certName,
          cert_level: c.certLevel ?? null,
          cert_number: c.certNumber ?? null,
          issuing_org: c.issuingOrg ?? null,
          cert_date: c.certDate ?? null,
        }))).then(() => { counts.certifications = data.certifications.length; })
      );
    }

    // careerAspirations
    if (data.careerAspirations?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_career_aspirations", data.careerAspirations.map((c) => ({
          exemplar_id: exemplarId,
          grade: c.grade,
          student_aspiration: c.studentAspiration ?? null,
          parent_aspiration: c.parentAspiration ?? null,
          reason: c.reason ?? null,
          special_skills_hobbies: c.specialSkillsHobbies ?? null,
        }))).then(() => { counts.careerAspirations = data.careerAspirations.length; })
      );
    }

    // creativeActivities
    if (data.creativeActivities?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_creative_activities", data.creativeActivities.map((c) => ({
          exemplar_id: exemplarId,
          grade: c.grade,
          activity_type: c.activityType,
          activity_name: c.activityName ?? null,
          hours: c.hours ?? null,
          content: c.content ?? "",
        }))).then(() => { counts.creativeActivities = data.creativeActivities.length; })
      );
    }

    // volunteerRecords
    if (data.volunteerRecords?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_volunteer_records", data.volunteerRecords.map((v) => ({
          exemplar_id: exemplarId,
          grade: v.grade,
          activity_date: v.activityDate ?? null,
          location: v.location ?? null,
          description: v.description ?? null,
          hours: v.hours ?? null,
          cumulative_hours: v.cumulativeHours ?? null,
        }))).then(() => { counts.volunteerRecords = data.volunteerRecords.length; })
      );
    }

    // grades
    if (data.grades?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_grades", data.grades.map((g) => ({
          exemplar_id: exemplarId,
          grade: g.grade,
          semester: g.semester,
          subject_name: g.subjectName,
          subject_type: g.subjectType ?? null,
          credit_hours: g.creditHours ?? null,
          raw_score: g.rawScore ?? null,
          class_average: g.classAverage ?? null,
          std_dev: g.stdDev ?? null,
          rank_grade: g.rankGrade ?? null,
          achievement_level: g.achievementLevel ?? null,
          total_students: g.totalStudents ?? null,
          class_rank: g.classRank ?? null,
          achievement_ratio: g.achievementRatio ?? null,
        }))).then(() => { counts.grades = data.grades.length; })
      );
    }

    // seteks
    if (data.seteks?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_seteks", data.seteks.map((s) => ({
          exemplar_id: exemplarId,
          grade: s.grade,
          semester: s.semester,
          subject_name: s.subjectName,
          content: s.content ?? "",
        }))).then(() => { counts.seteks = data.seteks.length; })
      );
    }

    // peArtGrades (중복 제거: grade+semester+subject_name 기준)
    if (data.peArtGrades?.length > 0) {
      const dedupedPeArt = deduplicateByKey(data.peArtGrades, (p) => `${p.grade}-${p.semester}-${p.subjectName}`);
      insertPromises.push(
        insertBatch(supabase, "exemplar_pe_art_grades", dedupedPeArt.map((p) => ({
          exemplar_id: exemplarId,
          grade: p.grade,
          semester: p.semester,
          subject_name: p.subjectName,
          credit_hours: p.creditHours ?? null,
          achievement_level: p.achievementLevel ?? null,
          content: p.content ?? null,
        }))).then(() => { counts.peArtGrades = data.peArtGrades.length; })
      );
    }

    // reading
    if (data.reading?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_reading", data.reading.map((r) => ({
          exemplar_id: exemplarId,
          grade: r.grade,
          subject_area: r.subjectArea,
          book_description: r.bookDescription,
          book_title: r.bookTitle ?? null,
          author: r.author ?? null,
        }))).then(() => { counts.reading = data.reading.length; })
      );
    }

    // haengteuk
    if (data.haengteuk?.length > 0) {
      insertPromises.push(
        insertBatch(supabase, "exemplar_haengteuk", data.haengteuk.map((h) => ({
          exemplar_id: exemplarId,
          grade: h.grade,
          content: h.content ?? "",
        }))).then(() => { counts.haengteuk = data.haengteuk.length; })
      );
    }

    await Promise.all(insertPromises);

    return {
      filePath: data.metadata.sourceFilePath,
      success: true,
      exemplarId,
      parseQualityScore: data.metadata.parseQualityScore,
      counts,
    };
  } catch (error) {
    logActionError({ domain: "exemplar", action: "importExemplarToDb" }, error, { filePath: data.metadata.sourceFilePath });
    return {
      filePath: data.metadata.sourceFilePath,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      counts,
    };
  }
}

/**
 * 키 기준 중복 제거 (첫 번째 항목 유지, content가 더 긴 항목 우선)
 */
function deduplicateByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      // content가 있는 항목 우선
      const existingContent = (existing as Record<string, unknown>).content as string | undefined;
      const itemContent = (item as Record<string, unknown>).content as string | undefined;
      if (itemContent && (!existingContent || itemContent.length > existingContent.length)) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * 배치 Insert 헬퍼 (Supabase 제한: 한 번에 1000행)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertBatch(supabase: any, table: string, rows: any[]): Promise<void> {
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`${table} insert 실패 (batch ${i}): ${error.message}`);
    }
  }
}
