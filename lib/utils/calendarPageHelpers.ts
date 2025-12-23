import type { Plan } from "@/lib/data/studentPlans";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichPlansWithContentDetails } from "./planContentEnrichment";

/**
 * 콘텐츠 정보가 추가된 플랜 타입
 */
export type PlanWithContent = Plan & {
  contentTitle: string;
  contentSubject: string | null;
  contentSubjectCategory: string | null;
  contentCategory: string | null;
  contentEpisode: string | null;
};

/**
 * 캘린더 페이지에서 플랜에 콘텐츠 정보를 추가하는 공통 함수
 * - 교과 정보가 없는 플랜의 콘텐츠 ID 수집
 * - 콘텐츠 테이블에서 교과 정보 및 제목 조회
 * - 플랜에 기본 콘텐츠 정보 추가
 * - enrichPlansWithContentDetails 호출하여 상세 정보 추가
 *
 * @param filteredPlans 필터링된 플랜 배열
 * @param supabase Supabase 클라이언트
 * @param userId 사용자 ID
 * @param logPrefix 로그 접두사 (선택사항, 기본값: "[calendar]")
 * @returns 콘텐츠 정보가 추가된 플랜 배열
 */
export async function enrichPlansWithContentInfo(
  filteredPlans: Plan[],
  supabase: SupabaseClient,
  userId: string,
  logPrefix: string = "[calendar]"
): Promise<PlanWithContent[]> {
  // 1. 교과 정보 또는 제목이 없는 플랜의 콘텐츠 ID 수집
  const missingContentIds = new Map<"book" | "lecture" | "custom", Set<string>>();
  missingContentIds.set("book", new Set());
  missingContentIds.set("lecture", new Set());
  missingContentIds.set("custom", new Set());

  filteredPlans.forEach((plan) => {
    const needsFetch =
      (!plan.content_subject_category && !plan.content_subject) ||
      !plan.content_title;
    if (needsFetch && plan.content_id) {
      const contentType = plan.content_type as "book" | "lecture" | "custom";
      if (contentType && missingContentIds.has(contentType)) {
        missingContentIds.get(contentType)!.add(plan.content_id);
      }
    }
  });

  // 2. 콘텐츠 테이블에서 교과 정보 및 제목 조회
  const contentSubjectMap = new Map<
    string,
    { subjectCategory: string | null; subject: string | null; title: string | null }
  >();

  for (const [contentType, contentIds] of missingContentIds.entries()) {
    if (contentIds.size === 0) continue;

    try {
      const tableName =
        contentType === "book"
          ? "books"
          : contentType === "lecture"
          ? "lectures"
          : "student_custom_contents";
      const selectField =
        contentType === "book"
          ? "id,subject_category,subject,title"
          : contentType === "lecture"
          ? "id,subject_category,subject,title"
          : "id,subject_category,subject,title";

      const { data, error } = await supabase
        .from(tableName)
        .select(selectField)
        .in("id", Array.from(contentIds));

      if (!error && data) {
        data.forEach((content: {
          id: string;
          subject_category: string | null;
          subject: string | null;
          title: string | null;
        }) => {
          contentSubjectMap.set(content.id, {
            subjectCategory: content.subject_category || null,
            subject: content.subject || null,
            title: content.title || null,
          });
        });
      }
    } catch (error) {
      console.error(`${logPrefix} ${contentType} 교과 정보 조회 실패`, error);
    }
  }

  // 3. 플랜에 콘텐츠 정보 추가 (denormalized 필드 사용 + 조회한 정보 보완)
  // 먼저 교과 정보를 추가한 후, 콘텐츠 상세 정보(episode/book_detail)를 추가
  const plansWithBasicContent = filteredPlans.map((plan) => {
    // 교과 정보 (denormalized 필드 우선, 없으면 조회한 정보 사용, 둘 다 없으면 null)
    const contentSubjectInfo = plan.content_id
      ? contentSubjectMap.get(plan.content_id)
      : null;
    const contentSubjectCategory =
      plan.content_subject_category ||
      contentSubjectInfo?.subjectCategory ||
      null;
    const contentSubject =
      plan.content_subject || contentSubjectInfo?.subject || null;

    return {
      ...plan,
      contentTitle: plan.content_title || contentSubjectInfo?.title || "제목 없음",
      contentSubject,
      contentSubjectCategory, // 교과 (항상 일관되게 표시)
      contentCategory: plan.content_category || null, // 유형
    };
  });

  // 4. 콘텐츠 상세 정보 추가 (episode_title, major_unit/minor_unit)
  const plansWithContentDetails = await enrichPlansWithContentDetails(
    plansWithBasicContent,
    userId
  );

  // 5. 최종 plansWithContent 생성 (기존 구조 유지)
  // enrichPlansWithContentDetails가 반환하는 타입은 PlanWithEpisode이므로
  // contentEpisode는 이미 포함되어 있을 수 있음
  const plansWithContent: PlanWithContent[] = plansWithContentDetails.map(
    (plan) => {
      // PlanWithContent 타입으로 안전하게 변환
      const planWithContent = plan as Plan & {
        contentTitle?: string;
        contentSubject?: string | null;
        contentSubjectCategory?: string | null;
        contentCategory?: string | null;
        contentEpisode?: string | null;
      };

      return {
        ...plan,
        contentTitle: planWithContent.contentTitle || plan.content_title || "제목 없음",
        contentSubject: planWithContent.contentSubject ?? plan.content_subject ?? null,
        contentSubjectCategory: planWithContent.contentSubjectCategory ?? plan.content_subject_category ?? null,
        contentCategory: planWithContent.contentCategory ?? plan.content_category ?? null,
        contentEpisode: planWithContent.contentEpisode ?? null,
      };
    }
  );

  return plansWithContent;
}

