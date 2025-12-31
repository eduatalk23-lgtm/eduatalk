/**
 * 콘텐츠 마스터 데이터 액세스 레이어
 *
 * master_books, master_lectures 테이블 사용
 * typedQueryBuilder 패턴을 사용하여 타입 안전성과 에러 처리를 표준화합니다.
 *
 * 하위 호환성을 위해 모든 함수를 re-export합니다.
 */

// Types
export type {
  ContentMasterFilters,
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
  ContentSortOption,
} from "./types";

// Books
export {
  // Search
  searchMasterBooks,
  getMasterBooksList,
  searchMasterBooksForDropdown,
  getMasterBookForDropdown,
  // CRUD
  getMasterBookById,
  createMasterBook,
  updateMasterBook,
  deleteMasterBook,
  // Details
  createBookDetail,
  updateBookDetail,
  deleteBookDetail,
  deleteAllBookDetails,
  getStudentBookDetails,
  getStudentBookDetailsBatch,
} from "./books";

// Lectures
export {
  // Search
  searchMasterLectures,
  // CRUD
  getMasterLectureById,
  createMasterLecture,
  updateMasterLecture,
  deleteMasterLecture,
  // Episodes
  createLectureEpisode,
  updateLectureEpisode,
  deleteLectureEpisode,
  deleteAllLectureEpisodes,
  getStudentLectureEpisodes,
  getStudentLectureEpisodesBatch,
  getMasterLectureEpisodesBatch,
  getLectureEpisodesWithFallback,
} from "./lectures";

// Custom Content
export {
  searchMasterCustomContents,
  getMasterCustomContentById,
  createMasterCustomContent,
  updateMasterCustomContent,
  deleteMasterCustomContent,
  copyMasterCustomContentToStudent,
} from "./custom";

// Copy Functions
export {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
  copyMasterToStudentContent,
} from "./copy";

// Filters
export {
  getCurriculumRevisions,
  getSubjectGroupsForFilter,
  getSubjectsForFilter,
  getBookSubjectList,
  getLectureSubjectList,
  getSubjectList,
  getSemesterList,
  getPublishersForFilter,
  getPlatformsForFilter,
  getDifficultiesForMasterBooks,
  getDifficultiesForMasterLectures,
} from "./filters";

// Hybrid (deprecated, for backward compatibility)
export { searchContentMasters, getContentMasterById } from "./hybrid";
