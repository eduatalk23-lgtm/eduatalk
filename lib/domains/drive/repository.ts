/**
 * Drive Repository
 * DB CRUD for files, file_contexts, file_requests
 */

import { createSupabaseAdminClient, type SupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DriveFile,
  DriveFileInsert,
  FileContext,
  FileContextType,
  FileRequest,
  FileRequestStatus,
  FileRequestWithStudent,
  FileDistribution,
  DistributionTracking,
  RequestTemplate,
  CustomFileCategory,
  DriveFileFilter,
} from "./types";

const FILE_DISTRIBUTIONS_TABLE = "file_distributions" as const;
const REQUEST_TEMPLATES_TABLE = "request_templates" as const;
const FILE_CATEGORIES_TABLE = "file_categories" as const;

function getAdmin(): SupabaseAdminClient {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Admin client not available");
  return client;
}

// =============================================================================
// Files
// =============================================================================

export async function insertFile(data: DriveFileInsert): Promise<DriveFile> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from("files")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`[DriveRepo] insertFile: ${error.message}`);
  return row as DriveFile;
}

/** Insert file with nullable student_id (for distribution source files) */
export async function insertDistributionSourceFile(
  data: Omit<DriveFileInsert, "student_id"> & { student_id: null }
): Promise<DriveFile> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from("files")
    // student_id is intentionally null for distribution source files
    .insert(data as unknown as DriveFileInsert)
    .select()
    .single();

  if (error) throw new Error(`[DriveRepo] insertDistributionSourceFile: ${error.message}`);
  return row as DriveFile;
}

export async function getFileById(id: string): Promise<DriveFile | null> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as DriveFile;
}

export async function getFilesByStudent(
  studentId: string,
  filter?: DriveFileFilter
): Promise<DriveFile[]> {
  const supabase = getAdmin();
  let query = supabase
    .from("files")
    .select("*")
    .eq("student_id", studentId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (filter?.category) {
    query = query.eq("category", filter.category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[DriveRepo] getFilesByStudent:", error.message);
    return [];
  }

  // context_type 필터가 있으면 file_contexts를 확인
  if (filter?.contextType) {
    const fileIds = (data as DriveFile[]).map((f) => f.id);
    const contexts = await getContextsByFileIds(fileIds);
    return (data as DriveFile[]).filter((f) =>
      contexts.some(
        (c) => c.file_id === f.id && c.context_type === filter.contextType
      )
    );
  }

  return (data ?? []) as DriveFile[];
}

export async function getFilesByVersionGroup(
  versionGroupId: string
): Promise<DriveFile[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("version_group_id", versionGroupId)
    .order("version_number", { ascending: true });

  if (error) return [];
  return (data ?? []) as DriveFile[];
}

export async function deleteFileById(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase.from("files").delete().eq("id", id);
  if (error) {
    console.error("[DriveRepo] deleteFileById:", error.message);
    return false;
  }
  return true;
}

export async function findExpiredFiles(
  batchSize: number = 50
): Promise<DriveFile[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .lt("expires_at", new Date().toISOString())
    .limit(batchSize);

  if (error) return [];
  return (data ?? []) as DriveFile[];
}

export async function updateFileExpiry(
  fileId: string,
  expiresAt: string
): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from("files")
    .update({ expires_at: expiresAt })
    .eq("id", fileId);

  if (error) {
    console.error("[DriveRepo] updateFileExpiry:", error.message);
    return false;
  }
  return true;
}

export async function deleteFilesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getAdmin();
  const { error } = await supabase.from("files").delete().in("id", ids);
  if (error) {
    console.error("[DriveRepo] deleteFilesByIds:", error.message);
  }
}

// =============================================================================
// File Contexts
// =============================================================================

export async function insertFileContext(data: {
  file_id: string;
  context_type: FileContextType;
  context_id?: string | null;
}): Promise<FileContext> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from("file_contexts")
    .insert({
      file_id: data.file_id,
      context_type: data.context_type,
      context_id: data.context_id ?? null,
    })
    .select()
    .single();

  if (error)
    throw new Error(`[DriveRepo] insertFileContext: ${error.message}`);
  return row as FileContext;
}

export async function getContextsByFileIds(
  fileIds: string[]
): Promise<FileContext[]> {
  if (fileIds.length === 0) return [];
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("file_contexts")
    .select("*")
    .in("file_id", fileIds);

  if (error) return [];
  return (data ?? []) as FileContext[];
}

// =============================================================================
// File Requests (Workflow)
// =============================================================================

export async function insertFileRequest(data: {
  tenant_id: string;
  student_id: string;
  created_by: string;
  title: string;
  description?: string | null;
  category: string;
  allowed_mime_types?: string[] | null;
  deadline?: string | null;
}): Promise<FileRequest> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from("file_requests")
    .insert(data)
    .select()
    .single();

  if (error)
    throw new Error(`[DriveRepo] insertFileRequest: ${error.message}`);
  return row as FileRequest;
}

export async function getFileRequestById(
  id: string
): Promise<FileRequest | null> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("file_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as FileRequest;
}

export async function getFileRequestsByStudent(
  studentId: string,
  status?: FileRequestStatus
): Promise<FileRequest[]> {
  const supabase = getAdmin();
  let query = supabase
    .from("file_requests")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as FileRequest[];
}

export async function updateFileRequestStatus(
  id: string,
  update: {
    status: FileRequestStatus;
    rejection_reason?: string | null;
    approved_file_id?: string | null;
  }
): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from("file_requests")
    .update(update)
    .eq("id", id);

  if (error) {
    console.error("[DriveRepo] updateFileRequestStatus:", error.message);
    return false;
  }
  return true;
}

export async function linkCalendarEventToRequest(
  requestId: string,
  calendarEventId: string
): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from("file_requests")
    .update({ calendar_event_id: calendarEventId })
    .eq("id", requestId);

  if (error) {
    console.error("[DriveRepo] linkCalendarEventToRequest:", error.message);
    return false;
  }
  return true;
}

export async function deleteFileRequest(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase.from("file_requests").delete().eq("id", id);
  if (error) {
    console.error("[DriveRepo] deleteFileRequest:", error.message);
    return false;
  }
  return true;
}

/**
 * 워크플로우 요청에 연결된 파일 조회 (제출된 파일들)
 */
export async function getFilesForRequest(
  requestId: string
): Promise<DriveFile[]> {
  const supabase = getAdmin();

  // file_contexts를 통해 해당 요청에 연결된 파일 조회
  const { data: contexts, error: ctxError } = await supabase
    .from("file_contexts")
    .select("file_id")
    .eq("context_type", "workflow")
    .eq("context_id", requestId);

  if (ctxError || !contexts || contexts.length === 0) return [];

  const fileIds = contexts.map(
    (c: { file_id: string }) => c.file_id
  );
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .in("id", fileIds)
    .order("version_number", { ascending: true });

  if (error) return [];
  return (data ?? []) as DriveFile[];
}

// =============================================================================
// File Requests (Tenant-wide)
// =============================================================================

export async function getFileRequestsByTenant(
  tenantId: string,
  options?: {
    status?: FileRequestStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<FileRequestWithStudent[]> {
  const supabase = getAdmin();
  const hasSearch = !!options?.search;

  // search가 있으면 학생 이름으로 먼저 student_id 목록을 구한 뒤 DB에서 필터
  let searchStudentIds: string[] | null = null;
  if (hasSearch) {
    const { data: matchedProfiles } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("name", `%${options!.search!.replace(/[%_]/g, "\\$&")}%`);

    // user_profiles.id = students.id (same user ID)
    searchStudentIds = (matchedProfiles ?? []).map(
      (s: { id: string }) => s.id
    );
    if (searchStudentIds.length === 0) return [];
  }

  let query = supabase
    .from("file_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (searchStudentIds) {
    query = query.in("student_id", searchStudentIds);
  }
  if (options?.limit) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data: requests, error } = await query;
  if (error || !requests) return [];

  const studentIds = [
    ...new Set((requests as FileRequest[]).map((r) => r.student_id)),
  ];
  if (studentIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, name")
    .in("id", studentIds);

  const nameMap = new Map(
    (profiles ?? []).map((s: { id: string; name: string | null }) => [
      s.id,
      s.name ?? "이름 없음",
    ])
  );

  return (requests as FileRequest[]).map((r) => ({
    ...r,
    student_name: nameMap.get(r.student_id) ?? "이름 없음",
  }));
}

export async function getFileRequestKpiCounts(
  tenantId: string
): Promise<{ pending: number; submitted: number; overdue: number }> {
  const supabase = getAdmin();

  const [pendingRes, submittedRes, overdueRes] = await Promise.all([
    supabase
      .from("file_requests")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    supabase
      .from("file_requests")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "submitted"),
    supabase
      .from("file_requests")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "overdue"),
  ]);

  return {
    pending: pendingRes.count ?? 0,
    submitted: submittedRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
  };
}

// =============================================================================
// File Distributions
// =============================================================================

export async function insertDistribution(data: {
  tenant_id: string;
  file_id: string;
  student_id: string;
  distributed_by: string;
  title: string;
  description?: string | null;
  expires_at: string;
}): Promise<FileDistribution> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`[DriveRepo] insertDistribution: ${error.message}`);
  return row as FileDistribution;
}

export async function getDistributionsByStudent(
  studentId: string
): Promise<FileDistribution[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .select("*")
    .eq("student_id", studentId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as FileDistribution[];
}

export async function getDistributionsByTenantFile(
  tenantId: string,
  fileId: string
): Promise<FileDistribution[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("file_id", fileId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as FileDistribution[];
}

export async function getDistributionById(
  id: string
): Promise<FileDistribution | null> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as FileDistribution;
}

export async function updateDistributionViewed(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", id)
    .is("viewed_at", null);

  if (error) {
    console.error("[DriveRepo] updateDistributionViewed:", error.message);
    return false;
  }
  return true;
}

export async function updateDistributionDownloaded(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .update({ downloaded_at: new Date().toISOString() })
    .eq("id", id)
    .is("downloaded_at", null);

  if (error) {
    console.error("[DriveRepo] updateDistributionDownloaded:", error.message);
    return false;
  }
  return true;
}

export async function deleteDistribution(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[DriveRepo] deleteDistribution:", error.message);
    return false;
  }
  return true;
}

export async function deleteDistributionsByFile(fileId: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .delete()
    .eq("file_id", fileId);

  if (error) {
    console.error("[DriveRepo] deleteDistributionsByFile:", error.message);
    return false;
  }
  return true;
}

export async function getDistributionTracking(
  fileId: string
): Promise<DistributionTracking[]> {
  const supabase = getAdmin();
  const { data: dists, error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .select("id, student_id, viewed_at, downloaded_at")
    .eq("file_id", fileId);

  if (error || !dists || dists.length === 0) return [];

  const rows = dists as Array<{
    id: string;
    student_id: string;
    viewed_at: string | null;
    downloaded_at: string | null;
  }>;

  const studentIds = [...new Set(rows.map((d) => d.student_id))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, name")
    .in("id", studentIds);

  const nameMap = new Map(
    (profiles ?? []).map((s) => [s.id, s.name ?? "이름 없음"])
  );

  return rows.map((d) => ({
    distribution_id: d.id,
    student_id: d.student_id,
    student_name: nameMap.get(d.student_id) ?? "이름 없음",
    viewed_at: d.viewed_at,
    downloaded_at: d.downloaded_at,
  }));
}

export async function findExpiredDistributions(
  batchSize: number = 50
): Promise<FileDistribution[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from(FILE_DISTRIBUTIONS_TABLE)
    .select("*")
    .lt("expires_at", new Date().toISOString())
    .limit(batchSize);

  if (error) return [];
  return (data ?? []) as FileDistribution[];
}

// =============================================================================
// Request Templates
// =============================================================================

export async function getTemplatesByTenant(
  tenantId: string
): Promise<RequestTemplate[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from(REQUEST_TEMPLATES_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (error) return [];
  return (data ?? []) as RequestTemplate[];
}

export async function insertTemplate(data: {
  tenant_id: string;
  name: string;
  title: string;
  description?: string | null;
  category: string;
  allowed_mime_types?: string[] | null;
  deadline_days?: number | null;
  created_by: string;
}): Promise<RequestTemplate> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from(REQUEST_TEMPLATES_TABLE)
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`[DriveRepo] insertTemplate: ${error.message}`);
  return row as RequestTemplate;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from(REQUEST_TEMPLATES_TABLE)
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("[DriveRepo] deleteTemplate:", error.message);
    return false;
  }
  return true;
}

// =============================================================================
// Custom File Categories
// =============================================================================

export async function getCategoriesByTenant(
  tenantId: string
): Promise<CustomFileCategory[]> {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from(FILE_CATEGORIES_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) return [];
  return (data ?? []) as CustomFileCategory[];
}

export async function insertCategory(data: {
  tenant_id: string;
  key: string;
  label: string;
  sort_order?: number;
}): Promise<CustomFileCategory> {
  const supabase = getAdmin();
  const { data: row, error } = await supabase
    .from(FILE_CATEGORIES_TABLE)
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`[DriveRepo] insertCategory: ${error.message}`);
  return row as CustomFileCategory;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const supabase = getAdmin();
  const { error } = await supabase
    .from(FILE_CATEGORIES_TABLE)
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("[DriveRepo] deleteCategory:", error.message);
    return false;
  }
  return true;
}
