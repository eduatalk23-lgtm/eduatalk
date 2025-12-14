import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TermsContent, TermsContentType, TermsContentRow } from '@/lib/types/terms';

/**
 * 활성화된 약관 내용 조회 (공개 조회용)
 * 
 * RLS 정책에 따라 활성 버전만 조회 가능합니다.
 * 모든 사용자(인증 여부와 관계없이)가 접근할 수 있습니다.
 * 
 * @param contentType 약관 유형
 * @returns 활성화된 약관 내용 또는 null
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
      // PGRST116: No rows returned
      if (error.code === 'PGRST116') {
        return null;
      }
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === 'PGRST205') {
        console.error('[termsContents] 약관 테이블을 찾을 수 없습니다. 마이그레이션이 적용되었는지 확인해주세요.');
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
 * 약관 버전 히스토리 조회 (공개 조회용)
 * 
 * RLS 정책에 따라 활성 버전만 조회 가능합니다.
 * 모든 사용자(인증 여부와 관계없이)가 접근할 수 있습니다.
 * 
 * @param contentType 약관 유형
 * @returns 활성화된 약관 목록 (버전 내림차순)
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
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === 'PGRST205') {
        console.error('[termsContents] 약관 테이블을 찾을 수 없습니다. 마이그레이션이 적용되었는지 확인해주세요.');
        return [];
      }
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
 * ID로 약관 내용 조회 (공개 조회용)
 * 
 * RLS 정책에 따라 활성 버전만 조회 가능합니다.
 * 모든 사용자(인증 여부와 관계없이)가 접근할 수 있습니다.
 * 
 * @param id 약관 ID
 * @returns 약관 내용 또는 null
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
      // PGRST116: No rows returned
      if (error.code === 'PGRST116') {
        return null;
      }
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === 'PGRST205') {
        console.error('[termsContents] 약관 테이블을 찾을 수 없습니다. 마이그레이션이 적용되었는지 확인해주세요.');
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

