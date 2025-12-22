/**
 * Superadmin Domain Types
 *
 * 슈퍼관리자 관련 타입 정의
 */

// ============================================================================
// Tenantless Users Types
// ============================================================================

export type TenantlessUser = {
  id: string;
  email: string;
  name: string | null;
  role: "student" | "parent" | "admin" | "consultant";
  userType: "student" | "parent" | "admin";
  created_at: string;
};

export type UserType = "student" | "parent" | "admin" | "all";

export type TenantAssignment = {
  userId: string;
  userType: "student" | "parent" | "admin";
};

export type Tenant = {
  id: string;
  name: string;
};

// ============================================================================
// Curriculum Settings Types
// ============================================================================

export type CurriculumSetting = {
  id: string;
  key: string;
  value: { start_year: number };
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CurriculumSettingsData = {
  middle_2022: number;
  high_2022: number;
  middle_2015: number;
  high_2015: number;
};

// ============================================================================
// Terms Contents Types (re-export from lib/types/terms)
// ============================================================================

export type { TermsContentType, TermsContentInput, TermsContent } from "@/lib/types/terms";
