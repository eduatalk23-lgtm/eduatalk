/**
 * Invite Domain Types
 */

export type InviteTargetRole = "student" | "parent";

export type InviteRelation = "father" | "mother" | "guardian";

export type InviteCode = {
  id: string;
  code: string;
  studentId: string;
  studentName: string | null;
  targetRole: InviteTargetRole;
  relation: InviteRelation | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};
