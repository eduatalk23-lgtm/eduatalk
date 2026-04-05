import { type NextRequest } from "next/server";
import { apiSuccess, apiBadRequest, apiInternalError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { expandAliasNames, type AliasEntry } from "@/lib/domains/admission/search/alias-resolver";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";

const limiter = createRateLimiter({ maxRequests: 30 });

const MAX_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const rateLimitResponse = applyRateLimit(req, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = req.nextUrl;
  const universityName = searchParams.get("universityName")?.trim() ?? "";
  const departmentName = searchParams.get("departmentName")?.trim() ?? "";

  if (!universityName && !departmentName) {
    return apiBadRequest("대학명 또는 학과명을 입력해주세요.");
  }

  const page = Math.max(Number(searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(searchParams.get("pageSize")) || 10, 1),
    MAX_PAGE_SIZE,
  );

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return apiInternalError("서버 설정 오류");
  }

  try {
    // 별칭 해석
    let aliasNames: string[] = [];
    if (universityName) {
      const { data: aliasRows } = await adminClient
        .from("university_name_aliases")
        .select("alias_name, canonical_name");

      if (aliasRows) {
        const entries: AliasEntry[] = aliasRows.map((d) => ({
          aliasName: d.alias_name,
          canonicalName: d.canonical_name,
        }));
        aliasNames = expandAliasNames(entries, universityName);
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // count 쿼리
    let countBuilder = adminClient
      .from("university_admissions")
      .select("*", { count: "exact", head: true });

    // data 쿼리
    let dataBuilder = adminClient
      .from("university_admissions")
      .select(
        "id, data_year, region, university_name, department_type, department_name, " +
        "admission_type, admission_name, competition_rates, admission_results, " +
        "replacements, min_score_criteria",
      );

    // 필터 적용
    if (universityName) {
      if (aliasNames.length > 0) {
        const ilikeFilter = `university_name.ilike.%${universityName}%`;
        const inFilter = `university_name.in.(${aliasNames.map((n) => `"${n}"`).join(",")})`;
        countBuilder = countBuilder.or(`${ilikeFilter},${inFilter}`);
        dataBuilder = dataBuilder.or(`${ilikeFilter},${inFilter}`);
      } else {
        countBuilder = countBuilder.ilike("university_name", `%${universityName}%`);
        dataBuilder = dataBuilder.ilike("university_name", `%${universityName}%`);
      }
    }
    if (departmentName) {
      countBuilder = countBuilder.ilike("department_name", `%${departmentName}%`);
      dataBuilder = dataBuilder.ilike("department_name", `%${departmentName}%`);
    }

    const [countResult, dataResult] = await Promise.all([
      countBuilder,
      dataBuilder
        .order("university_name")
        .order("department_name")
        .range(from, to),
    ]);

    if (countResult.error) throw countResult.error;
    if (dataResult.error) throw dataResult.error;

    return apiSuccess({
      rows: dataResult.data ?? [],
      total: countResult.count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[public/admissions/search]", error);
    return apiInternalError("입시 데이터 검색 중 오류가 발생했��니다.");
  }
}
