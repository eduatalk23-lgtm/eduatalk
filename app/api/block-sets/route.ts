import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { fetchBlockSetsWithBlocks, type BlockSetWithBlocks } from "@/lib/data/blockSets";

export const dynamic = "force-dynamic";

/**
 * 블록 세트 조회 API
 * GET /api/block-sets
 *
 * @returns
 * 성공: { success: true, data: BlockSetWithBlocks[] }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return apiUnauthorized();
    }

    const data = await fetchBlockSetsWithBlocks(user.userId);

    return apiSuccess<BlockSetWithBlocks[]>(data);
  } catch (error) {
    return handleApiError(error, "[api/block-sets] 오류");
  }
}

