import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TermsContent, TermsContentType, TermsContentRow } from '@/lib/types/terms';

/**
 * 활성화된 약관 내용 조회
 * @param contentType 약관 유형
 */
export async function getActiveTermsContent(
  contentType: TermsContentType
): Promise<TermsContent | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('terms_contents')
      .select('*')
      .eq('content_type', contentType)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('[termsContents] 활성 약관 조회 실패:', {
        contentType,
        error: error.message,
        code: error.code,
      });
      return null;
    }

    return data as TermsContent;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[termsContents] 활성 약관 조회 예외:', {
      contentType,
      error: errorMessage,
    });
    return null;
  }
}

/**
 * 약관 버전 히스토리 조회
 * @param contentType 약관 유형
 */
export async function getTermsContentHistory(
  contentType: TermsContentType
): Promise<TermsContent[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('terms_contents')
      .select('*')
      .eq('content_type', contentType)
      .order('version', { ascending: false });

    if (error) {
      console.error('[termsContents] 약관 히스토리 조회 실패:', {
        contentType,
        error: error.message,
        code: error.code,
      });
      return [];
    }

    return (data as TermsContentRow[]) as TermsContent[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[termsContents] 약관 히스토리 조회 예외:', {
      contentType,
      error: errorMessage,
    });
    return [];
  }
}

/**
 * ID로 약관 내용 조회
 * @param id 약관 ID
 */
export async function getTermsContentById(id: string): Promise<TermsContent | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('terms_contents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('[termsContents] 약관 조회 실패:', {
        id,
        error: error.message,
        code: error.code,
      });
      return null;
    }

    return data as TermsContent;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[termsContents] 약관 조회 예외:', {
      id,
      error: errorMessage,
    });
    return null;
  }
}

