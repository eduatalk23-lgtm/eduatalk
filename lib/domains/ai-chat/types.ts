import type { UIMessage } from "ai";

export type AIConversationPersona =
  | "student"
  | "parent"
  | "consultant"
  | "admin"
  | "superadmin";

export type AIConversationOrigin = {
  source: string;
  originPath: string;
  params: Record<string, string | number | undefined>;
  enteredAt: string;
};

export type AIConversationRow = {
  id: string;
  owner_user_id: string;
  tenant_id: string | null;
  persona: AIConversationPersona;
  subject_student_id: string | null;
  title: string | null;
  last_activity_at: string;
  pinned_at: string | null;
  archived_at: string | null;
  retention_until: string | null;
  anonymized_at: string | null;
  origin: AIConversationOrigin | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type AIMessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: UIMessage["parts"];
  created_at: string;
};
