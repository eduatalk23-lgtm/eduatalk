"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createMasterCustomContent,
  updateMasterCustomContent,
  deleteMasterCustomContent,
} from "@/lib/data/contentMasters";
import {
  parseMasterCustomContentFormData,
  parseMasterCustomContentUpdateFormData,
} from "@/lib/utils/masterContentFormHelpers";

/**
 * 서비스 마스터 커스텀 콘텐츠 생성
 */
export const addMasterCustomContent = withErrorHandling(
  async (formData: FormData) => {
    await requireAdminOrConsultant();
    
    const tenantContext = await getTenantContext();
    const contentData = parseMasterCustomContentFormData(
      formData,
      tenantContext?.tenantId || null
    );

    if (!contentData.title) {
      throw new AppError(
        "제목은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    await createMasterCustomContent(contentData);
    redirect("/admin/master-custom-contents");
  }
);

/**
 * 서비스 마스터 커스텀 콘텐츠 수정
 */
export const updateMasterCustomContentAction = withErrorHandling(
  async (id: string, formData: FormData) => {
    await requireAdminOrConsultant();
    
    const updates = parseMasterCustomContentUpdateFormData(formData);

    if (!updates.title) {
      throw new AppError(
        "제목은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    await updateMasterCustomContent(id, updates);

    revalidatePath("/admin/master-custom-contents");
    revalidatePath(`/admin/master-custom-contents/${id}`);
    redirect(`/admin/master-custom-contents/${id}`);
  }
);

/**
 * 서비스 마스터 커스텀 콘텐츠 삭제
 */
export const deleteMasterCustomContentAction = withErrorHandling(
  async (id: string) => {
    await requireAdminOrConsultant();
    
    await deleteMasterCustomContent(id);

    revalidatePath("/admin/master-custom-contents");
    redirect("/admin/master-custom-contents");
  }
);

