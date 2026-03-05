"use server";

/**
 * Save Chat Attachment to Drive
 * 채팅 첨부파일을 드라이브로 복사 (cross-bucket copy)
 */

import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as repo from "../repository";
import * as driveStorage from "../storage";
import { getStudentDriveUsage, isQuotaExceeded } from "../quota";
import { DRIVE_EXPIRY_DAYS, type FileCategory } from "../types";

const CHAT_BUCKET = "chat-attachments";

export async function saveChatAttachmentToDriveAction(input: {
  attachmentId: string;
  category?: FileCategory;
}): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const auth = await resolveAuthContext({});
    const studentId = auth.studentId;
    const tenantId = auth.tenantId;

    // 1. Fetch chat attachment metadata
    const admin = createSupabaseAdminClient();
    if (!admin) return { success: false, error: "서버 오류" };

    const { data: attachment, error: fetchErr } = await admin
      .from("chat_attachments")
      .select("*")
      .eq("id", input.attachmentId)
      .single();

    if (fetchErr || !attachment) {
      return { success: false, error: "첨부파일을 찾을 수 없습니다." };
    }

    // 1-b. Verify ownership: attachment must belong to a chat room the user is a member of
    if (attachment.message_id) {
      const { data: message } = await admin
        .from("chat_messages")
        .select("room_id")
        .eq("id", attachment.message_id)
        .single();

      if (message?.room_id) {
        const { count } = await admin
          .from("chat_room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", message.room_id)
          .eq("user_id", auth.userId);

        if (!count || count === 0) {
          return { success: false, error: "접근 권한이 없는 첨부파일입니다." };
        }
      }
    }

    // 2. Check quota
    if (studentId) {
      const usage = await getStudentDriveUsage(studentId);
      if (isQuotaExceeded(usage, attachment.file_size)) {
        return { success: false, error: "스토리지 용량이 부족합니다." };
      }
    }

    // 3. Download file from chat bucket
    const { data: fileData, error: downloadErr } = await admin.storage
      .from(CHAT_BUCKET)
      .download(attachment.storage_path);

    if (downloadErr || !fileData) {
      return { success: false, error: "파일 다운로드에 실패했습니다." };
    }

    // 4. Upload to drive bucket
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const ownerDir = studentId ?? "_shared";
    const storagePath = `${tenantId}/${ownerDir}/chat/${crypto.randomUUID()}_${attachment.file_name}`;

    const uploaded = await driveStorage.uploadFile(storagePath, buffer, attachment.mime_type);
    if (!uploaded) {
      return { success: false, error: "파일 저장에 실패했습니다." };
    }

    // 5. Create DB record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DRIVE_EXPIRY_DAYS);

    const category = input.category ?? detectCategory(attachment.mime_type);
    const uploaderRole = isAdminContext(auth) ? "admin" as const : "student" as const;

    const driveFile = await repo.insertFile({
      tenant_id: tenantId,
      student_id: studentId,
      uploaded_by: auth.userId,
      uploaded_by_role: uploaderRole,
      original_name: attachment.file_name,
      storage_path: storagePath,
      mime_type: attachment.mime_type,
      size_bytes: attachment.file_size,
      category,
      expires_at: expiresAt.toISOString(),
    });

    // 6. Create file context linking to chat message
    await repo.insertFileContext({
      file_id: driveFile.id,
      context_type: "chat",
      context_id: attachment.message_id ?? null,
    });

    return { success: true, fileId: driveFile.id };
  } catch (err) {
    console.error("[ChatSave] saveChatAttachmentToDrive error:", err);
    return { success: false, error: "파일 저장 중 오류가 발생했습니다." };
  }
}

// TODO: Implement smarter category detection based on mime type or filename
function detectCategory(_mimeType: string): FileCategory {
  return "transcript";
}
