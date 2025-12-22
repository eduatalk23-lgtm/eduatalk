/**
 * Content Metadata Domain Actions
 *
 * Admin-facing Server Actions for content metadata management.
 */

// ============================================
// Curriculum & Subject Metadata
// ============================================

export {
  // Curriculum Revisions
  getCurriculumRevisionsAction,
  createCurriculumRevisionAction,
  updateCurriculumRevisionAction,
  deleteCurriculumRevisionAction,
  // Subject Categories
  createSubjectCategoryAction,
  updateSubjectCategoryAction,
  deleteSubjectCategoryAction,
  // Subjects (within categories)
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
  // Platforms
  getPlatformsAction,
  createPlatformAction,
  updatePlatformAction,
  deletePlatformAction,
  // Publishers
  getPublishersAction,
  createPublisherAction,
  updatePublisherAction,
  deletePublisherAction,
} from "./metadata";

// ============================================
// Custom Content
// ============================================

export {
  addMasterCustomContent,
  updateMasterCustomContentAction,
  deleteMasterCustomContentAction,
} from "./customContent";

// ============================================
// Difficulty Levels
// ============================================

export {
  getDifficultyLevelsAction,
  getDifficultyLevelByIdAction,
  createDifficultyLevelAction,
  updateDifficultyLevelAction,
  deleteDifficultyLevelAction,
} from "./difficultyLevels";

// ============================================
// Career Fields
// ============================================

export {
  getCareerFieldsAction,
  getAllCareerFieldsAction,
  createCareerFieldAction,
  updateCareerFieldAction,
  deleteCareerFieldAction,
} from "./careerFields";
