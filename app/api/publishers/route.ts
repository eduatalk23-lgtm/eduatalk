import { getPublishersForFilter } from "@/lib/data/contentMasters";
import {
  apiSuccess,
  handleApiError,
} from "@/lib/api";

export async function GET() {
  try {
    const publishers = await getPublishersForFilter();

    return apiSuccess(publishers);
  } catch (error) {
    return handleApiError(error, "[api/publishers]");
  }
}

