"use client";

import { useState, useEffect, useTransition } from "react";
import Button from "@/components/atoms/Button";
import { Copy, Link2, Users, UserPlus, Trash2, GitBranch } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getStudentParents,
  type StudentParent,
} from "@/lib/domains/student";
import { ParentCard } from "./ParentCard";
import { ParentSearchModal } from "./ParentSearchModal";
import type { InviteCode, InviteTargetRole, InviteRelation } from "@/lib/domains/invite/types";

type ConnectionSectionProps = {
  studentId: string;
};

export function ConnectionSection({ studentId }: ConnectionSectionProps) {
  const { showSuccess, showError } = useToast();

  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [isCreatingCode, setIsCreatingCode] = useState(false);

  // Parents state
  const [parents, setParents] = useState<StudentParent[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Siblings state
  const [siblings, setSiblings] = useState<Array<{
    studentId: string;
    studentName: string | null;
    sharedParentName: string | null;
    relation: string | null;
  }>>([]);
  const [isLoadingSiblings, setIsLoadingSiblings] = useState(true);

  // Load invite codes
  useEffect(() => {
    async function loadInviteCodes() {
      try {
        const { getStudentInviteCodes } = await import("@/lib/domains/invite");
        const result = await getStudentInviteCodes(studentId);
        if (result.success && result.data) {
          setInviteCodes(result.data);
        }
      } catch (error) {
        console.error("[ConnectionSection] 초대 코드 조회 실패", error);
      } finally {
        setIsLoadingCodes(false);
      }
    }
    loadInviteCodes();
  }, [studentId]);

  // Load parents
  useEffect(() => {
    async function loadParents() {
      const result = await getStudentParents(studentId);
      if (result.success && result.data) {
        setParents(result.data);
      }
      setIsLoadingParents(false);
    }
    loadParents();
  }, [studentId]);

  // Load siblings
  useEffect(() => {
    async function loadSiblings() {
      try {
        const { getDerivedSiblings } = await import("@/lib/domains/invite");
        const result = await getDerivedSiblings(studentId);
        if (result.success && result.data) {
          setSiblings(result.data);
        }
      } catch (error) {
        console.error("[ConnectionSection] 형제 조회 실패", error);
      } finally {
        setIsLoadingSiblings(false);
      }
    }
    loadSiblings();
  }, [studentId]);

  // Create invite code
  const handleCreateInviteCode = async (targetRole: InviteTargetRole, relation?: InviteRelation) => {
    setIsCreatingCode(true);
    try {
      const { createInviteCode } = await import("@/lib/domains/invite");
      const result = await createInviteCode({ studentId, targetRole, relation });
      if (result.success && result.data) {
        setInviteCodes((prev) => [result.data!, ...prev]);
        showSuccess("초대 코드가 생성되었습니다.");
      } else {
        showError(result.error || "초대 코드 생성에 실패했습니다.");
      }
    } catch {
      showError("초대 코드 생성 중 오류가 발생했습니다.");
    } finally {
      setIsCreatingCode(false);
    }
  };

  // Revoke invite code
  const handleRevokeCode = async (codeId: string) => {
    try {
      const { revokeInviteCode } = await import("@/lib/domains/invite");
      const result = await revokeInviteCode(codeId);
      if (result.success) {
        setInviteCodes((prev) => prev.filter((c) => c.id !== codeId));
        showSuccess("초대 코드가 취소되었습니다.");
      } else {
        showError(result.error || "초대 코드 취소에 실패했습니다.");
      }
    } catch {
      showError("초대 코드 취소 중 오류가 발생했습니다.");
    }
  };

  // Copy code
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showSuccess("초대 코드가 복사되었습니다.");
    } catch {
      showError("복사에 실패했습니다.");
    }
  };

  // Copy URL
  const handleCopyUrl = async (code: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${baseUrl}/login?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess("가입 URL이 복사되었습니다.");
    } catch {
      showError("URL 복사에 실패했습니다.");
    }
  };

  // Refresh parents after add/remove
  function handleParentRefresh() {
    startTransition(async () => {
      const result = await getStudentParents(studentId);
      if (result.success && result.data) {
        setParents(result.data);
      }
      // Also refresh siblings
      try {
        const { getDerivedSiblings } = await import("@/lib/domains/invite");
        const sibResult = await getDerivedSiblings(studentId);
        if (sibResult.success && sibResult.data) {
          setSiblings(sibResult.data);
        }
      } catch {}
    });
  }

  const relationLabel = (r: string | null) => {
    switch (r) {
      case "father": return "부";
      case "mother": return "모";
      case "guardian": return "보호자";
      default: return r || "";
    }
  };

  const activeCodes = inviteCodes.filter(
    (c) => !c.usedAt && new Date(c.expiresAt) > new Date()
  );

  return (
    <>
      {/* 학부모 + 형제/자매: 2열 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 학부모 카드 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Users size={16} className="text-gray-500" />
              학부모
            </h3>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              추가
            </button>
          </div>

          {isLoadingParents ? (
            <div className="flex-1 flex items-center justify-center py-6">
              <div className="animate-pulse space-y-3 w-full">
                <div className="h-12 bg-gray-100 rounded-lg" />
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ) : parents.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-6">
              <p className="text-sm text-gray-400">연결된 학부모가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {parents.map((parent) => (
                <ParentCard
                  key={parent.linkId}
                  parent={parent}
                  onRefresh={handleParentRefresh}
                />
              ))}
            </div>
          )}
        </div>

        {/* 형제/자매 카드 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <GitBranch size={16} className="text-gray-500" />
              형제/자매
            </h3>
            {siblings.length > 0 && (
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                자동 감지
              </span>
            )}
          </div>

          {isLoadingSiblings ? (
            <div className="flex-1 flex items-center justify-center py-6">
              <div className="animate-pulse space-y-3 w-full">
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ) : siblings.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2">
              <p className="text-sm text-gray-400">감지된 형제/자매가 없습니다</p>
              <p className="text-xs text-gray-300">
                학부모 공유를 통해 자동으로 감지됩니다
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {siblings.map((sib) => (
                <div
                  key={sib.studentId}
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {sib.studentName ?? "이름 없음"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {sib.sharedParentName ?? ""}({relationLabel(sib.relation)}) 공유
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 초대 코드: 전체 너비 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Link2 size={16} className="text-gray-500" />
            초대 코드
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateInviteCode("student")}
              isLoading={isCreatingCode}
            >
              학생 초대
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateInviteCode("parent", "mother")}
              isLoading={isCreatingCode}
            >
              모 초대
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateInviteCode("parent", "father")}
              isLoading={isCreatingCode}
            >
              부 초대
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateInviteCode("parent", "guardian")}
              isLoading={isCreatingCode}
            >
              보호자 초대
            </Button>
          </div>
        </div>

        {isLoadingCodes ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-100 rounded-lg" />
          </div>
        ) : activeCodes.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            활성 초대 코드가 없습니다
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeCodes.map((code) => {
              const daysLeft = Math.ceil(
                (new Date(code.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={code.id}
                  className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{code.code}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {code.targetRole === "student" ? "학생" : relationLabel(code.relation)}
                    </span>
                    <span className="text-xs text-gray-500">D-{daysLeft}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyCode(code.code)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      title="코드 복사"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleCopyUrl(code.code)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      title="URL 복사"
                    >
                      <Link2 size={14} />
                    </button>
                    <button
                      onClick={() => handleRevokeCode(code.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                      title="취소"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ParentSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        studentId={studentId}
        existingParents={parents}
        onSuccess={handleParentRefresh}
      />
    </>
  );
}
