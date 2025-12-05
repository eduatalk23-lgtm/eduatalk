/**
 * 기본 Repository 패턴
 * 공통 CRUD 작업을 위한 베이스 클래스
 */

import type { SupabaseServerClient } from "./types";
import { executeQuery, executeSingleQuery } from "./queryBuilder";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Repository 옵션
 */
export interface RepositoryOptions {
  /**
   * Supabase 클라이언트 (제공하지 않으면 자동 생성)
   */
  supabase?: SupabaseServerClient;
  /**
   * 테이블 이름
   */
  tableName: string;
  /**
   * 에러 로깅 컨텍스트
   */
  context?: string;
}

/**
 * 기본 Repository 클래스
 * 
 * @example
 * ```typescript
 * class StudentRepository extends BaseRepository<Student> {
 *   constructor(supabase?: SupabaseServerClient) {
 *     super({
 *       tableName: "students",
 *       context: "[data/students]",
 *       supabase,
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected supabase: SupabaseServerClient;
  protected tableName: string;
  protected context: string;

  constructor(options: RepositoryOptions) {
    this.tableName = options.tableName;
    this.context = options.context || `[data/${options.tableName}]`;
    this.supabase = options.supabase as SupabaseServerClient;
  }

  /**
   * Supabase 클라이언트 가져오기 (없으면 생성)
   */
  protected async getSupabase(): Promise<SupabaseServerClient> {
    if (this.supabase) {
      return this.supabase;
    }
    return await createSupabaseServerClient();
  }

  /**
   * ID로 단일 레코드 조회
   */
  async findById(id: string): Promise<T | null> {
    const supabase = await this.getSupabase();
    return executeSingleQuery<T>(
      async () => {
        const result = await supabase
          .from(this.tableName)
          .select("*")
          .eq("id", id)
          .maybeSingle();
        return result;
      },
      {
        context: this.context,
        defaultValue: null,
      }
    );
  }

  /**
   * 여러 ID로 레코드 조회
   */
  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }

    const supabase = await this.getSupabase();
    const result = await executeQuery<T[]>(
      async () => {
        const queryResult = await supabase
          .from(this.tableName)
          .select("*")
          .in("id", ids);
        return queryResult;
      },
      {
        context: this.context,
        defaultValue: [],
      }
    );

    return result ?? [];
  }

  /**
   * 레코드 생성
   */
  async create(data: Omit<T, "id" | "created_at" | "updated_at">): Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }> {
    const supabase = await this.getSupabase();
    const { data: created, error } = await supabase
      .from(this.tableName)
      .insert(data as unknown)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "생성에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: created as T,
    };
  }

  /**
   * 레코드 업데이트
   */
  async update(
    id: string,
    data: Partial<Omit<T, "id" | "created_at" | "updated_at">>
  ): Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }> {
    const supabase = await this.getSupabase();
    const { data: updated, error } = await supabase
      .from(this.tableName)
      .update(data as unknown)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "업데이트에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: updated as T,
    };
  }

  /**
   * 레코드 삭제 (Hard Delete)
   */
  async delete(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const supabase = await this.getSupabase();
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message || "삭제에 실패했습니다.",
      };
    }

    return { success: true };
  }

  /**
   * 레코드 Soft Delete (deleted_at 설정)
   */
  async softDelete(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const supabase = await this.getSupabase();
    const { error } = await supabase
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message || "삭제에 실패했습니다.",
      };
    }

    return { success: true };
  }
}

