export type TermsContentType = 'terms' | 'privacy' | 'marketing';

/**
 * 약관 내용 타입
 * 데이터베이스에서 조회된 약관 내용을 나타냅니다.
 */
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

/**
 * 약관 내용 입력 타입
 * 새 약관 버전 생성 시 사용됩니다.
 */
export interface TermsContentInput {
  content_type: TermsContentType;
  title: string;
  content: string;
}

/**
 * 약관 내용 행 타입
 * 데이터베이스에서 직접 조회된 행을 나타냅니다.
 * TermsContent와 동일하지만 타입 단언을 위한 별도 타입입니다.
 */
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

