"use server";

/**
 * Chat Attachment Server Actions
 * 파일 업로드, 첨부파일 포함 메시지 전송, 첨부파일 삭제
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as chatService from "../service";
import * as repository from "../repository";
import { extractUrls, fetchLinkPreview } from "../linkPreview";
import {
  getAttachmentType,
  sanitizeFileName,
} from "../fileValidation";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  type ChatActionResult,
  type ChatAttachment,
  type ChatAttachmentInsert,
  type ChatMessage,
  type ChatMessageType,
  type ChatUserType,
} from "../types";
import { createSignedUrl, refreshExpiredAttachmentUrls } from "../storage";
import { verifyMimeType, HEADER_SIZE } from "../mimeVerification";
import {
  getStorageLimitForRole,
  isQuotaExceeded,
  formatStorageSize,
  type StorageQuotaInfo,
} from "../quota";
import { routeNotification } from "@/lib/domains/notification/router";
import type { UserRole } from "@/lib/auth/getCurrentUserRole";

// ============================================
// 경량 auth 헬퍼 (JWT 쿠키 파싱, 네트워크 0)
// ============================================

import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";

/** JWT 쿠키에서 userId 추출 (네트워크 0, DB 0) */
async function getSessionUserId(): Promise<string | null> {
  const user = await getCachedAuthUser();
  return user?.id ?? null;
}

/** JWT metadata에서 userId + role 추출 (네트워크 0, DB 0) */
async function getSessionUserWithRole(): Promise<{ userId: string; role: UserRole; userType: ChatUserType } | null> {
  const { userId, role } = await getCachedUserRole();
  if (!userId || !role) return null;

  const userType: ChatUserType = (role === "admin" || role === "consultant") ? "admin" : role === "parent" ? "parent" : "student";
  return { userId, role, userType };
}

/** 멤버십 확인 (userType 불필요 — user_id가 방 내 유일) */
async function checkMembership(roomId: string, userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("chat_room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .is("left_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  return !!data;
}

const STORAGE_BUCKET = "chat-attachments";

/**
 * 채팅 파일 업로드 (메시지 전송 전 선 업로드)
 *
 * Vercel Hobby 4.5MB body 제한 때문에 대용량 파일은 클라이언트에서
 * 직접 Supabase Storage로 업로드해야 합니다.
 * 이 액션은 업로드 완료 후 DB 레코드만 생성합니다.
 *
 * @param roomId 채팅방 ID
 * @param storagePath 업로드된 파일의 storage path
 * @param fileName 원본 파일명
 * @param fileSize 파일 크기 (bytes)
 * @param mimeType MIME 타입
 * @param width 이미지 너비 (옵션)
 * @param height 이미지 높이 (옵션)
 */
export async function registerChatAttachmentAction(
  roomId: string,
  storagePath: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  width?: number | null,
  height?: number | null,
  thumbnailPath?: string | null
): Promise<ChatActionResult<ChatAttachment>> {
  try {
    const auth = await getSessionUserWithRole();
    if (!auth) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const { userId, role } = auth;

    // 채팅방 멤버 확인
    if (!await checkMembership(roomId, userId)) {
      return { success: false, error: "채팅방에 참여하지 않았습니다." };
    }

    // 스토리지 쿼터 확인
    const currentUsage = await repository.getUserStorageUsage(userId);
    const storageLimit = getStorageLimitForRole(role);
    if (isQuotaExceeded(currentUsage, fileSize, storageLimit)) {
      const remaining = Math.max(0, storageLimit - currentUsage);
      return {
        success: false,
        error: `스토리지 용량을 초과했습니다. 남은 용량: ${formatStorageSize(remaining)}`,
      };
    }

    // 서버측 MIME 검증 (magic bytes)
    // 임시 signed URL로 헤더 16바이트만 Range 요청
    const supabase = createSupabaseAdminClient()!;
    try {
      const { data: tempUrlData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 60);

      if (tempUrlData?.signedUrl) {
        const headResponse = await fetch(tempUrlData.signedUrl, {
          headers: { Range: `bytes=0-${HEADER_SIZE - 1}` },
        });

        if (headResponse.ok || headResponse.status === 206) {
          const headerBuffer = await headResponse.arrayBuffer();
          const headerBytes = new Uint8Array(headerBuffer);

          if (!verifyMimeType(headerBytes, mimeType)) {
            // 위조된 파일 → Storage에서 삭제
            await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
            if (thumbnailPath) {
              await supabase.storage.from(STORAGE_BUCKET).remove([thumbnailPath]);
            }
            return { success: false, error: "파일 형식이 올바르지 않습니다." };
          }
        }
      }
    } catch (verifyErr) {
      console.error("[registerChatAttachmentAction] MIME verification error:", verifyErr);
      // 검증 실패 시에도 업로드는 허용 (네트워크 이슈 가능)
    }

    // Signed URL 생성 (private 버킷)
    const signedUrl = await createSignedUrl(storagePath);
    if (!signedUrl) {
      return { success: false, error: "파일 URL 생성 실패" };
    }

    // 썸네일 signed URL 생성
    let thumbnailUrl: string | null = null;
    if (thumbnailPath) {
      thumbnailUrl = await createSignedUrl(thumbnailPath);
    }

    const attachmentType = getAttachmentType(mimeType);

    const insertData: ChatAttachmentInsert = {
      message_id: null, // 메시지 전송 시 linkAttachmentsToMessage로 연결
      room_id: roomId,
      file_name: sanitizeFileName(fileName),
      file_size: fileSize,
      mime_type: mimeType,
      storage_path: storagePath,
      public_url: signedUrl,
      thumbnail_url: thumbnailUrl,
      thumbnail_storage_path: thumbnailPath ?? null,
      width: width ?? null,
      height: height ?? null,
      attachment_type: attachmentType,
      sender_id: userId,
    };

    const attachment = await repository.insertAttachment(insertData);

    return { success: true, data: attachment };
  } catch (error) {
    console.error("[registerChatAttachmentAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "첨부파일 등록 실패",
    };
  }
}

/**
 * 첨부파일 포함 메시지 전송
 *
 * @param roomId 채팅방 ID
 * @param content 텍스트 내용 (첨부파일만 있으면 빈 문자열 가능)
 * @param attachmentIds 등록된 첨부파일 ID 배열
 * @param replyToId 답장 대상 메시지 ID (선택)
 * @param clientMessageId 클라이언트 메시지 ID (중복 방지)
 */
export async function sendMessageWithAttachmentsAction(
  roomId: string,
  content: string,
  attachmentIds: string[],
  replyToId?: string | null,
  clientMessageId?: string
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const auth = await getSessionUserWithRole();
    if (!auth) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const { userId, userType } = auth;
    const hasText = content.trim().length > 0;
    const hasAttachments = attachmentIds.length > 0;

    if (!hasText && !hasAttachments) {
      return { success: false, error: "메시지 내용 또는 첨부파일이 필요합니다." };
    }

    if (attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return {
        success: false,
        error: `첨부파일은 최대 ${MAX_ATTACHMENTS_PER_MESSAGE}개까지 가능합니다.`,
      };
    }

    // message_type 결정
    let messageType: ChatMessageType = "text";
    if (hasAttachments && hasText) {
      messageType = "mixed";
    } else if (hasAttachments) {
      // 첨부파일 타입에 따라 image 또는 file
      const attachments = await repository.findAttachmentsByIds(attachmentIds);
      const allImages = attachments.every((a) => a.attachment_type === "image");
      messageType = allImages ? "image" : "file";
    }

    // 메시지 전송 (content가 비어있으면 placeholder)
    const messageContent = hasText ? content : " ";
    const result = await chatService.sendMessage(userId, userType, {
      roomId,
      content: messageContent,
      messageType,
      replyToId,
      clientMessageId,
    });

    if (!result.success || !result.data) {
      return result;
    }

    // 첨부파일들을 이 메시지에 연결
    if (hasAttachments) {
      await repository.linkAttachmentsToMessage(
        result.data.id,
        attachmentIds,
        userId
      );
    }

    // 링크 프리뷰 추출 (fire-and-forget)
    if (hasText) {
      extractAndSaveLinkPreviews(result.data.id, content).catch((err) =>
        console.error("[LinkPreview] Error:", err)
      );
    }

    // Push 알림 (fire-and-forget)
    sendChatPushNotification(roomId, userId, result.data, hasAttachments).catch(
      (err) => console.error("[Chat Push] Notification failed:", err)
    );

    return result;
  } catch (error) {
    console.error("[sendMessageWithAttachmentsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 전송 실패",
    };
  }
}

/**
 * 첨부파일 삭제 (본인 파일만, 메시지 연결 전)
 */
export async function deleteChatAttachmentAction(
  attachmentId: string
): Promise<ChatActionResult<void>> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const attachment = await repository.findAttachmentById(attachmentId);
    if (!attachment) {
      return { success: false, error: "첨부파일을 찾을 수 없습니다." };
    }

    if (attachment.sender_id !== userId) {
      return { success: false, error: "본인의 첨부파일만 삭제할 수 있습니다." };
    }

    // Storage에서 파일 + 썸네일 삭제
    const supabase = createSupabaseAdminClient()!;
    const pathsToRemove = [attachment.storage_path];
    if (attachment.thumbnail_storage_path) {
      pathsToRemove.push(attachment.thumbnail_storage_path);
    }
    await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);

    // DB에서 레코드 삭제
    await repository.deleteAttachment(attachmentId);

    return { success: true };
  } catch (error) {
    console.error("[deleteChatAttachmentAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "첨부파일 삭제 실패",
    };
  }
}

/**
 * 만료된 첨부파일 URL 갱신
 * 클라이언트에서 이미지 로드 실패(403) 시 호출
 */
export async function refreshAttachmentUrlsAction(
  attachmentIds: string[]
): Promise<ChatActionResult<Record<string, { publicUrl: string; thumbnailUrl: string | null }>>> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    if (attachmentIds.length === 0 || attachmentIds.length > 20) {
      return { success: false, error: "잘못된 요청입니다." };
    }

    const attachments = await repository.findAttachmentsByIds(attachmentIds);
    if (attachments.length === 0) {
      return { success: false, error: "첨부파일을 찾을 수 없습니다." };
    }

    // 요청자가 해당 채팅방 멤버인지 확인
    const roomIds = [...new Set(attachments.map((a) => a.room_id))];
    for (const rid of roomIds) {
      if (!await checkMembership(rid, userId)) {
        return { success: false, error: "접근 권한이 없습니다." };
      }
    }

    const refreshed = await refreshExpiredAttachmentUrls(
      attachments.map((a) => ({
        id: a.id,
        storage_path: a.storage_path,
        thumbnail_storage_path: a.thumbnail_storage_path,
      }))
    );

    const data: Record<string, { publicUrl: string; thumbnailUrl: string | null }> = {};
    for (const [id, urls] of refreshed) {
      data[id] = urls;
    }

    return { success: true, data };
  } catch (error) {
    console.error("[refreshAttachmentUrlsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "URL 갱신 실패",
    };
  }
}

/**
 * 현재 사용자의 스토리지 쿼터 정보 조회
 */
export async function getChatStorageQuotaAction(): Promise<ChatActionResult<StorageQuotaInfo>> {
  try {
    const auth = await getSessionUserWithRole();
    if (!auth) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const { userId, role } = auth;

    const usedBytes = await repository.getUserStorageUsage(userId);
    const totalBytes = getStorageLimitForRole(role);
    const remainingBytes = Math.max(0, totalBytes - usedBytes);
    const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    return {
      success: true,
      data: { usedBytes, totalBytes, remainingBytes, usagePercent },
    };
  } catch (error) {
    console.error("[getChatStorageQuotaAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "쿼터 조회 실패",
    };
  }
}

/**
 * 채팅방 첨부파일 목록 조회 (갤러리용)
 * 사용자가 숨긴 파일은 자동 제외
 */
export async function getRoomAttachmentsAction(
  roomId: string,
  options: { attachmentType?: string; attachmentTypes?: string[]; limit?: number; cursor?: string } = {}
): Promise<ChatActionResult<{ attachments: ChatAttachment[]; hasMore: boolean }>> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    // 채팅방 멤버 확인
    if (!await checkMembership(roomId, userId)) {
      return { success: false, error: "채팅방에 참여하지 않았습니다." };
    }

    // 숨긴 파일 ID 조회
    const hiddenIds = await repository.findHiddenAttachmentIds(userId, roomId);

    const limit = Math.min(options.limit ?? 30, 50);
    // 숨긴 파일 보정: 더 많이 fetch → filter → slice
    const fetchLimit = limit + hiddenIds.size + 1;
    const attachments = await repository.findAttachmentsByRoom(roomId, {
      attachmentType: options.attachmentType,
      attachmentTypes: options.attachmentTypes,
      limit: fetchLimit,
      cursor: options.cursor,
    });

    const filtered = attachments.filter((a) => !hiddenIds.has(a.id));
    const hasMore = filtered.length > limit;
    const result = hasMore ? filtered.slice(0, limit) : filtered;

    return { success: true, data: { attachments: result, hasMore } };
  } catch (error) {
    console.error("[getRoomAttachmentsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "첨부파일 목록 조회 실패",
    };
  }
}

/**
 * 채팅방 첨부파일 파일명 검색
 * 사용자가 숨긴 파일은 자동 제외
 */
export async function searchRoomAttachmentsAction(
  roomId: string,
  query: string,
  options: { attachmentTypes?: string[]; limit?: number; cursor?: string } = {}
): Promise<ChatActionResult<{ attachments: ChatAttachment[]; hasMore: boolean }>> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    if (!await checkMembership(roomId, userId)) {
      return { success: false, error: "채팅방에 참여하지 않았습니다." };
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return { success: true, data: { attachments: [], hasMore: false } };
    }

    // 숨긴 파일 ID 조회
    const hiddenIds = await repository.findHiddenAttachmentIds(userId, roomId);

    const limit = Math.min(options.limit ?? 30, 50);
    const fetchLimit = limit + hiddenIds.size + 1;
    const attachments = await repository.searchAttachmentsByRoom(roomId, trimmed, {
      attachmentTypes: options.attachmentTypes,
      limit: fetchLimit,
      cursor: options.cursor,
    });

    const filtered = attachments.filter((a) => !hiddenIds.has(a.id));
    const hasMore = filtered.length > limit;
    const result = hasMore ? filtered.slice(0, limit) : filtered;

    return { success: true, data: { attachments: result, hasMore } };
  } catch (error) {
    console.error("[searchRoomAttachmentsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "첨부파일 검색 실패",
    };
  }
}

/**
 * 첨부파일 숨기기 (갤러리에서 제거)
 * 서버의 실제 파일은 삭제하지 않으며, 7일 후 cleanup이 자동 삭제
 */
export async function hideAttachmentsAction(
  attachmentIds: string[]
): Promise<ChatActionResult<{ hiddenCount: number }>> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    if (attachmentIds.length === 0 || attachmentIds.length > 100) {
      return { success: false, error: "1~100개의 파일을 선택해주세요." };
    }

    // 첨부파일 존재 확인
    const attachments = await repository.findAttachmentsByIds(attachmentIds);
    if (attachments.length === 0) {
      return { success: false, error: "첨부파일을 찾을 수 없습니다." };
    }

    // 채팅방 멤버십 확인
    const roomIds = [...new Set(attachments.map((a) => a.room_id))];
    for (const rid of roomIds) {
      if (!await checkMembership(rid, userId)) {
        return { success: false, error: "접근 권한이 없습니다." };
      }
    }

    const validIds = attachments.map((a) => a.id);
    await repository.hideAttachmentsForUser(userId, validIds);

    return { success: true, data: { hiddenCount: validIds.length } };
  } catch (error) {
    console.error("[hideAttachmentsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "파일 숨기기 실패",
    };
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/** 메시지 내 URL에서 링크 프리뷰 추출 후 DB 저장 */
async function extractAndSaveLinkPreviews(
  messageId: string,
  content: string
): Promise<void> {
  const urls = extractUrls(content);
  if (urls.length === 0) return;

  const previews = await Promise.allSettled(
    urls.map((url) => fetchLinkPreview(url))
  );

  for (const result of previews) {
    if (result.status === "fulfilled" && result.value) {
      await repository.insertLinkPreview({
        message_id: messageId,
        ...result.value,
      }).catch((err) =>
        console.error("[LinkPreview] DB insert failed:", err)
      );
    }
  }
}

/** 첨부 타입별 알림 라벨 */
function getAttachmentLabel(messageType: string): string {
  switch (messageType) {
    case "image": return "📷 사진을 보냈습니다.";
    case "video": return "🎬 동영상을 보냈습니다.";
    case "audio": return "🎵 음성을 보냈습니다.";
    default: return "📄 파일을 보냈습니다.";
  }
}

/** 첨부 타입별 이모지 (텍스트+첨부 혼합 시 사용) */
function getAttachmentEmoji(messageType: string): string {
  switch (messageType) {
    case "image": return "📷";
    case "video": return "🎬";
    case "audio": return "🎵";
    default: return "📄";
  }
}

/** Push 알림 발송 (첨부파일 포함 메시지 대응) */
async function sendChatPushNotification(
  roomId: string,
  senderId: string,
  message: ChatMessage,
  hasAttachments: boolean
): Promise<void> {
  const room = await repository.findRoomById(roomId);
  if (!room) return;

  const members = await repository.findMembersByRoom(roomId);
  const recipientIds = members
    .filter((m) => m.user_id !== senderId && !m.left_at)
    .map((m) => m.user_id);

  if (recipientIds.length === 0) return;

  const isDirect = room.type === "direct";
  const title = isDirect
    ? (message.sender_name ?? "새 메시지")
    : (room.name ?? "그룹 채팅");

  let bodyText = message.content.slice(0, 100);
  if (hasAttachments && !message.content.trim()) {
    // 텍스트 없이 첨부만 있는 경우: 타입별 이모지
    const typeLabel = getAttachmentLabel(message.message_type);
    bodyText = typeLabel;
  } else if (hasAttachments) {
    const typeEmoji = getAttachmentEmoji(message.message_type);
    bodyText = `${typeEmoji} ${bodyText}`;
  }

  const body = isDirect ? bodyText : `${message.sender_name ?? "알 수 없음"}: ${bodyText}`;

  // 멘션 사용자 분리 (뮤트 무시 알림 대상)
  const mentionedUserIds = new Set(
    (message.metadata?.mentions ?? [])
      .map((m) => m.userId)
      .filter((id) => id !== senderId && recipientIds.includes(id))
  );
  const normalRecipientIds = recipientIds.filter((id) => !mentionedUserIds.has(id));

  // 일반 알림 (멘션 안 된 수신자)
  if (normalRecipientIds.length > 0) {
    await routeNotification({
      type: isDirect ? "chat_message" : "chat_group_message",
      recipientIds: normalRecipientIds,
      payload: {
        title,
        body,
        url: `/chat/${roomId}`,
        tag: `chat-${roomId}`,
      },
      priority: "normal",
      source: "server_action",
      referenceId: `${roomId}:${message.id}`,
      messageCreatedAt: message.created_at,
    });
  }

  // 멘션 알림 (뮤트 무시, high 우선순위)
  if (mentionedUserIds.size > 0) {
    const senderName = message.sender_name ?? "알 수 없음";
    await routeNotification({
      type: "chat_mention",
      recipientIds: Array.from(mentionedUserIds),
      payload: {
        title: isDirect ? senderName : (room.name ?? "그룹 채팅"),
        body: `${senderName}님이 회원님을 언급했습니다: ${bodyText.slice(0, 80)}`,
        url: `/chat/${roomId}`,
        tag: `chat-mention-${roomId}`,
      },
      priority: "high",
      source: "server_action",
      referenceId: `${roomId}:${message.id}:mention`,
      messageCreatedAt: message.created_at,
    });
  }
}
