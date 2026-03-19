"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type { AdmissionSearchFilter, PaginationParams, AdmissionSearchResult } from "../types";
import { searchAdmissions, getUniversityInfoMap } from "../repository";

const LOG_CTX = { domain: "admission", action: "" };

/**
 * 졸업생 입시 DB 검색 Server Action.
 * 대학명/학과명 중 최소 1개 필수.
 * Phase 8.3: 검색 결과에 대학 공식 정보(universityInfoMap) 포함.
 */
export async function searchAdmissionsAction(
  filter: AdmissionSearchFilter,
  pagination: PaginationParams,
): Promise<ActionResponse<AdmissionSearchResult>> {
  try {
    await requireAdminOrConsultant();

    // 입력 검증: 대학명 or 학과명 최소 1개
    const hasUniv = filter.universityName && filter.universityName.trim().length > 0;
    const hasDept = filter.departmentName && filter.departmentName.trim().length > 0;
    if (!hasUniv && !hasDept) {
      return createErrorResponse("대학명 또는 학과명을 입력해주세요.");
    }

    // pageSize 상한
    const safePageSize = Math.min(Math.max(pagination.pageSize, 1), 50);
    const safePage = Math.max(pagination.page, 1);

    const result = await searchAdmissions(
      {
        ...filter,
        universityName: filter.universityName?.trim(),
        departmentName: filter.departmentName?.trim(),
      },
      { page: safePage, pageSize: safePageSize },
    );

    // Phase 8.3: 결과 내 대학명들의 공식 정보 조회
    if (result.rows.length > 0) {
      const uniqueNames = [...new Set(result.rows.map((r) => r.universityName))];
      result.universityInfoMap = await getUniversityInfoMap(uniqueNames);
    }

    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "searchAdmissionsAction" }, error);
    return createErrorResponse("입시 데이터 검색 중 오류가 발생했습니다.");
  }
}
