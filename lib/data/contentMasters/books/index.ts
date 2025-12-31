/**
 * 마스터 교재 관련 함수
 */

// Search
export {
  searchMasterBooks,
  getMasterBooksList,
  searchMasterBooksForDropdown,
  getMasterBookForDropdown,
} from "./search";

// CRUD
export {
  getMasterBookById,
  createMasterBook,
  updateMasterBook,
  deleteMasterBook,
} from "./crud";

// Details
export {
  createBookDetail,
  updateBookDetail,
  deleteBookDetail,
  deleteAllBookDetails,
  getStudentBookDetails,
  getStudentBookDetailsBatch,
} from "./details";
