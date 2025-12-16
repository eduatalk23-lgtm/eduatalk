// 콘텐츠 관련 타입 정의

export type Book = {
  id: string;
  title: string;
  revision: string | null;
  semester: string | null;
  subject_category: string | null;
  subject: string | null;
  publisher: string | null;
  difficulty_level: string | null;
  total_pages: number | null;
  notes: string | null;
  created_at?: string;
  // 마스터 교재에서 가져온 필드들
  content_category?: string | null;
  subtitle?: string | null;
  series_name?: string | null;
  author?: string | null;
  description?: string | null;
  toc?: string | null;
  publisher_review?: string | null;
  publisher_id?: string | null;
  publisher_name?: string | null;
  isbn_10?: string | null;
  isbn_13?: string | null;
  edition?: string | null;
  published_date?: string | null;
  curriculum_revision_id?: string | null;
  subject_id?: string | null;
  subject_group_id?: string | null;
  grade_min?: number | null;
  grade_max?: number | null;
  school_type?: string | null;
  source?: string | null;
  source_product_code?: string | null;
  source_url?: string | null;
  cover_image_url?: string | null;
  target_exam_type?: string[] | null;
  tags?: string[] | null;
  pdf_url?: string | null;
  ocr_data?: any | null;
  page_analysis?: any | null;
  overall_difficulty?: number | null;
  is_active?: boolean | null;
  master_content_id?: string | null;
};

export type Lecture = {
  id: string;
  title: string;
  revision: string | null;
  semester: string | null;
  subject_category: string | null;
  subject: string | null;
  platform: string | null;
  difficulty_level: string | null;
  duration: number | null;
  notes: string | null;
  created_at?: string;
  // 마스터 강의에서 가져온 필드들
  content_category?: string | null;
  lecture_type?: string | null;
  subtitle?: string | null;
  series_name?: string | null;
  instructor_name?: string | null;
  description?: string | null;
  toc?: string | null;
  curriculum_revision_id?: string | null;
  subject_id?: string | null;
  subject_group_id?: string | null;
  grade_level?: string | null;
  platform_id?: string | null;
  lecture_source_url?: string | null;
  source?: string | null;
  source_product_code?: string | null;
  cover_image_url?: string | null;
  total_duration?: number | null;
  video_url?: string | null;
  transcript?: string | null;
  episode_analysis?: any | null;
  overall_difficulty?: number | null;
  target_exam_type?: string[] | null;
  tags?: string[] | null;
  is_active?: boolean | null;
  master_lecture_id?: string | null;
  total_episodes?: number | null;
  linked_book_id?: string | null;
};

export type CustomContent = {
  id: string;
  title: string;
  content_type: string | null;
  total_page_or_time: number | null;
  difficulty_level: string | null;
  subject: string | null;
  created_at?: string;
  student_id?: string;
};

export type ContentTab = "books" | "lectures" | "custom";

export type ContentListItem = {
  id: string;
  title: string;
  master_content_id?: string | null;
  master_lecture_id?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

