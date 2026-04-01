// ============================================
// ParsedData → DB Insert 엔티티 변환
// RecordImportData를 각 테이블의 Insert 타입으로 매핑
// ============================================

import type {
  RecordSetekInsert,
  RecordChangcheInsert,
  RecordHaengteukInsert,
  RecordReadingInsert,
  RecordAttendanceInsert,
  RecordAwardInsert,
  RecordVolunteerInsert,
  ChangcheActivityType,
} from "../types";
import type { RecordImportData } from "./types";

interface MapperContext {
  studentId: string;
  tenantId: string;
  subjectIdMap: Map<string, string | null>; // parsedName → subjectId
}

// ============================================
// 학년 문자열 → 숫자
// ============================================

function gradeToNumber(gradeStr: string): number {
  const match = gradeStr.match(/(\d)/);
  return match ? parseInt(match[1], 10) : 1;
}

/** 학년 → school_year (enrollmentYear=입학년도 기준) */
function gradeToSchoolYear(gradeStr: string, enrollmentYear: number): number {
  const gradeNum = gradeToNumber(gradeStr);
  return enrollmentYear + gradeNum - 1;
}

// ============================================
// 세특 (세부능력 및 특기사항)
// DB 컬럼: grade(number), school_year, semester, subject_id, content, status
// ============================================

export interface MappedSeteks {
  items: RecordSetekInsert[];
  skipped: { subject: string; reason: string }[];
}

export function mapSeteks(
  parsed: RecordImportData,
  ctx: MapperContext,
): MappedSeteks {
  const items: RecordSetekInsert[] = [];
  const skipped: { subject: string; reason: string }[] = [];

  for (const comp of parsed.detailedCompetencies) {
    const subjectId = ctx.subjectIdMap.get(comp.subject);

    if (!subjectId) {
      skipped.push({ subject: comp.subject, reason: "과목 미매칭" });
      continue;
    }

    const grade = gradeToNumber(comp.grade);
    const semester = comp.semester.includes("1") ? 1 : 2;
    const schoolYear = gradeToSchoolYear(comp.grade, parsed.studentInfo.schoolYear);

    items.push({
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      semester,
      subject_id: subjectId,
      imported_content: comp.content,
      imported_at: new Date().toISOString(),
      // B5: NEIS import → 최종본 단계
      status: "final" as const,
    });
  }

  return { items, skipped };
}

// ============================================
// 창체 (창의적 체험활동)
// DB 컬럼: grade(number), school_year, activity_type, content, status
// ============================================

const CATEGORY_MAP: Record<string, ChangcheActivityType> = {
  "자율활동": "autonomy",
  "동아리활동": "club",
  "진로활동": "career",
};

export function mapChangche(
  parsed: RecordImportData,
  ctx: MapperContext,
): RecordChangcheInsert[] {
  const items: RecordChangcheInsert[] = [];

  for (const act of parsed.creativeActivities) {
    const activityType = CATEGORY_MAP[act.category];
    if (!activityType) continue;

    const grade = gradeToNumber(act.grade);
    const schoolYear = gradeToSchoolYear(act.grade, parsed.studentInfo.schoolYear);

    items.push({
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      activity_type: activityType,
      hours: act.hours || null,
      imported_content: act.content,
      imported_at: new Date().toISOString(),
      // B5: NEIS import → 최종본 단계
      status: "final" as const,
    });
  }

  return items;
}

// ============================================
// 행특 (행동특성 및 종합의견)
// DB 컬럼: grade(number), school_year, content, status
// ============================================

export function mapHaengteuk(
  parsed: RecordImportData,
  ctx: MapperContext,
): RecordHaengteukInsert[] {
  return parsed.behavioralCharacteristics.map((beh) => {
    const grade = gradeToNumber(beh.grade);
    const schoolYear = gradeToSchoolYear(beh.grade, parsed.studentInfo.schoolYear);

    return {
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      imported_content: beh.content,
      imported_at: new Date().toISOString(),
      // B5: NEIS import → 최종본 단계
      status: "final" as const,
    };
  });
}

// ============================================
// 독서활동
// DB 컬럼: grade(number), school_year, book_title, author, subject_area(required)
// ============================================

export function mapReadings(
  parsed: RecordImportData,
  ctx: MapperContext,
): RecordReadingInsert[] {
  return parsed.readingActivities.map((read) => {
    const grade = gradeToNumber(read.grade);
    const schoolYear = gradeToSchoolYear(read.grade, parsed.studentInfo.schoolYear);

    return {
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      book_title: read.bookTitle,
      author: read.author || null,
      subject_area: read.subjectArea || "공통",
    };
  });
}

// ============================================
// 출결
// DB 컬럼: grade(number), school_year
// 결석: absence_sick, absence_unauthorized, absence_other
// 지각: lateness_sick, lateness_unauthorized, lateness_other
// 조퇴: early_leave_sick, early_leave_unauthorized, early_leave_other
// 결과: class_absence_sick, class_absence_unauthorized, class_absence_other
// ============================================

export function mapAttendance(
  parsed: RecordImportData,
  ctx: MapperContext,
): RecordAttendanceInsert[] {
  // 학반정보 lookup: grade → classInfo
  const classInfoMap = new Map<number, (typeof parsed.classInfo)[0]>();
  for (const ci of parsed.classInfo) {
    classInfoMap.set(gradeToNumber(ci.grade), ci);
  }

  return parsed.attendance.map((att) => {
    const grade = gradeToNumber(att.grade);
    const schoolYear = gradeToSchoolYear(att.grade, parsed.studentInfo.schoolYear);
    const ci = classInfoMap.get(grade);

    return {
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      absence_sick: att.sickAbsence,
      absence_unauthorized: att.unauthorizedAbsence,
      absence_other: att.authorizedAbsence,
      lateness_sick: att.lateness,
      lateness_unauthorized: 0,
      lateness_other: 0,
      early_leave_sick: att.earlyLeave,
      early_leave_unauthorized: 0,
      early_leave_other: 0,
      class_absence_sick: att.classAbsence,
      class_absence_unauthorized: 0,
      class_absence_other: 0,
      // 학반정보 병합
      homeroom_teacher: ci?.homeroomTeacher ?? null,
      class_name: ci?.className ?? null,
      student_number: ci?.studentNumber ?? null,
    };
  });
}

// ============================================
// 수상경력
// ============================================

export function mapAwards(
  parsed: RecordImportData,
  ctx: MapperContext,
): RecordAwardInsert[] {
  return parsed.awards.map((award) => {
    const grade = gradeToNumber(award.grade);
    const schoolYear = gradeToSchoolYear(award.grade, parsed.studentInfo.schoolYear);
    return {
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      award_name: award.awardName,
      award_date: award.awardDate.replace(/\./g, "-").replace(/-$/, "") || null,
      awarding_body: award.awardOrg || null,
      participants: award.participants || null,
    };
  });
}

// ============================================
// 봉사활동
// ============================================

export function mapVolunteer(
  parsed: RecordImportData,
  ctx: MapperContext,
): RecordVolunteerInsert[] {
  return parsed.volunteerActivities.map((vol) => {
    const grade = gradeToNumber(vol.grade);
    const schoolYear = gradeToSchoolYear(vol.grade, parsed.studentInfo.schoolYear);
    return {
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      school_year: schoolYear,
      activity_date: vol.activityDate || null,
      location: vol.location || null,
      description: vol.content || null,
      hours: vol.hours,
      cumulative_hours: vol.cumulativeHours || null,
    };
  });
}

// ============================================
// 성적 (교과학습발달상황)
// DB: student_internal_scores
// 필수 FK: curriculum_revision_id, subject_group_id, subject_type_id, subject_id
// ============================================

export interface MappedGradeItem {
  student_id: string;
  tenant_id: string;
  grade: number;
  semester: number;
  credit_hours: number;
  raw_score: number | null;
  avg_score: number | null;
  std_dev: number | null;
  achievement_level: string | null;
  total_students: number | null;
  rank_grade: number | null;
  achievement_ratio_a: number | null;
  achievement_ratio_b: number | null;
  achievement_ratio_c: number | null;
  achievement_ratio_d: number | null;
  achievement_ratio_e: number | null;
  subject_id: string;
  subject_group_id: string;
  subject_type_id: string;
  curriculum_revision_id: string;
}

export interface MappedGrades {
  items: MappedGradeItem[];
  skipped: { subject: string; reason: string }[];
}

/** 성적 매핑에 필요한 과목 상세 정보 */
export interface SubjectDetail {
  id: string;
  name: string;
  subject_group_id: string;
  subject_type_id: string | null;
}

export interface GradeMapperContext extends MapperContext {
  /** subject_id → 과목 상세 정보 */
  subjectDetailMap: Map<string, SubjectDetail>;
  /** 기본 curriculum_revision_id (2022 개정 등) */
  curriculumRevisionId: string;
  /** 기본 subject_type_id (subject_type_id가 null인 과목용) */
  defaultSubjectTypeId: string;
  /** 교육과정 연도 (2015 또는 2022) — grade_system 자동 설정용 */
  curriculumYear?: number;
}

export function mapGrades(
  parsed: RecordImportData,
  ctx: GradeMapperContext,
): MappedGrades {
  const items: MappedGradeItem[] = [];
  const skipped: { subject: string; reason: string }[] = [];

  for (const g of parsed.grades) {
    const subjectId = ctx.subjectIdMap.get(g.subject);

    if (!subjectId) {
      skipped.push({ subject: g.subject, reason: "과목 미매칭" });
      continue;
    }

    const detail = ctx.subjectDetailMap.get(subjectId);
    if (!detail) {
      skipped.push({ subject: g.subject, reason: "과목 상세 정보 없음" });
      continue;
    }

    const grade = gradeToNumber(g.grade);
    const semester = g.semester.includes("1") ? 1 : 2;

    items.push({
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      grade,
      semester,
      credit_hours: g.creditHours,
      raw_score: g.rawScore || null,
      avg_score: g.classAverage || null,
      std_dev: g.standardDeviation || null,
      achievement_level: g.achievementLevel || null,
      total_students: g.totalStudents || null,
      rank_grade: g.rankGrade || null,
      achievement_ratio_a: g.achievementRatioA ?? null,
      achievement_ratio_b: g.achievementRatioB ?? null,
      achievement_ratio_c: g.achievementRatioC ?? null,
      achievement_ratio_d: g.achievementRatioD ?? null,
      achievement_ratio_e: g.achievementRatioE ?? null,
      subject_id: subjectId,
      subject_group_id: detail.subject_group_id,
      subject_type_id: detail.subject_type_id ?? ctx.defaultSubjectTypeId,
      curriculum_revision_id: ctx.curriculumRevisionId,
      grade_system: (ctx.curriculumYear ?? 2015) >= 2022 ? 5 : 9,
    });
  }

  return { items, skipped };
}

// ============================================
// 전체 매핑 결과
// ============================================

export interface MappedRecordData {
  seteks: MappedSeteks;
  changche: RecordChangcheInsert[];
  haengteuk: RecordHaengteukInsert[];
  readings: RecordReadingInsert[];
  attendance: RecordAttendanceInsert[];
  grades: MappedGrades;
  awards: RecordAwardInsert[];
  volunteer: RecordVolunteerInsert[];
}

export function mapAllRecords(
  parsed: RecordImportData,
  ctx: MapperContext,
  gradeCtx?: GradeMapperContext,
): MappedRecordData {
  return {
    seteks: mapSeteks(parsed, ctx),
    changche: mapChangche(parsed, ctx),
    haengteuk: mapHaengteuk(parsed, ctx),
    readings: mapReadings(parsed, ctx),
    attendance: mapAttendance(parsed, ctx),
    grades: gradeCtx
      ? mapGrades(parsed, gradeCtx)
      : { items: [], skipped: [] },
    awards: mapAwards(parsed, ctx),
    volunteer: mapVolunteer(parsed, ctx),
  };
}
