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
  [key: string]: string | number | boolean | null | undefined;
};

