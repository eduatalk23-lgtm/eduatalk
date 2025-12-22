"use client";

import {
  getAllCareerFieldsAction,
  createCareerFieldAction,
  updateCareerFieldAction,
  deleteCareerFieldAction,
} from "@/lib/domains/content-metadata";
import type { CareerField } from "@/lib/data/careerFields";
import { BaseMetadataManager } from "./BaseMetadataManager";

// CareerField의 createAction은 { success, id } 형태를 반환하므로 래퍼 필요
async function createCareerFieldWrapper(
  name: string,
  displayOrder: number
): Promise<CareerField> {
  const result = await createCareerFieldAction(name, displayOrder);
  if (!result.success || !result.id) {
    throw new Error(result.error || "생성에 실패했습니다.");
  }
  // 생성 후 전체 목록에서 새로 생성된 항목을 찾아 반환
  const allFields = await getAllCareerFieldsAction();
  const newField = allFields.find((f) => f.id === result.id);
  if (!newField) {
    throw new Error("생성된 항목을 찾을 수 없습니다.");
  }
  return newField;
}

// CareerField의 updateAction은 { success, error } 형태를 반환하므로 래퍼 필요
async function updateCareerFieldWrapper(
  id: string,
  data: Partial<CareerField>
): Promise<CareerField> {
  const result = await updateCareerFieldAction(id, data);
  if (!result.success) {
    throw new Error(result.error || "수정에 실패했습니다.");
  }
  // 수정 후 전체 목록에서 업데이트된 항목을 찾아 반환
  const allFields = await getAllCareerFieldsAction();
  const updatedField = allFields.find((f) => f.id === id);
  if (!updatedField) {
    throw new Error("수정된 항목을 찾을 수 없습니다.");
  }
  return updatedField;
}

// CareerField의 deleteAction은 { success, error } 형태를 반환하므로 래퍼 필요
async function deleteCareerFieldWrapper(id: string): Promise<void> {
  const result = await deleteCareerFieldAction(id);
  if (!result.success) {
    throw new Error(result.error || "삭제에 실패했습니다.");
  }
}

export function CareerFieldsManager() {
  return (
    <BaseMetadataManager<CareerField>
      title="진로 계열 관리"
      fetchAction={getAllCareerFieldsAction}
      createAction={createCareerFieldWrapper}
      updateAction={updateCareerFieldWrapper}
      deleteAction={deleteCareerFieldWrapper}
      namePlaceholder="예: 인문계열"
      getInitialDisplayOrder={(items) => {
        return items.length > 0
          ? Math.max(...items.map((f) => f.display_order)) + 1
          : 0;
      }}
    />
  );
}
