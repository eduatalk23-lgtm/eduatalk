/**
 * 재조정 Job Queue 인터페이스
 * 
 * 대규모 재조정을 비동기로 처리하기 위한 Job Queue 인터페이스입니다.
 * 실제 구현은 Supabase Edge Function 또는 외부 Queue 서비스를 사용합니다.
 * 
 * @module lib/reschedule/jobQueue
 */

import type { AdjustmentInput } from './scheduleEngine';
import type { RescheduleResult } from '@/lib/domains/plan';

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 Job 상태
 */
export type RescheduleJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 재조정 Job
 */
export interface RescheduleJob {
  id: string;
  groupId: string;
  studentId: string;
  adjustments: AdjustmentInput[];
  status: RescheduleJobStatus;
  progress: number; // 0-100
  result?: RescheduleResult;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number; // 예상 소요 시간 (초)
}

/**
 * Job 생성 입력
 */
export interface CreateJobInput {
  groupId: string;
  studentId: string;
  adjustments: AdjustmentInput[];
  reason?: string;
}

// ============================================
// Job Queue 함수
// ============================================

/**
 * 재조정 Job 생성 (큐에 추가)
 * 
 * @param input Job 생성 입력
 * @returns 생성된 Job ID
 */
export async function enqueueRescheduleJob(
  input: CreateJobInput
): Promise<string> {
  // TODO: 실제 구현
  // 1. reschedule_log 테이블에 'pending' 상태로 레코드 생성
  // 2. Job Queue에 작업 추가 (Supabase Edge Function 또는 외부 Queue)
  // 3. Job ID 반환
  
  throw new Error('Not implemented: Job Queue는 향후 구현 예정입니다.');
}

/**
 * Job 상태 조회
 * 
 * @param jobId Job ID
 * @returns Job 상태
 */
export async function getRescheduleJobStatus(
  jobId: string
): Promise<RescheduleJob | null> {
  // TODO: 실제 구현
  // 1. reschedule_log 테이블에서 조회
  // 2. Job Queue에서 상태 조회
  // 3. 통합하여 반환
  
  throw new Error('Not implemented: Job Queue는 향후 구현 예정입니다.');
}

/**
 * Job 취소
 * 
 * @param jobId Job ID
 * @returns 취소 성공 여부
 */
export async function cancelRescheduleJob(
  jobId: string
): Promise<boolean> {
  // TODO: 실제 구현
  // 1. Job Queue에서 취소 요청
  // 2. reschedule_log 상태 업데이트
  
  throw new Error('Not implemented: Job Queue는 향후 구현 예정입니다.');
}

/**
 * Job 재시도
 * 
 * @param jobId Job ID
 * @returns 새 Job ID
 */
export async function retryRescheduleJob(
  jobId: string
): Promise<string> {
  // TODO: 실제 구현
  // 1. 기존 Job 정보 조회
  // 2. 새 Job 생성
  
  throw new Error('Not implemented: Job Queue는 향후 구현 예정입니다.');
}

// ============================================
// Job Queue 구현 체크
// ============================================

/**
 * Job Queue 구현 여부 확인
 * 
 * @returns 구현 여부
 */
export function isJobQueueEnabled(): boolean {
  // 환경 변수나 설정을 통해 확인
  return process.env.ENABLE_RESCHEDULE_JOB_QUEUE === 'true';
}

