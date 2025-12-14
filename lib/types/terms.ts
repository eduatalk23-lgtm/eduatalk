export type TermsContentType = 'terms' | 'privacy' | 'marketing';

export interface TermsContent {
  id: string;
  content_type: TermsContentType;
  version: number;
  title: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TermsContentInput {
  content_type: TermsContentType;
  title: string;
  content: string;
}

export interface TermsContentRow {
  id: string;
  content_type: TermsContentType;
  version: number;
  title: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

