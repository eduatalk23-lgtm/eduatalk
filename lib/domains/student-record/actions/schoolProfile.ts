// Re-export stub — 실제 구현은 lib/domains/school-profile/actions.ts로 이동됨
// 기존 import 경로 하위 호환을 위한 re-export
"use server";

export {
  autoCollectSchoolSubjects,
  autoCollectForSchool,
  fetchSchoolProfilesWithStats,
  fetchSchoolProfileDetail,
  upsertOfferedSubjectAction,
  removeOfferedSubjectAction,
  fetchSubjectOptionsAction,
} from "@/lib/domains/school-profile/actions";

export type {
  SchoolProfileListItem,
  SchoolProfileDetail,
  OfferedSubjectWithMeta,
  AutoCollectResult,
  UpsertOfferedSubjectInput,
  SubjectOption,
} from "@/lib/domains/school-profile/actions";
