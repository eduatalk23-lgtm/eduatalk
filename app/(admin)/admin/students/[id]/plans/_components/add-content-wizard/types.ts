import type { ContentType, RangeType } from '@/lib/domains/admin-plan/types';

export type DistributionMode = 'today' | 'period' | 'weekly';

export interface AddContentWizardData {
  // Step 1: 콘텐츠 정보
  contentType: ContentType;
  curriculum: string;
  subjectArea: string;
  subject: string;
  title: string;
  linkMaster: boolean;
  /** 마스터 콘텐츠 ID (linkMaster가 true일 때 사용) */
  masterContentId?: string;
  /** 마스터 콘텐츠 제목 (표시용) */
  masterContentTitle?: string;

  // Step 2: 범위 설정
  rangeType: RangeType;
  rangeStart: string;
  rangeEnd: string;
  customRange: string;
  totalVolume: string;

  // Step 3: 배치 방식
  distributionMode: DistributionMode;
  periodStart: string;
  periodEnd: string;
  /** 스케줄러를 사용한 자동 시간 배정 (today 모드 전용) */
  useScheduler: boolean;
}

export interface AddContentWizardProps {
  studentId: string;
  tenantId: string;
  targetDate: string;
  onClose: () => void;
  onSuccess: () => void;
  /** 선택된 플래너 ID (필수 - 플랜 그룹 생성 시 연결) */
  plannerId: string;
}

export const STEP_TITLES: Record<number, string> = {
  1: '콘텐츠 정보',
  2: '범위 설정',
  3: '배치 방식',
};

export const STEP_DESCRIPTIONS: Record<number, string> = {
  1: '추가할 콘텐츠의 기본 정보를 입력하세요',
  2: '학습 범위와 예상 볼륨을 설정하세요',
  3: '플랜 배치 방식을 선택하고 생성하세요',
};

export const initialWizardData = (targetDate: string): AddContentWizardData => ({
  // Step 1
  contentType: 'book',
  curriculum: '2022 개정',
  subjectArea: '',
  subject: '',
  title: '',
  linkMaster: false,
  masterContentId: undefined,
  masterContentTitle: undefined,

  // Step 2
  rangeType: 'page',
  rangeStart: '',
  rangeEnd: '',
  customRange: '',
  totalVolume: '',

  // Step 3
  distributionMode: 'today',
  periodStart: targetDate,
  periodEnd: '',
  useScheduler: false,
});
