import { getPublishersForFilter } from "@/lib/data/contentMasters";
import {
  apiSuccess,
  handleApiError,
  withCache,
  CACHE_STATIC,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publishers = await getPublishersForFilter();

    return withCache(apiSuccess(publishers), CACHE_STATIC);
  } catch (error) {
    return handleApiError(error, "[api/publishers]");
  }
}

