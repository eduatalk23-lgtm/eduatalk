import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TermsContent, TermsContentType, TermsContentRow } from '@/lib/types/terms';
import {
  createTypedQuery,
  createTypedSingleQuery,
} from '@/lib/data/core/typedQueryBuilder';
import { handleQueryError } from '@/lib/data/core/errorHandler';
import { ErrorCodeCheckers } from '@/lib/constants/errorCodes';

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
  const supabase = await createSupabaseServerClient();

  return await createTypedSingleQuery<TermsContent>(
    async () => {
      const queryResult = await supabase
        .from('terms_contents')
        .select('*')
        .eq('content_type', contentType)
        .eq('is_active', true);

      return {
        data: queryResult.data as TermsContent[] | null,
        error: queryResult.error,
      };
    },
    {
      context: '[data/termsContents] getActiveTermsContent',
      defaultValue: null,
    }
  );
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
  const supabase = await createSupabaseServerClient();

  return await createTypedQuery<TermsContent[]>(
    async () => {
      const queryResult = await supabase
        .from('terms_contents')
        .select('*')
        .eq('content_type', contentType)
        .order('version', { ascending: false });

      return {
        data: queryResult.data as TermsContentRow[] | null,
        error: queryResult.error,
      };
    },
    {
      context: '[data/termsContents] getTermsContentHistory',
      defaultValue: [],
    }
  ) ?? [];
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
  const supabase = await createSupabaseServerClient();

  return await createTypedSingleQuery<TermsContent>(
    async () => {
      const queryResult = await supabase
        .from('terms_contents')
        .select('*')
        .eq('id', id);

      return {
        data: queryResult.data as TermsContent[] | null,
        error: queryResult.error,
      };
    },
    {
      context: '[data/termsContents] getTermsContentById',
      defaultValue: null,
    }
  );
}

