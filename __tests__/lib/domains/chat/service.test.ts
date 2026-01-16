/**
 * Chat Service 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Repository 모킹
vi.mock("@/lib/domains/chat/repository", () => ({
  findMember: vi.fn(),
  findBlocksByUser: vi.fn(),
  findMessagesByRoom: vi.fn(),
  findSendersByIds: vi.fn(),
  insertMessage: vi.fn(),
  findRoomById: vi.fn(),
}));

// Supabase 모킹
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

import * as repository from "@/lib/domains/chat/repository";
import { sendMessage, getMessages } from "@/lib/domains/chat/service";
import type { ChatRoomMember, ChatMessage } from "@/lib/domains/chat/types";

const mockFindMember = vi.mocked(repository.findMember);
const mockFindBlocksByUser = vi.mocked(repository.findBlocksByUser);
const mockFindMessagesByRoom = vi.mocked(repository.findMessagesByRoom);
const mockFindSendersByIds = vi.mocked(repository.findSendersByIds);
const mockInsertMessage = vi.mocked(repository.insertMessage);

describe("Chat Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMessage", () => {
    const validRequest = {
      roomId: "room-1",
      content: "Hello, World!",
      messageType: "text" as const,
    };

    describe("메시지 길이 검증", () => {
      it("1000자 초과 메시지는 거부", async () => {
        const longContent = "x".repeat(1001);

        const result = await sendMessage("user-1", "student", {
          ...validRequest,
          content: longContent,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("1000자");
      });

      it("1000자 이하 메시지는 허용", async () => {
        const maxContent = "x".repeat(1000);
        mockFindMember.mockResolvedValue({
          id: "member-1",
          room_id: "room-1",
          user_id: "user-1",
          user_type: "student",
          role: "member",
          last_read_at: new Date().toISOString(),
          is_muted: false,
          left_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatRoomMember);

        mockInsertMessage.mockResolvedValue({
          id: "msg-1",
          room_id: "room-1",
          sender_id: "user-1",
          sender_type: "student",
          message_type: "text",
          content: maxContent,
          is_deleted: false,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatMessage);

        const result = await sendMessage("user-1", "student", {
          ...validRequest,
          content: maxContent,
        });

        expect(result.success).toBe(true);
      });
    });

    describe("빈 메시지 검증", () => {
      it("빈 문자열은 거부", async () => {
        const result = await sendMessage("user-1", "student", {
          ...validRequest,
          content: "",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("입력");
      });

      it("공백만 있는 메시지는 거부", async () => {
        const result = await sendMessage("user-1", "student", {
          ...validRequest,
          content: "   ",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("입력");
      });

      it("줄바꿈만 있는 메시지는 거부", async () => {
        const result = await sendMessage("user-1", "student", {
          ...validRequest,
          content: "\n\n\n",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("입력");
      });
    });

    describe("멤버십 검증", () => {
      it("채팅방 멤버가 아니면 거부", async () => {
        mockFindMember.mockResolvedValue(null);

        const result = await sendMessage("user-1", "student", validRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain("참여하지 않았습니다");
      });

      it("채팅방 멤버이면 메시지 전송 성공", async () => {
        mockFindMember.mockResolvedValue({
          id: "member-1",
          room_id: "room-1",
          user_id: "user-1",
          user_type: "student",
          role: "member",
          last_read_at: new Date().toISOString(),
          is_muted: false,
          left_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatRoomMember);

        mockInsertMessage.mockResolvedValue({
          id: "msg-1",
          room_id: "room-1",
          sender_id: "user-1",
          sender_type: "student",
          message_type: "text",
          content: "Hello, World!",
          is_deleted: false,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatMessage);

        const result = await sendMessage("user-1", "student", validRequest);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.content).toBe("Hello, World!");
      });
    });
  });

  describe("getMessages", () => {
    const validOptions = {
      roomId: "room-1",
      limit: 50,
    };

    describe("멤버십 검증", () => {
      it("채팅방 멤버가 아니면 거부", async () => {
        mockFindMember.mockResolvedValue(null);

        const result = await getMessages("user-1", "student", validOptions);

        expect(result.success).toBe(false);
        expect(result.error).toContain("참여하지 않았습니다");
      });
    });

    describe("차단 사용자 필터링", () => {
      it("차단한 사용자의 메시지는 제외", async () => {
        mockFindMember.mockResolvedValue({
          id: "member-1",
          room_id: "room-1",
          user_id: "user-1",
          user_type: "student",
          role: "member",
          last_read_at: new Date().toISOString(),
          is_muted: false,
          left_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatRoomMember);

        // 차단 목록: user-2를 차단함
        mockFindBlocksByUser.mockResolvedValue([
          {
            id: "block-1",
            blocker_id: "user-1",
            blocker_type: "student",
            blocked_id: "user-2",
            blocked_type: "student",
            created_at: new Date().toISOString(),
          },
        ]);

        // 메시지: user-2의 메시지 포함
        mockFindMessagesByRoom.mockResolvedValue([
          {
            id: "msg-1",
            room_id: "room-1",
            sender_id: "user-1",
            sender_type: "student",
            message_type: "text",
            content: "Hello from user-1",
            is_deleted: false,
            deleted_at: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          {
            id: "msg-2",
            room_id: "room-1",
            sender_id: "user-2",
            sender_type: "student",
            message_type: "text",
            content: "Hello from blocked user-2",
            is_deleted: false,
            deleted_at: null,
            created_at: "2024-01-01T00:01:00Z",
            updated_at: "2024-01-01T00:01:00Z",
          },
        ] as ChatMessage[]);

        mockFindSendersByIds.mockResolvedValue(
          new Map([
            ["user-1_student", { id: "user-1", name: "User 1", profileImageUrl: null }],
          ])
        );

        const result = await getMessages("user-1", "student", validOptions);

        expect(result.success).toBe(true);
        // user-2의 메시지는 필터링되어 1개만 반환
        expect(result.data?.data).toHaveLength(1);
        expect(result.data?.data[0].sender_id).toBe("user-1");
      });
    });

    describe("페이지네이션", () => {
      it("hasMore가 limit과 동일할 때 true", async () => {
        mockFindMember.mockResolvedValue({
          id: "member-1",
          room_id: "room-1",
          user_id: "user-1",
          user_type: "student",
          role: "member",
          last_read_at: new Date().toISOString(),
          is_muted: false,
          left_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatRoomMember);

        mockFindBlocksByUser.mockResolvedValue([]);

        // 정확히 limit(50)개의 메시지 생성
        const messages: ChatMessage[] = Array.from({ length: 50 }, (_, i) => ({
          id: `msg-${i}`,
          room_id: "room-1",
          sender_id: "user-1",
          sender_type: "student" as const,
          message_type: "text" as const,
          content: `Message ${i}`,
          is_deleted: false,
          deleted_at: null,
          created_at: new Date(Date.now() - i * 1000).toISOString(),
          updated_at: new Date(Date.now() - i * 1000).toISOString(),
        }));

        mockFindMessagesByRoom.mockResolvedValue(messages);
        mockFindSendersByIds.mockResolvedValue(
          new Map([
            ["user-1_student", { id: "user-1", name: "User 1", profileImageUrl: null }],
          ])
        );

        const result = await getMessages("user-1", "student", validOptions);

        expect(result.success).toBe(true);
        expect(result.data?.hasMore).toBe(true);
      });

      it("hasMore가 limit 미만일 때 false", async () => {
        mockFindMember.mockResolvedValue({
          id: "member-1",
          room_id: "room-1",
          user_id: "user-1",
          user_type: "student",
          role: "member",
          last_read_at: new Date().toISOString(),
          is_muted: false,
          left_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ChatRoomMember);

        mockFindBlocksByUser.mockResolvedValue([]);

        // limit(50)보다 적은 10개 메시지
        const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
          id: `msg-${i}`,
          room_id: "room-1",
          sender_id: "user-1",
          sender_type: "student" as const,
          message_type: "text" as const,
          content: `Message ${i}`,
          is_deleted: false,
          deleted_at: null,
          created_at: new Date(Date.now() - i * 1000).toISOString(),
          updated_at: new Date(Date.now() - i * 1000).toISOString(),
        }));

        mockFindMessagesByRoom.mockResolvedValue(messages);
        mockFindSendersByIds.mockResolvedValue(
          new Map([
            ["user-1_student", { id: "user-1", name: "User 1", profileImageUrl: null }],
          ])
        );

        const result = await getMessages("user-1", "student", validOptions);

        expect(result.success).toBe(true);
        expect(result.data?.hasMore).toBe(false);
      });
    });
  });
});
