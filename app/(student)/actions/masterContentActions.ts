"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/requireAdminOrConsultant";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createMasterBook,
  updateMasterBook,
  createMasterLecture,
  updateMasterLecture,
  createBookDetail,
  updateBookDetail,
  deleteBookDetail,
  createLectureEpisode,
  deleteAllLectureEpisodes,
  getMasterBooksList,
  searchMasterBooksForDropdown,
  getMasterBookForDropdown,
} from "@/lib/data/contentMasters";
import {
  MasterBook,
  MasterLecture,
  BookDetail,
  LectureEpisode,
} from "@/lib/types/plan";
import { minutesToSeconds } from "@/lib/utils/duration";
import {
  parseMasterBookFormData,
  parseMasterBookUpdateFormData,
  parseMasterLectureFormData,
  parseMasterLectureUpdateFormData,
} from "@/lib/utils/masterContentFormHelpers";

/**
 * 마스터 교재 목록 조회 (Server Action)
 * 초기 로드용 - 최대 50개
 */
async function _getMasterBooksList(): Promise<
  Array<{ id: string; title: string }>
> {
  await requireAdminOrConsultant();
  return await getMasterBooksList();
}

export const getMasterBooksListAction = withErrorHandling(_getMasterBooksList);

/**
 * 마스터 교재 검색 (Server Action)
 * 검색어로 교재 검색 - 최대 50개
 */
async function _searchMasterBooks(
  searchQuery: string
): Promise<Array<{ id: string; title: string }>> {
  await requireAdminOrConsultant();
  if (!searchQuery || searchQuery.trim().length < 1) {
    return await getMasterBooksList();
  }
  return await searchMasterBooksForDropdown(searchQuery.trim());
}

export const searchMasterBooksAction = withErrorHandling(_searchMasterBooks);

/**
 * 마스터 교재 단일 조회 (Server Action)
 * ID로 교재 정보 조회
 */
async function _getMasterBookById(
  bookId: string
): Promise<{ id: string; title: string } | null> {
  await requireAdminOrConsultant();
  return await getMasterBookForDropdown(bookId);
}

export const getMasterBookByIdAction = withErrorHandling(_getMasterBookById);

/**
 * 서비스 마스터 교재 생성
 */
export const addMasterBook = withErrorHandling(async (formData: FormData) => {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  const bookData = parseMasterBookFormData(
    formData,
    tenantContext?.tenantId || null
  );

  if (!bookData.title) {
    throw new AppError(
      "교재명은 필수입니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const book = await createMasterBook(bookData);

  // 상세 정보 추가 (있는 경우)
  const detailsJson = formData.get("details")?.toString();
  if (detailsJson) {
    try {
      const details = JSON.parse(detailsJson) as Array<{
        major_unit?: string;
        minor_unit?: string;
        page_number: number;
        display_order: number;
      }>;

      for (const detail of details) {
        await createBookDetail({
          book_id: book.id,
          major_unit: detail.major_unit || null,
          minor_unit: detail.minor_unit || null,
          page_number: detail.page_number,
          display_order: detail.display_order,
        });
      }
    } catch (error) {
      console.error("상세 정보 추가 실패:", error);
      throw new AppError(
        `교재는 생성되었지만 상세 정보 저장에 실패했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  redirect(`/admin/master-books/${book.id}`);
});

/**
 * 서비스 마스터 교재 생성 (redirect 없이 bookId 반환)
 */
export const createMasterBookWithoutRedirect = withErrorHandling(
  async (
    formData: FormData
  ): Promise<
    | { success: true; bookId: string }
    | { success: false; error: string; bookId: null }
  > => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    const bookData = parseMasterBookFormData(
      formData,
      tenantContext?.tenantId || null
    );

    if (!bookData.title) {
      return {
        success: false,
        error: "교재명은 필수입니다.",
        bookId: null,
      };
    }

    try {
      const book = await createMasterBook(bookData);

      // 상세 정보 추가 (있는 경우)
      const detailsJson = formData.get("details")?.toString();
      if (detailsJson) {
        try {
          const details = JSON.parse(detailsJson) as Array<{
            major_unit?: string;
            minor_unit?: string;
            page_number: number;
            display_order: number;
          }>;

          for (const detail of details) {
            await createBookDetail({
              book_id: book.id,
              major_unit: detail.major_unit || null,
              minor_unit: detail.minor_unit || null,
              page_number: detail.page_number,
              display_order: detail.display_order,
            });
          }
        } catch (error) {
          console.error("상세 정보 추가 실패:", error);
          // 상세 정보 추가 실패해도 교재는 생성됨
        }
      }

      return { success: true, bookId: book.id };
    } catch (error) {
      console.error("교재 생성 실패:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "교재 생성에 실패했습니다.",
        bookId: null,
      };
    }
  }
);

/**
 * 서비스 마스터 교재 수정
 */
export const updateMasterBookAction = withErrorHandling(
  async (bookId: string, formData: FormData) => {
    await requireAdminOrConsultant();

    const updateData = parseMasterBookUpdateFormData(formData);

    await updateMasterBook(bookId, updateData);

    // 상세 정보 업데이트
    const detailsJson = formData.get("details")?.toString();
    if (detailsJson) {
      try {
        const newDetails = JSON.parse(detailsJson) as Array<{
          major_unit?: string | null;
          minor_unit?: string | null;
          page_number: number;
          display_order: number;
        }>;

        // 기존 상세 정보 삭제 후 새로 추가
        const { deleteAllBookDetails } = await import(
          "@/lib/data/contentMasters"
        );
        await deleteAllBookDetails(bookId);

        // 새 상세 정보 추가
        for (const detail of newDetails) {
          await createBookDetail({
            book_id: bookId,
            major_unit: detail.major_unit || null,
            minor_unit: detail.minor_unit || null,
            page_number: detail.page_number,
            display_order: detail.display_order,
          });
        }
      } catch (error) {
        console.error("상세 정보 업데이트 실패:", error);
        throw new AppError(
          `교재는 수정되었지만 상세 정보 저장에 실패했습니다: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    revalidatePath("/admin/master-books");
    revalidatePath(`/admin/master-books/${bookId}`);
    redirect(`/admin/master-books/${bookId}`);
  }
);

/**
 * 서비스 마스터 강의 생성
 */
export const addMasterLecture = withErrorHandling(
  async (formData: FormData) => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    const lectureData = parseMasterLectureFormData(
      formData,
      tenantContext?.tenantId || null
    );

    if (!lectureData.title || !lectureData.total_episodes) {
      throw new AppError(
        "강의명과 총 회차는 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const lecture = await createMasterLecture(lectureData);

    // 연결된 교재 생성 (있는 경우)
    const bookTitle = formData.get("book_title")?.toString();
    let linkedBookId: string | null = null;

    if (bookTitle) {
      try {
        const bookData: Partial<
          Omit<MasterBook, "id" | "created_at" | "updated_at">
        > & {
          title: string;
          is_active: boolean;
        } = {
          tenant_id: tenantContext?.tenantId || null,
          is_active: true,
          revision: formData.get("book_revision")?.toString() || null,
          content_category: null,
          subject_category:
            formData.get("book_subject_category")?.toString() || null,
          subject: formData.get("book_subject")?.toString() || null,
          title: bookTitle,
          publisher_name: formData.get("book_publisher")?.toString() || null,
          total_pages: formData.get("book_total_pages")
            ? parseInt(formData.get("book_total_pages")!.toString())
            : 0,
          difficulty_level:
            formData.get("book_difficulty_level")?.toString() || null,
          notes: formData.get("book_notes")?.toString() || null,
        };

        if (!bookData.title || !bookData.total_pages) {
          throw new AppError(
            "교재명과 총 페이지는 필수입니다.",
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }

        const book = await createMasterBook(
          bookData as Omit<MasterBook, "id" | "created_at" | "updated_at">
        );
        linkedBookId = book.id;

        // 교재 상세 정보 추가 (있는 경우)
        const bookDetailsJson = formData.get("details")?.toString();
        if (bookDetailsJson) {
          try {
            const details = JSON.parse(bookDetailsJson) as Array<{
              major_unit?: string | null;
              minor_unit?: string | null;
              page_number: number;
              display_order: number;
            }>;

            for (const detail of details) {
              await createBookDetail({
                book_id: book.id,
                major_unit: detail.major_unit || null,
                minor_unit: detail.minor_unit || null,
                page_number: detail.page_number,
                display_order: detail.display_order,
              });
            }
          } catch (error) {
            console.error("교재 상세 정보 추가 실패:", error);
            throw new AppError(
              `교재는 생성되었지만 상세 정보 저장에 실패했습니다: ${
                error instanceof Error ? error.message : "알 수 없는 오류"
              }`,
              ErrorCode.DATABASE_ERROR,
              500,
              true
            );
          }
        }

        // 강의에 교재 연결
        if (linkedBookId) {
          await updateMasterLecture(lecture.id, {
            linked_book_id: linkedBookId,
          });
        }
      } catch (error) {
        console.error("교재 생성 실패:", error);
        // 교재 생성 실패해도 강의는 생성됨
      }
    }

    // episode 정보 추가 (있는 경우)
    const episodesJson = formData.get("episodes")?.toString();
    if (episodesJson) {
      try {
        const episodes = JSON.parse(episodesJson) as Array<{
          episode_number: number;
          episode_title?: string | null;
          duration?: number | null;
          display_order: number;
        }>;

        for (const episode of episodes) {
          await createLectureEpisode({
            lecture_id: lecture.id,
            episode_number: episode.episode_number,
            episode_title: episode.episode_title || null,
            duration: episode.duration
              ? minutesToSeconds(episode.duration)
              : null,
            display_order: episode.display_order,
          });
        }
      } catch (error) {
        console.error("episode 정보 추가 실패:", error);
        throw new AppError(
          `강의는 생성되었지만 회차 정보 저장에 실패했습니다: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    redirect(`/admin/master-lectures/${lecture.id}`);
  }
);

/**
 * 서비스 마스터 강의 수정
 */
export const updateMasterLectureAction = withErrorHandling(
  async (lectureId: string, formData: FormData) => {
    await requireAdminOrConsultant();

    const updateData = parseMasterLectureUpdateFormData(formData);

    await updateMasterLecture(lectureId, updateData);

    // episode 정보 업데이트
    const episodesJson = formData.get("episodes")?.toString();
    if (episodesJson) {
      try {
        const newEpisodes = JSON.parse(episodesJson) as Array<{
          episode_number: number;
          episode_title?: string | null;
          duration?: number | null;
          display_order: number;
        }>;

        // 기존 episode 삭제 후 새로 추가
        await deleteAllLectureEpisodes(lectureId);

        // 새 episode 추가
        for (const episode of newEpisodes) {
          await createLectureEpisode({
            lecture_id: lectureId,
            episode_number: episode.episode_number,
            episode_title: episode.episode_title || null,
            duration: episode.duration
              ? minutesToSeconds(episode.duration)
              : null,
            display_order: episode.display_order,
          });
        }
      } catch (error) {
        console.error("episode 정보 업데이트 실패:", error);
        throw new AppError(
          `강의는 수정되었지만 회차 정보 저장에 실패했습니다: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    revalidatePath("/admin/master-lectures");
    revalidatePath(`/admin/master-lectures/${lectureId}`);
    redirect(`/admin/master-lectures/${lectureId}`);
  }
);
