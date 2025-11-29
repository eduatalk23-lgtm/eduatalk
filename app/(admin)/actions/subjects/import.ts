"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseExcelFile, validateExcelFile } from "@/lib/utils/excel";
import { z } from "zod";

// Zod 스키마 정의
const curriculumRevisionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  year: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    }
    return val ?? null;
  }),
  display_order: z.union([z.number(), z.string()]).default(0).transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    }
    return val ?? 0;
  }),
  is_active: z.union([z.boolean(), z.string()]).default(true).transform((val) => {
    if (typeof val === "string") {
      return val === "true" || val === "1" || val === "on";
    }
    return val ?? true;
  }),
});

const subjectGroupSchema = z.object({
  id: z.string().uuid().optional(),
  curriculum_revision_id: z.string().uuid().optional(),
  curriculum_revision_name: z.string().optional(),
  name: z.string().min(1),
  display_order: z.union([z.number(), z.string()]).default(0).transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    }
    return val ?? 0;
  }),
});

const subjectSchema = z.object({
  id: z.string().uuid().optional(),
  subject_group_id: z.string().uuid().optional(),
  subject_group_name: z.string().optional(),
  name: z.string().min(1),
  subject_type_id: z.string().uuid().optional().nullable(),
  subject_type_name: z.string().optional(),
  display_order: z.union([z.number(), z.string()]).default(0).transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    }
    return val ?? 0;
  }),
  is_active: z.union([z.boolean(), z.string()]).default(true).transform((val) => {
    if (typeof val === "string") {
      return val === "true" || val === "1" || val === "on";
    }
    return val ?? true;
  }),
});

const subjectTypeSchema = z.object({
  id: z.string().uuid().optional(),
  curriculum_revision_id: z.string().uuid().optional(),
  curriculum_revision_name: z.string().optional(),
  name: z.string().min(1),
  display_order: z.union([z.number(), z.string()]).default(0).transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    }
    return val ?? 0;
  }),
  is_active: z.union([z.boolean(), z.string()]).default(true).transform((val) => {
    if (typeof val === "string") {
      return val === "true" || val === "1" || val === "on";
    }
    return val ?? true;
  }),
});

/**
 * 교과/과목 관리 데이터를 Excel 파일에서 가져와 전체 교체
 */
export async function importSubjectsFromExcel(
  fileBuffer: Buffer | Uint8Array
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  // Uint8Array를 Buffer로 변환
  const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // Excel 파일 검증
  const validation = validateExcelFile(buffer, [
    "curriculum_revisions",
    "subject_groups",
    "subjects",
    "subject_types",
  ]);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || "Excel 파일 검증에 실패했습니다.",
    };
  }

  // Excel 파일 파싱
  const sheets = parseExcelFile(buffer);
  const errors: string[] = [];

  try {
    // 트랜잭션 시작 (Supabase는 자동 트랜잭션을 지원하지 않으므로 순차 처리)
    
    // 1. 기존 데이터 삭제 (외래키 제약조건 고려하여 역순으로 삭제)
    await supabase.from("subjects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("subject_groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("subject_types").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("curriculum_revisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. 개정교육과정 데이터 처리
    const curriculumRevisionsData = sheets.curriculum_revisions || [];
    const revisionMap = new Map<string, string>(); // name -> id 매핑
    const revisionIdMap = new Map<string, string>(); // 기존 id -> 새 id 매핑

    for (const row of curriculumRevisionsData) {
      try {
        const validated = curriculumRevisionSchema.parse(row);
        
        // ID가 있으면 기존 ID 사용, 없으면 새로 생성
        let revisionId = validated.id;
        if (!revisionId) {
          const { data: existing } = await supabase
            .from("curriculum_revisions")
            .select("id")
            .eq("name", validated.name)
            .maybeSingle();
          
          if (existing) {
            revisionId = existing.id;
          } else {
            const { data: newRevision, error } = await supabase
              .from("curriculum_revisions")
              .insert({
                name: validated.name,
                year: validated.year,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            revisionId = newRevision.id;
          }
        } else {
          // 기존 ID로 업데이트 또는 생성
          const { data: existing } = await supabase
            .from("curriculum_revisions")
            .select("id")
            .eq("id", revisionId)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from("curriculum_revisions")
              .update({
                name: validated.name,
                year: validated.year,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .eq("id", revisionId);
          } else {
            const { data: newRevision, error } = await supabase
              .from("curriculum_revisions")
              .insert({
                id: revisionId,
                name: validated.name,
                year: validated.year,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            revisionId = newRevision.id;
          }
        }
        
        if (revisionId) {
          revisionMap.set(validated.name, revisionId);
          if (validated.id) {
            revisionIdMap.set(validated.id, revisionId);
          }
        }
      } catch (error) {
        errors.push(`개정교육과정 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }

    // 3. 과목구분 데이터 처리 (개정교육과정이 먼저 필요)
    const subjectTypesData = sheets.subject_types || [];
    const subjectTypeMap = new Map<string, string>(); // (revision_name, type_name) -> id 매핑

    for (const row of subjectTypesData) {
      try {
        const validated = subjectTypeSchema.parse(row);
        
        // curriculum_revision_id 또는 curriculum_revision_name으로 개정교육과정 찾기
        let revisionId = validated.curriculum_revision_id;
        if (!revisionId && validated.curriculum_revision_name) {
          revisionId = revisionMap.get(validated.curriculum_revision_name);
        }
        
        if (!revisionId) {
          throw new Error(`개정교육과정을 찾을 수 없습니다: ${validated.curriculum_revision_name || validated.curriculum_revision_id}`);
        }

        let typeId = validated.id;
        if (!typeId) {
          const { data: existing } = await supabase
            .from("subject_types")
            .select("id")
            .eq("curriculum_revision_id", revisionId)
            .eq("name", validated.name)
            .maybeSingle();
          
          if (existing) {
            typeId = existing.id;
          } else {
            const { data: newType, error } = await supabase
              .from("subject_types")
              .insert({
                curriculum_revision_id: revisionId,
                name: validated.name,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            typeId = newType.id;
          }
        } else {
          const { data: existing } = await supabase
            .from("subject_types")
            .select("id")
            .eq("id", typeId)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from("subject_types")
              .update({
                curriculum_revision_id: revisionId,
                name: validated.name,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .eq("id", typeId);
          } else {
            const { data: newType, error } = await supabase
              .from("subject_types")
              .insert({
                id: typeId,
                curriculum_revision_id: revisionId,
                name: validated.name,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            typeId = newType.id;
          }
        }
        
        if (typeId) {
          const key = `${validated.curriculum_revision_name || revisionId}:${validated.name}`;
          subjectTypeMap.set(key, typeId);
        }
      } catch (error) {
        errors.push(`과목구분 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }

    // 4. 교과 그룹 데이터 처리
    const subjectGroupsData = sheets.subject_groups || [];
    const subjectGroupMap = new Map<string, string>(); // (revision_name, group_name) -> id 매핑

    for (const row of subjectGroupsData) {
      try {
        const validated = subjectGroupSchema.parse(row);
        
        // curriculum_revision_id 또는 curriculum_revision_name으로 개정교육과정 찾기
        let revisionId = validated.curriculum_revision_id;
        if (!revisionId && validated.curriculum_revision_name) {
          revisionId = revisionMap.get(validated.curriculum_revision_name);
        }
        
        if (!revisionId) {
          throw new Error(`개정교육과정을 찾을 수 없습니다: ${validated.curriculum_revision_name || validated.curriculum_revision_id}`);
        }

        let groupId = validated.id;
        if (!groupId) {
          const { data: existing } = await supabase
            .from("subject_groups")
            .select("id")
            .eq("curriculum_revision_id", revisionId)
            .eq("name", validated.name)
            .maybeSingle();
          
          if (existing) {
            groupId = existing.id;
          } else {
            const { data: newGroup, error } = await supabase
              .from("subject_groups")
              .insert({
                curriculum_revision_id: revisionId,
                name: validated.name,
                display_order: validated.display_order,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            groupId = newGroup.id;
          }
        } else {
          const { data: existing } = await supabase
            .from("subject_groups")
            .select("id")
            .eq("id", groupId)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from("subject_groups")
              .update({
                curriculum_revision_id: revisionId,
                name: validated.name,
                display_order: validated.display_order,
              })
              .eq("id", groupId);
          } else {
            const { data: newGroup, error } = await supabase
              .from("subject_groups")
              .insert({
                id: groupId,
                curriculum_revision_id: revisionId,
                name: validated.name,
                display_order: validated.display_order,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            groupId = newGroup.id;
          }
        }
        
        if (groupId) {
          const key = `${validated.curriculum_revision_name || revisionId}:${validated.name}`;
          subjectGroupMap.set(key, groupId);
        }
      } catch (error) {
        errors.push(`교과 그룹 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }

    // 5. 과목 데이터 처리 (교과 그룹과 과목구분이 먼저 필요)
    const subjectsData = sheets.subjects || [];

    for (const row of subjectsData) {
      try {
        const validated = subjectSchema.parse(row);
        
        // subject_group_id 또는 subject_group_name으로 교과 그룹 찾기
        let groupId = validated.subject_group_id;
        if (!groupId && validated.subject_group_name) {
          // revision_name도 함께 확인
          for (const [key, id] of subjectGroupMap.entries()) {
            if (key.endsWith(`:${validated.subject_group_name}`)) {
              groupId = id;
              break;
            }
          }
        }
        
        if (!groupId) {
          throw new Error(`교과 그룹을 찾을 수 없습니다: ${validated.subject_group_name || validated.subject_group_id}`);
        }

        // subject_type_id 또는 subject_type_name으로 과목구분 찾기
        let typeId = validated.subject_type_id;
        if (!typeId && validated.subject_type_name) {
          // revision_name도 함께 확인
          for (const [key, id] of subjectTypeMap.entries()) {
            if (key.endsWith(`:${validated.subject_type_name}`)) {
              typeId = id;
              break;
            }
          }
        }

        let subjectId = validated.id;
        if (!subjectId) {
          const { data: existing } = await supabase
            .from("subjects")
            .select("id")
            .eq("subject_group_id", groupId)
            .eq("name", validated.name)
            .maybeSingle();
          
          if (existing) {
            subjectId = existing.id;
          } else {
            const { data: newSubject, error } = await supabase
              .from("subjects")
              .insert({
                subject_group_id: groupId,
                name: validated.name,
                subject_type_id: typeId || null,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            subjectId = newSubject.id;
          }
        } else {
          const { data: existing } = await supabase
            .from("subjects")
            .select("id")
            .eq("id", subjectId)
            .maybeSingle();
          
          if (existing) {
            await supabase
              .from("subjects")
              .update({
                subject_group_id: groupId,
                name: validated.name,
                subject_type_id: typeId || null,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .eq("id", subjectId);
          } else {
            const { data: newSubject, error } = await supabase
              .from("subjects")
              .insert({
                id: subjectId,
                subject_group_id: groupId,
                name: validated.name,
                subject_type_id: typeId || null,
                display_order: validated.display_order,
                is_active: validated.is_active,
              })
              .select("id")
              .single();
            
            if (error) throw error;
            subjectId = newSubject.id;
          }
        }
      } catch (error) {
        errors.push(`과목 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }

    revalidatePath("/admin/subjects");

    if (errors.length > 0) {
      return {
        success: true,
        message: `데이터를 가져왔지만 일부 오류가 발생했습니다. (${errors.length}개 오류)`,
        errors,
      };
    }

    return {
      success: true,
      message: "데이터를 성공적으로 가져왔습니다.",
    };
  } catch (error) {
    return {
      success: false,
      message: `데이터 가져오기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      errors: [error instanceof Error ? error.message : "알 수 없는 오류"],
    };
  }
}

