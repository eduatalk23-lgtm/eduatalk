
export type ContentType = "book" | "lecture";

export type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

export type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
};

export type ContentDetailData = { 
  details: BookDetail[] | LectureEpisode[]; 
  type: "book" | "lecture" 
};

export type ContentMetadata = {
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};
