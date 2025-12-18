"use client";

import {
  getStudentDivisionsAction,
  createStudentDivisionAction,
  updateStudentDivisionAction,
  deleteStudentDivisionAction,
} from "@/app/actions/studentDivisionsActions";
import type { StudentDivisionItem } from "@/lib/data/studentDivisions";
import { BaseMetadataManager } from "@/app/(admin)/admin/content-metadata/_components/BaseMetadataManager";

export function StudentDivisionsManager() {
  return (
    <BaseMetadataManager<StudentDivisionItem>
      title="학생 구분 항목 관리"
      fetchAction={getStudentDivisionsAction}
      createAction={createStudentDivisionAction}
      updateAction={updateStudentDivisionAction}
      deleteAction={deleteStudentDivisionAction}
      namePlaceholder="예: 고등부, 중등부, 기타"
    />
  );
}

