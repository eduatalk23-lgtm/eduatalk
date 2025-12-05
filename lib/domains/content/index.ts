/**
 * Content 도메인 Public API
 *
 * 콘텐츠 관련 기능을 통합합니다:
 * - 마스터 콘텐츠 (관리자가 등록한 공용 콘텐츠)
 * - 학생 콘텐츠 (학생이 등록한 개인 콘텐츠)
 * - 콘텐츠 메타데이터 (출판사, 플랫폼 등)
 */

// 마스터 콘텐츠 re-export
export {
  searchMasterBooks,  // 변경: getMasterBooks → searchMasterBooks
  searchMasterLectures,  // 변경: getMasterLectures → searchMasterLectures
  getMasterBookById,
  getMasterLectureById,
  searchContentMasters,  // 변경: searchMasterContents → searchContentMasters
} from "@/lib/data/contentMasters";

// 학생 콘텐츠 re-export
export {
  getBooks,
  getLectures,
  getCustomContents,
  createBook,
  createLecture,
  createCustomContent,
  updateBook,
  updateLecture,
  updateCustomContent,
  deleteBook,
  deleteLecture,
  deleteCustomContent,
  type Book,
  type Lecture,
  type CustomContent,
} from "@/lib/data/studentContents";

// 콘텐츠 메타데이터 re-export
export {
  getPublishers,
  getPlatforms,
  getCurriculumRevisions,
  getSubjectCategories,
} from "@/lib/data/contentMetadata";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - Book, Lecture, CustomContent 타입 통합
 *    - MasterContent 타입 통합
 *
 * 2. validation.ts 추가
 *    - 콘텐츠 생성/수정 스키마
 *
 * 3. actions.ts 통합
 *    - app/(student)/actions/contentActions.ts
 *    - app/(student)/actions/contentDetailsActions.ts
 *    - app/(student)/actions/contentMasterActions.ts
 *    - app/(student)/actions/masterContentActions.ts
 *    - app/(admin)/actions/contentMetadataActions.ts
 */

