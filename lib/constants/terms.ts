import type { TermsContentType } from '@/lib/types/terms';

export const TERMS_CONTENT_TYPES: TermsContentType[] = ['terms', 'privacy', 'marketing'];

export const TERMS_CONTENT_TYPE_LABELS: Record<TermsContentType, string> = {
  terms: '이용약관',
  privacy: '개인정보취급방침',
  marketing: '마케팅 활용 동의',
};

export const TERMS_CONTENT_TYPE_DESCRIPTIONS: Record<TermsContentType, string> = {
  terms: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  marketing: '마케팅 및 광고 활용 동의',
};

