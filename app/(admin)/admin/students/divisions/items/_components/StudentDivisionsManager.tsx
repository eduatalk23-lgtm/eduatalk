"use client";

import {
  getStudentDivisionsAction,
  createStudentDivisionAction,
  updateStudentDivisionAction,
  deleteStudentDivisionAction,
} from "@/app/actions/studentDivisionsActions";
import type { StudentDivisionItem } from "@/lib/data/studentDivisions";
import { BaseMetadataManager } from "@/app/(admin)/admin/content-metadata/_components/BaseMetadataManager";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

export function StudentDivisionsManager() {
  return (
    <BaseMetadataManager<StudentDivisionItem>
      title="학생 구분 항목 관리"
      fetchAction={async () => {
        const result = await getStudentDivisionsAction();
        if (isSuccessResponse(result) && result.data) {
          return result.data;
        }
        const errorMessage = isErrorResponse(result) ? (result.error || result.message) : "학생 구분 목록을 불러오는데 실패했습니다.";
        throw new Error(errorMessage);
      }}
      createAction={async (name: string, displayOrder: number) => {
        const result = await createStudentDivisionAction(name, displayOrder);
        if (isSuccessResponse(result) && result.data) {
          return result.data;
        }
        const errorMessage = isErrorResponse(result) ? (result.error || result.message) : "학생 구분 항목 생성에 실패했습니다.";
        throw new Error(errorMessage);
      }}
      updateAction={async (id: string, data: Partial<StudentDivisionItem>) => {
        const result = await updateStudentDivisionAction(id, data);
        if (isSuccessResponse(result) && result.data) {
          return result.data;
        }
        const errorMessage = isErrorResponse(result) ? (result.error || result.message) : "학생 구분 항목 수정에 실패했습니다.";
        throw new Error(errorMessage);
      }}
      deleteAction={async (id: string) => {
        const result = await deleteStudentDivisionAction(id);
        if (!isSuccessResponse(result)) {
          const errorMessage = isErrorResponse(result) ? (result.error || result.message) : "학생 구분 항목 삭제에 실패했습니다.";
          throw new Error(errorMessage);
        }
      }}
      namePlaceholder="예: 고등부, 중등부, 기타"
    />
  );
}

