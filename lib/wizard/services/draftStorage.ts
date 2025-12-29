/**
 * Draft Storage Service
 *
 * 위저드 드래프트 데이터의 저장 및 복원을 관리하는 서비스
 * localStorage와 서버 동기화를 지원
 *
 * @module lib/wizard/services/draftStorage
 */

import type { UnifiedWizardData } from "../types";

// ============================================
// 타입 정의
// ============================================

export interface DraftMetadata {
  /** 드래프트 ID */
  id: string;
  /** 위저드 모드 */
  mode: UnifiedWizardData["mode"];
  /** 마지막 저장 시간 */
  savedAt: string;
  /** 현재 단계 ID */
  currentStepId: string;
  /** 만료 시간 (밀리초) */
  expiresAt: number;
  /** 사용자 ID (선택) */
  userId?: string;
  /** 추가 메타데이터 */
  extra?: Record<string, unknown>;
}

export interface StoredDraft<T extends UnifiedWizardData = UnifiedWizardData> {
  metadata: DraftMetadata;
  data: T;
}

export interface DraftStorageOptions {
  /** 저장소 키 접두사 */
  keyPrefix?: string;
  /** 기본 만료 시간 (밀리초, 기본: 7일) */
  defaultTTL?: number;
  /** 서버 동기화 함수 (선택) */
  serverSync?: {
    save: (draft: StoredDraft) => Promise<void>;
    load: (draftId: string) => Promise<StoredDraft | null>;
    delete: (draftId: string) => Promise<void>;
    list: (userId?: string) => Promise<DraftMetadata[]>;
  };
}

// ============================================
// 상수
// ============================================

const DEFAULT_KEY_PREFIX = "wizard_draft_";
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7일
const DRAFT_LIST_KEY = "wizard_draft_list";

// ============================================
// 유틸리티 함수
// ============================================

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

// ============================================
// 클래스 정의
// ============================================

/**
 * DraftStorageService
 *
 * 위저드 드래프트 데이터를 관리하는 서비스
 */
export class DraftStorageService {
  private keyPrefix: string;
  private defaultTTL: number;
  private serverSync?: DraftStorageOptions["serverSync"];

  constructor(options: DraftStorageOptions = {}) {
    this.keyPrefix = options.keyPrefix || DEFAULT_KEY_PREFIX;
    this.defaultTTL = options.defaultTTL || DEFAULT_TTL;
    this.serverSync = options.serverSync;
  }

  /**
   * 드래프트 저장
   */
  async save<T extends UnifiedWizardData>(
    data: T,
    options: {
      draftId?: string;
      userId?: string;
      ttl?: number;
      extra?: Record<string, unknown>;
    } = {}
  ): Promise<string> {
    const draftId = options.draftId || generateDraftId();
    const now = new Date().toISOString();
    const expiresAt = Date.now() + (options.ttl || this.defaultTTL);

    const metadata: DraftMetadata = {
      id: draftId,
      mode: data.mode,
      savedAt: now,
      currentStepId: data.currentStepId,
      expiresAt,
      userId: options.userId,
      extra: options.extra,
    };

    const draft: StoredDraft<T> = {
      metadata,
      data,
    };

    // localStorage 저장
    try {
      const key = this.getKey(draftId);
      localStorage.setItem(key, JSON.stringify(draft));
      this.updateDraftList(metadata);
    } catch (error) {
      console.error("[DraftStorage] localStorage 저장 실패:", error);
    }

    // 서버 동기화
    if (this.serverSync) {
      try {
        await this.serverSync.save(draft);
      } catch (error) {
        console.error("[DraftStorage] 서버 동기화 실패:", error);
        // 서버 실패해도 로컬 저장은 유지
      }
    }

    return draftId;
  }

  /**
   * 드래프트 로드
   */
  async load<T extends UnifiedWizardData>(
    draftId: string
  ): Promise<StoredDraft<T> | null> {
    // localStorage에서 먼저 시도
    try {
      const key = this.getKey(draftId);
      const stored = localStorage.getItem(key);

      if (stored) {
        const draft = JSON.parse(stored) as StoredDraft<T>;

        // 만료 확인
        if (isExpired(draft.metadata.expiresAt)) {
          await this.delete(draftId);
          return null;
        }

        return draft;
      }
    } catch (error) {
      console.error("[DraftStorage] localStorage 로드 실패:", error);
    }

    // 서버에서 시도
    if (this.serverSync) {
      try {
        const serverDraft = await this.serverSync.load(draftId);
        if (serverDraft && !isExpired(serverDraft.metadata.expiresAt)) {
          // 로컬에 캐시
          const key = this.getKey(draftId);
          localStorage.setItem(key, JSON.stringify(serverDraft));
          return serverDraft as StoredDraft<T>;
        }
      } catch (error) {
        console.error("[DraftStorage] 서버 로드 실패:", error);
      }
    }

    return null;
  }

  /**
   * 드래프트 삭제
   */
  async delete(draftId: string): Promise<void> {
    // localStorage에서 삭제
    try {
      const key = this.getKey(draftId);
      localStorage.removeItem(key);
      this.removeDraftFromList(draftId);
    } catch (error) {
      console.error("[DraftStorage] localStorage 삭제 실패:", error);
    }

    // 서버에서 삭제
    if (this.serverSync) {
      try {
        await this.serverSync.delete(draftId);
      } catch (error) {
        console.error("[DraftStorage] 서버 삭제 실패:", error);
      }
    }
  }

  /**
   * 모든 드래프트 목록 조회
   */
  async list(userId?: string): Promise<DraftMetadata[]> {
    const localList = this.getLocalDraftList();

    // 만료된 드래프트 정리
    const validList = localList.filter((meta) => {
      if (isExpired(meta.expiresAt)) {
        this.delete(meta.id); // 비동기로 삭제
        return false;
      }
      return true;
    });

    // 사용자 ID로 필터링
    if (userId) {
      return validList.filter((meta) => meta.userId === userId);
    }

    return validList;
  }

  /**
   * 모드별 최신 드래프트 조회
   */
  async getLatestByMode<T extends UnifiedWizardData>(
    mode: UnifiedWizardData["mode"],
    userId?: string
  ): Promise<StoredDraft<T> | null> {
    const list = await this.list(userId);
    const filtered = list
      .filter((meta) => meta.mode === mode)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    if (filtered.length === 0) {
      return null;
    }

    return this.load<T>(filtered[0].id);
  }

  /**
   * 만료된 드래프트 정리
   */
  async cleanup(): Promise<number> {
    const list = this.getLocalDraftList();
    let cleanedCount = 0;

    for (const meta of list) {
      if (isExpired(meta.expiresAt)) {
        await this.delete(meta.id);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 모든 드래프트 삭제
   */
  async clearAll(): Promise<void> {
    const list = this.getLocalDraftList();

    for (const meta of list) {
      await this.delete(meta.id);
    }

    try {
      localStorage.removeItem(this.getListKey());
    } catch (error) {
      console.error("[DraftStorage] 드래프트 목록 삭제 실패:", error);
    }
  }

  // ============================================
  // Private 메서드
  // ============================================

  private getKey(draftId: string): string {
    return `${this.keyPrefix}${draftId}`;
  }

  private getListKey(): string {
    return `${this.keyPrefix}${DRAFT_LIST_KEY}`;
  }

  private getLocalDraftList(): DraftMetadata[] {
    try {
      const stored = localStorage.getItem(this.getListKey());
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private updateDraftList(metadata: DraftMetadata): void {
    try {
      const list = this.getLocalDraftList();
      const existingIndex = list.findIndex((m) => m.id === metadata.id);

      if (existingIndex >= 0) {
        list[existingIndex] = metadata;
      } else {
        list.push(metadata);
      }

      localStorage.setItem(this.getListKey(), JSON.stringify(list));
    } catch (error) {
      console.error("[DraftStorage] 드래프트 목록 업데이트 실패:", error);
    }
  }

  private removeDraftFromList(draftId: string): void {
    try {
      const list = this.getLocalDraftList();
      const filtered = list.filter((m) => m.id !== draftId);
      localStorage.setItem(this.getListKey(), JSON.stringify(filtered));
    } catch (error) {
      console.error("[DraftStorage] 드래프트 목록에서 제거 실패:", error);
    }
  }
}

// ============================================
// 기본 인스턴스
// ============================================

/**
 * 기본 드래프트 저장소 인스턴스
 */
export const draftStorage = new DraftStorageService();
