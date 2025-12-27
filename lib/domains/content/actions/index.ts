/**
 * Content Domain Actions
 *
 * 콘텐츠 관련 Server Actions 통합 export
 */

// Student Content CRUD
export {
  addBook,
  createBookWithoutRedirect,
  updateBook,
  deleteBook,
  deleteBooks,
  addLecture,
  updateLecture,
  deleteLecture,
  deleteLectures,
  addCustomContent,
  updateCustomContent,
  deleteCustomContent,
} from "./student";

// Content Details (Book Details, Lecture Episodes)
export {
  saveBookDetailsAction,
  saveLectureEpisodesAction,
} from "./details";

// Master Content Search (for students/admins/consultants)
export {
  searchContentMastersAction,
  getContentMasterByIdAction,
  copyMasterToStudentContentAction,
  getSubjectListAction,
  getSemesterListAction,
} from "./master-search";

// Content Metadata
export {
  getCurriculumRevisionsAction,
  getPlatformsAction,
  getPublishersAction,
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
  getStudentBooksAction,
} from "./metadata";

// Master Content Admin CRUD
export {
  getMasterBooksListAction,
  searchMasterBooksAction,
  getMasterBookByIdAction,
  addMasterBook,
  createMasterBookWithoutRedirect,
  updateMasterBookAction,
  addMasterLecture,
  updateMasterLectureAction,
} from "./master-admin";

// Content Fetch
export {
  fetchContentMetadataAction,
  fetchContentMetadataBatchAction,
  fetchContentDetailsForValidation,
  fetchDetailSubjects,
} from "./fetch";

// Content Recommendations
export { getRecommendedMasterContentsAction } from "./recommendations";

// Student Content Master IDs
export { getStudentContentMasterIdsAction } from "./student-master-ids";

// Enhanced Custom Content CRUD & Templates (Phase 5)
export {
  createCustomContent as createEnhancedCustomContent,
  getCustomContent,
  listCustomContents,
  updateCustomContent as updateEnhancedCustomContent,
  deleteCustomContent as deleteEnhancedCustomContent,
  archiveCustomContent,
  restoreCustomContent,
  saveAsTemplate,
  createFromTemplate,
  listTemplates,
  createTemplate,
  deleteTemplate,
  duplicateCustomContent,
  bulkUpdateStatus,
  searchByTags,
} from "./custom";
