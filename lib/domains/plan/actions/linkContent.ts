"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";

/**
 * 콘텐츠 연결에 필요한 정보
 */
export type ContentLinkInfo = {
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  title: string;
  subjectCategory?: string | null;
  subject?: string | null;
  startRange?: number;
  endRange?: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  totalPages?: number | null;
  totalEpisodes?: number | null;
  masterContentId?: string | null; // 마스터 콘텐츠에서 가져온 경우
};

/**
 * 가상 플랜에 콘텐츠 연결 결과
 */
export type LinkContentResult = {
  success: boolean;
  error?: string;
  updatedPlanId?: string;
};

/**
 * 가상 플랜에 콘텐츠를 연결합니다.
 *
 * 이 함수는 is_virtual=true인 student_plan 항목에 실제 콘텐츠를 연결하고,
 * is_virtual을 false로 변경합니다.
 *
 * @param planId - 연결할 가상 플랜 ID
 * @param contentInfo - 연결할 콘텐츠 정보
 * @returns 연결 결과
 */
export async function linkContentToVirtualPlan(
  planId: string,
  contentInfo: ContentLinkInfo
): Promise<LinkContentResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "인증되지 않은 사용자입니다." };
    }

    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      console.error("[linkContent] Admin client를 생성할 수 없습니다.");
      return { success: false, error: "서버 설정 오류가 발생했습니다." };
    }

    // 1. 현재 플랜 조회 및 권한 확인
    const { data: plan, error: fetchError } = await supabase
      .from("student_plan")
      .select(`
        id,
        student_id,
        is_virtual,
        slot_index,
        virtual_subject_category,
        plan_group_id,
        plan_groups!inner(student_id)
      `)
      .eq("id", planId)
      .single();

    if (fetchError) {
      console.error("[linkContent] 플랜 조회 실패:", fetchError);
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 2. 권한 확인 (학생 본인만 연결 가능)
    // plan_groups는 inner join으로 단일 객체
    const planGroups = plan.plan_groups as unknown as { student_id: string } | null;
    const planStudentId = planGroups?.student_id;
    if (planStudentId !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // 3. 가상 플랜인지 확인
    if (!plan.is_virtual) {
      return { success: false, error: "이미 콘텐츠가 연결된 플랜입니다." };
    }

    // 3.5. 마스터 콘텐츠인 경우 학생 콘텐츠로 복사
    let resolvedContentId = contentInfo.contentId;
    let resolvedStartDetailId = contentInfo.startDetailId;
    let resolvedEndDetailId = contentInfo.endDetailId;

    if (contentInfo.masterContentId) {
      // 테넌트 ID 조회
      const { data: planGroupData } = await adminClient
        .from("plan_groups")
        .select("tenant_id")
        .eq("id", plan.plan_group_id)
        .single();

      if (!planGroupData?.tenant_id) {
        console.error("[linkContent] 테넌트 ID를 찾을 수 없습니다.");
        return { success: false, error: "플랜 정보를 확인할 수 없습니다." };
      }

      try {
        if (contentInfo.contentType === "book") {
          const { bookId, detailIdMap } = await copyMasterBookToStudent(
            contentInfo.masterContentId,
            user.userId,
            planGroupData.tenant_id
          );
          resolvedContentId = bookId;

          // 마스터 detail ID를 학생 detail ID로 변환
          if (detailIdMap) {
            if (contentInfo.startDetailId && detailIdMap.has(contentInfo.startDetailId)) {
              resolvedStartDetailId = detailIdMap.get(contentInfo.startDetailId) ?? null;
            }
            if (contentInfo.endDetailId && detailIdMap.has(contentInfo.endDetailId)) {
              resolvedEndDetailId = detailIdMap.get(contentInfo.endDetailId) ?? null;
            }
          }
        } else if (contentInfo.contentType === "lecture") {
          const { lectureId, episodeIdMap } = await copyMasterLectureToStudent(
            contentInfo.masterContentId,
            user.userId,
            planGroupData.tenant_id
          );
          resolvedContentId = lectureId;

          // 마스터 episode ID를 학생 episode ID로 변환
          if (episodeIdMap) {
            if (contentInfo.startDetailId && episodeIdMap.has(contentInfo.startDetailId)) {
              resolvedStartDetailId = episodeIdMap.get(contentInfo.startDetailId) ?? null;
            }
            if (contentInfo.endDetailId && episodeIdMap.has(contentInfo.endDetailId)) {
              resolvedEndDetailId = episodeIdMap.get(contentInfo.endDetailId) ?? null;
            }
          }
        }
      } catch (copyError) {
        console.error("[linkContent] 마스터 콘텐츠 복사 실패:", copyError);
        return {
          success: false,
          error: "마스터 콘텐츠를 가져오는데 실패했습니다.",
        };
      }
    }

    // 4. 콘텐츠 존재 확인
    const contentTable = contentInfo.contentType === "book"
      ? "books"
      : contentInfo.contentType === "lecture"
        ? "lectures"
        : "student_custom_contents";

    const { data: content, error: contentError } = await supabase
      .from(contentTable)
      .select("id")
      .eq("id", resolvedContentId)
      .maybeSingle();

    if (contentError || !content) {
      console.error("[linkContent] 콘텐츠 조회 실패:", contentError);
      return { success: false, error: "선택한 콘텐츠를 찾을 수 없습니다." };
    }

    // 5. 플랜 업데이트 (가상 → 실제)
    const updateData = {
      content_id: resolvedContentId,
      content_type: contentInfo.contentType,
      is_virtual: false,
      virtual_subject_category: null,
      virtual_description: null,
      // 범위 정보가 있으면 업데이트
      ...(contentInfo.startRange !== undefined && {
        planned_start_page_or_time: contentInfo.startRange,
      }),
      ...(contentInfo.endRange !== undefined && {
        planned_end_page_or_time: contentInfo.endRange,
      }),
    };

    // Admin client 사용하여 RLS 우회 (plan_groups 조인으로 권한 확인 완료됨)
    const { error: updateError } = await adminClient
      .from("student_plan")
      .update(updateData)
      .eq("id", planId);

    if (updateError) {
      console.error("[linkContent] 플랜 업데이트 실패:", updateError);
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 6. 같은 slot_index를 가진 다른 가상 플랜들도 업데이트 (여러 날에 걸친 플랜)
    if (plan.slot_index !== null && plan.plan_group_id) {
      const { error: batchUpdateError } = await adminClient
        .from("student_plan")
        .update({
          content_id: resolvedContentId,
          content_type: contentInfo.contentType,
          is_virtual: false,
          virtual_subject_category: null,
          virtual_description: null,
        })
        .eq("plan_group_id", plan.plan_group_id)
        .eq("slot_index", plan.slot_index)
        .eq("is_virtual", true);

      if (batchUpdateError) {
        console.warn("[linkContent] 동일 슬롯 플랜 일괄 업데이트 실패:", batchUpdateError);
        // 주 플랜은 성공했으므로 계속 진행
      }
    }

    // 7. 플랜 그룹의 content_slots도 업데이트 (선택사항)
    if (plan.plan_group_id && plan.slot_index !== null) {
      try {
        // content_slots JSON 필드에서 해당 슬롯 업데이트
        const { data: planGroup } = await adminClient
          .from("plan_groups")
          .select("content_slots")
          .eq("id", plan.plan_group_id)
          .single();

        if (planGroup?.content_slots) {
          const slots = planGroup.content_slots as Array<{
            slot_index?: number;
            content_id?: string;
            title?: string;
            content_type?: string;
            start_range?: number;
            end_range?: number;
            start_detail_id?: string | null;
            end_detail_id?: string | null;
            master_content_id?: string | null;
          }>;

          const updatedSlots = slots.map((slot, idx) => {
            if (idx === plan.slot_index || slot.slot_index === plan.slot_index) {
              return {
                ...slot,
                content_id: resolvedContentId,
                title: contentInfo.title,
                content_type: contentInfo.contentType,
                start_range: contentInfo.startRange,
                end_range: contentInfo.endRange,
                start_detail_id: resolvedStartDetailId,
                end_detail_id: resolvedEndDetailId,
                master_content_id: contentInfo.masterContentId,
              };
            }
            return slot;
          });

          await adminClient
            .from("plan_groups")
            .update({ content_slots: updatedSlots })
            .eq("id", plan.plan_group_id);
        }
      } catch (slotUpdateError) {
        console.warn("[linkContent] content_slots 업데이트 실패:", slotUpdateError);
        // 주 기능은 성공했으므로 계속 진행
      }
    }

    // 8. 캐시 갱신
    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    return {
      success: true,
      updatedPlanId: planId,
    };
  } catch (error) {
    console.error("[linkContent] 예외 발생:", error);
    return {
      success: false,
      error: "콘텐츠 연결 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학생의 사용 가능한 콘텐츠 목록 조회
 *
 * 슬롯의 과목 카테고리에 맞는 콘텐츠를 필터링하여 반환합니다.
 */
export async function getAvailableContentsForSlot(
  studentId: string,
  subjectCategory?: string | null,
  slotType?: "book" | "lecture" | "custom" | null
): Promise<{
  books: ContentLinkInfo[];
  lectures: ContentLinkInfo[];
  custom: ContentLinkInfo[];
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // 병렬로 조회
    const [booksResult, lecturesResult, customResult] = await Promise.all([
      // 교재
      slotType === "lecture"
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("books")
            .select(`
              id,
              title,
              total_pages,
              subject_category,
              subject
            `)
            .eq("student_id", studentId)
            .order("title"),

      // 강의
      slotType === "book"
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("lectures")
            .select(`
              id,
              title,
              duration,
              subject_category,
              subject,
              total_episodes
            `)
            .eq("student_id", studentId)
            .order("title"),

      // 커스텀
      slotType === "book" || slotType === "lecture"
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("student_custom_contents")
            .select(`
              id,
              title,
              total_page_or_time,
              subject_category,
              subject
            `)
            .eq("student_id", studentId)
            .order("title"),
    ]);

    // 과목 카테고리로 필터링
    const filterByCategory = <T extends { subject_category?: string | null }>(
      items: T[]
    ): T[] => {
      if (!subjectCategory) return items;
      return items.filter(
        (item) =>
          !item.subject_category || item.subject_category === subjectCategory
      );
    };

    const books: ContentLinkInfo[] = filterByCategory(
      (booksResult.data || []) as Array<{
        id: string;
        title: string;
        total_pages?: number | null;
        subject_category?: string | null;
        subject?: string | null;
      }>
    ).map((book) => ({
      contentId: book.id,
      contentType: "book" as const,
      title: book.title,
      subjectCategory: book.subject_category,
      subject: book.subject,
      totalPages: book.total_pages,
    }));

    const lectures: ContentLinkInfo[] = filterByCategory(
      (lecturesResult.data || []) as Array<{
        id: string;
        title: string;
        duration?: number | null;
        subject_category?: string | null;
        subject?: string | null;
        total_episodes?: number | null;
      }>
    ).map((lecture) => ({
      contentId: lecture.id,
      contentType: "lecture" as const,
      title: lecture.title,
      subjectCategory: lecture.subject_category,
      subject: lecture.subject,
      totalEpisodes: lecture.total_episodes,
    }));

    const custom: ContentLinkInfo[] = filterByCategory(
      (customResult.data || []) as Array<{
        id: string;
        title: string;
        total_page_or_time?: number | null;
        subject_category?: string | null;
        subject?: string | null;
      }>
    ).map((c) => ({
      contentId: c.id,
      contentType: "custom" as const,
      title: c.title,
      subjectCategory: c.subject_category,
      subject: c.subject,
      totalPages: c.total_page_or_time,
    }));

    return { books, lectures, custom };
  } catch (error) {
    console.error("[getAvailableContentsForSlot] 오류:", error);
    return { books: [], lectures: [], custom: [] };
  }
}
