"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Copy, Link2, Users, UserPlus, Trash2, GitBranch, Plus, ChevronDown,
  QrCode, Send, Mail, MessageSquare, ExternalLink, X, RefreshCw,
  LinkIcon, Unlink, User,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getStudentParents,
  type StudentParent,
} from "@/lib/domains/student";
import { ParentCard } from "./ParentCard";
import { ParentSearchModal } from "./ParentSearchModal";
import type {
  Invitation,
  InvitationRole,
  InvitationRelation,
  DeliveryMethod,
} from "@/lib/domains/invitation/types";
import type { StudentConnectionStatus } from "@/lib/domains/student/actions/connectionStatus";

type ConnectionSectionProps = {
  studentId: string;
};

const INVITE_ROLE_OPTIONS: { label: string; targetRole: InvitationRole; relation?: InvitationRelation }[] = [
  { label: "학생 초대", targetRole: "student" },
  { label: "모 초대", targetRole: "parent", relation: "mother" },
  { label: "부 초대", targetRole: "parent", relation: "father" },
  { label: "보호자 초대", targetRole: "parent", relation: "guardian" },
];

const DELIVERY_OPTIONS: { label: string; method: DeliveryMethod; icon: typeof Send; description: string }[] = [
  { label: "SMS 발송", method: "sms", icon: MessageSquare, description: "문자로 초대 링크 전송" },
  { label: "이메일 발송", method: "email", icon: Mail, description: "이메일로 초대 링크 전송" },
  { label: "링크만 생성", method: "manual", icon: Link2, description: "링크를 직접 공유" },
];

const ROLE_LABEL: Record<string, string> = {
  student: "학생",
  parent: "학부모",
  father: "부",
  mother: "모",
  guardian: "보호자",
};

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  google: "구글",
  email: "이메일",
};

export function ConnectionSection({ studentId }: ConnectionSectionProps) {
  const { showSuccess, showError } = useToast();

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<StudentConnectionStatus | null>(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);

  // Invitations state (통합)
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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

  // Create invitation flow state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ targetRole: InvitationRole; relation?: InvitationRelation } | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryMethod>("manual");
  const [deliveryContact, setDeliveryContact] = useState("");

  // Disconnect confirmation
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // QR modal state
  const [qrModal, setQrModal] = useState<{ token: string; qrDataUrl: string } | null>(null);

  // Load connection status
  const loadConnectionStatus = useCallback(async () => {
    try {
      const { getStudentConnectionStatus } = await import("@/lib/domains/student/actions/connectionStatus");
      const status = await getStudentConnectionStatus(studentId);
      setConnectionStatus(status);
    } catch (error) {
      console.error("[ConnectionSection] 연결 상태 조회 실패", error);
      setConnectionStatus({ status: "disconnected" });
    } finally {
      setIsLoadingConnection(false);
    }
  }, [studentId]);

  // Load invitations (통합 API)
  const loadInvitations = useCallback(async () => {
    try {
      const { getStudentInvitations } = await import("@/lib/domains/invitation/actions");
      const result = await getStudentInvitations(studentId);
      if (result.success && result.data) {
        setInvitations(result.data);
      }
    } catch (error) {
      console.error("[ConnectionSection] 초대 조회 실패", error);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [studentId]);

  useEffect(() => { loadConnectionStatus(); }, [loadConnectionStatus]);
  useEffect(() => { loadInvitations(); }, [loadInvitations]);

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
        const { getDerivedSiblings } = await import("@/lib/domains/student/actions/siblings");
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

  // Derived state
  const isStudentConnected = connectionStatus?.status === "connected";
  const hasStudentPendingInvite = connectionStatus?.status === "pending";
  const studentPendingInvitation = connectionStatus?.status === "pending" ? connectionStatus.invitation : null;

  const activeInvitations = invitations.filter(
    (inv) => inv.status === "pending" && new Date(inv.expiresAt) > new Date()
  );
  const parentInvitations = activeInvitations.filter((inv) => inv.targetRole === "parent");
  const hasParentPendingInvite = parentInvitations.length > 0;

  // Open create modal with role selection
  const handleStartCreate = (targetRole: InvitationRole, relation?: InvitationRelation) => {
    // 학생 초대: 이미 연결되었거나 pending이면 차단
    if (targetRole === "student") {
      if (isStudentConnected) {
        showError("이미 연결된 학생입니다. 연결 해제 후 재초대하세요.");
        return;
      }
      if (hasStudentPendingInvite) {
        showError("이미 대기 중인 학생 초대가 있습니다. 기존 초대를 취소 후 다시 시도하세요.");
        return;
      }
    }

    // 학부모 초대: pending이면 차단
    if (targetRole === "parent" && hasParentPendingInvite) {
      showError("이미 대기 중인 학부모 초대가 있습니다. 기존 초대를 취소 후 다시 시도하세요.");
      return;
    }

    setSelectedRole({ targetRole, relation });
    setSelectedDelivery("manual");
    setDeliveryContact("");
    setIsCreateModalOpen(true);
  };

  // Create invitation (통합 API)
  const handleCreateInvitation = async () => {
    if (!selectedRole) return;

    if (selectedDelivery === "sms" && !deliveryContact.trim()) {
      showError("전화번호를 입력해주세요.");
      return;
    }
    if (selectedDelivery === "email" && !deliveryContact.trim()) {
      showError("이메일을 입력해주세요.");
      return;
    }

    setIsCreating(true);
    try {
      const { createInvitation } = await import("@/lib/domains/invitation/actions");
      const result = await createInvitation({
        targetRole: selectedRole.targetRole,
        relation: selectedRole.relation,
        studentId,
        deliveryMethod: selectedDelivery,
        phone: selectedDelivery === "sms" ? deliveryContact.trim() : undefined,
        email: selectedDelivery === "email" ? deliveryContact.trim() : undefined,
      });

      if (result.success && result.invitation) {
        setInvitations((prev) => [result.invitation!, ...prev]);
        setIsCreateModalOpen(false);

        // 학생 초대면 connection status도 갱신
        if (selectedRole.targetRole === "student") {
          loadConnectionStatus();
        }

        // 동일 관계 중복 경고 표시
        if (result.warning) {
          showError(result.warning);
        }

        if (result.deliverySent) {
          showSuccess(selectedDelivery === "sms" ? "초대 SMS가 발송되었습니다." : "초대 이메일이 발송되었습니다.");
        } else if (result.deliveryError) {
          showError(`초대가 생성되었지만 발송에 실패했습니다: ${result.deliveryError}`);
        } else {
          showSuccess("초대가 생성되었습니다. 링크를 공유해주세요.");
        }
      } else {
        showError(result.error || "초대 생성에 실패했습니다.");
      }
    } catch {
      showError("초대 생성 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  // Cancel invitation (통합 API)
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { cancelInvitationAction } = await import("@/lib/domains/invitation/actions");
      const result = await cancelInvitationAction(invitationId);
      if (result.success) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        showSuccess("초대가 취소되었습니다.");
        // connection status 갱신 (학생 초대 취소 시 pending → disconnected)
        loadConnectionStatus();
      } else {
        showError(result.error || "초대 취소에 실패했습니다.");
      }
    } catch {
      showError("초대 취소 중 오류가 발생했습니다.");
    }
  };

  // Resend invitation
  const handleResend = async (invitationId: string) => {
    try {
      const { resendInvitationAction } = await import("@/lib/domains/invitation/actions");
      const result = await resendInvitationAction(invitationId);
      if (result.success) {
        showSuccess("초대가 재발송되었습니다.");
        loadInvitations();
      } else {
        showError(result.error || "재발송에 실패했습니다.");
      }
    } catch {
      showError("재발송 중 오류가 발생했습니다.");
    }
  };

  // Disconnect student
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const { disconnectStudent } = await import("@/lib/domains/student/actions/disconnect");
      const result = await disconnectStudent(studentId);
      if (result.success) {
        showSuccess("학생 계정 연결이 해제되었습니다.");
        setIsDisconnectModalOpen(false);
        // 페이지 새로고침 (studentId가 변경되므로)
        window.location.reload();
      } else {
        showError(result.error || "연결 해제에 실패했습니다.");
      }
    } catch {
      showError("연결 해제 중 오류가 발생했습니다.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Copy join URL
  const handleCopyJoinUrl = async (token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess("초대 링크가 복사되었습니다.");
    } catch {
      showError("복사에 실패했습니다.");
    }
  };

  // Show QR code
  const handleShowQR = async (token: string) => {
    try {
      const { generateInviteQRCode } = await import("@/lib/domains/invitation/qrCode");
      const qrDataUrl = await generateInviteQRCode(token);
      setQrModal({ token, qrDataUrl });
    } catch {
      showError("QR 코드 생성에 실패했습니다.");
    }
  };

  // Refresh parents
  function handleParentRefresh() {
    startTransition(async () => {
      const result = await getStudentParents(studentId);
      if (result.success && result.data) {
        setParents(result.data);
      }
      try {
        const { getDerivedSiblings } = await import("@/lib/domains/student/actions/siblings");
        const sibResult = await getDerivedSiblings(studentId);
        if (sibResult.success && sibResult.data) {
          setSiblings(sibResult.data);
        }
      } catch {}
    });
  }

  const relationLabel = (r: string | null) => ROLE_LABEL[r || ""] || r || "";

  const deliveryLabel = (method: DeliveryMethod, status: string) => {
    if (method === "manual" || method === "qr") return "수동";
    if (status === "sent") return method === "sms" ? "SMS 발송됨" : "이메일 발송됨";
    if (status === "failed") return "발송 실패";
    return "대기";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 학생 계정 연결 상태 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <User size={16} className="text-gray-500" />
          학생 계정
        </h3>

        {isLoadingConnection ? (
          <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
        ) : connectionStatus?.status === "connected" ? (
          // 연결됨 상태
          <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <LinkIcon size={14} className="text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-800">연결됨</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                    {PROVIDER_LABEL[connectionStatus.provider] ?? connectionStatus.provider}
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-0.5">
                  {connectionStatus.email}
                  {connectionStatus.connectedAt && (
                    <> · {new Date(connectionStatus.connectedAt).toLocaleDateString("ko-KR")}</>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDisconnectModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <Unlink size={14} />
              연결 해제
            </button>
          </div>
        ) : connectionStatus?.status === "pending" && studentPendingInvitation ? (
          // 초대 대기 중 상태
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Send size={14} className="text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-amber-800">초대 대기 중</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    studentPendingInvitation.deliveryStatus === "sent"
                      ? "bg-green-100 text-green-700"
                      : studentPendingInvitation.deliveryStatus === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {deliveryLabel(
                      studentPendingInvitation.deliveryMethod as DeliveryMethod,
                      studentPendingInvitation.deliveryStatus
                    )}
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-0.5">
                  {studentPendingInvitation.phone || studentPendingInvitation.email || "링크 생성됨"}
                  {" · "}만료까지{" "}
                  {Math.max(
                    0,
                    Math.ceil(
                      (new Date(studentPendingInvitation.expiresAt).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  )}
                  일
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCopyJoinUrl(studentPendingInvitation.token)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
                title="초대 링크 복사"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => handleShowQR(studentPendingInvitation.token)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
                title="QR 코드"
              >
                <QrCode size={16} />
              </button>
              <button
                onClick={() => handleCancelInvitation(studentPendingInvitation.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                title="초대 취소"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          // 미연결 상태
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Unlink size={14} className="text-gray-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">미연결</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  초대를 생성하여 학생 계정을 연결하세요
                </p>
              </div>
            </div>
            <button
              onClick={() => handleStartCreate("student")}
              disabled={isCreating}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send size={14} />
              학생 초대 생성
            </button>
          </div>
        )}
      </div>

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

          {/* 대기 중인 학부모 초대 inline 표시 */}
          {parentInvitations.length > 0 && (
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
              {parentInvitations.map((inv) => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                );
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg border border-amber-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Send size={12} className="text-amber-500 shrink-0" />
                      <span className="text-xs font-medium text-amber-700">
                        {relationLabel(inv.relation)} 초대 대기
                      </span>
                      <span className="text-xs text-amber-500">D-{daysLeft}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleCopyJoinUrl(inv.token)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition"
                        title="링크 복사"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(inv.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition"
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

      {/* 구분선 */}
      <hr className="border-gray-200" />

      {/* 초대 관리: 전체 너비 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Send size={16} className="text-gray-500" />
            초대
          </h3>
          <InviteRoleDropdown
            isCreating={isCreating}
            isStudentConnected={isStudentConnected}
            hasStudentPendingInvite={hasStudentPendingInvite}
            hasParentPendingInvite={hasParentPendingInvite}
            onSelect={handleStartCreate}
          />
        </div>

        {isLoadingInvitations ? (
          <div className="animate-pulse space-y-2">
            <div className="h-14 bg-gray-100 rounded-lg" />
            <div className="h-14 bg-gray-100 rounded-lg" />
          </div>
        ) : activeInvitations.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            활성 초대가 없습니다
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeInvitations.map((inv) => {
              const daysLeft = Math.ceil(
                (new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
                      {inv.targetRole === "student" ? "학생" : relationLabel(inv.relation)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      inv.deliveryStatus === "sent"
                        ? "bg-green-100 text-green-700"
                        : inv.deliveryStatus === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                    }`}>
                      {deliveryLabel(inv.deliveryMethod, inv.deliveryStatus)}
                    </span>
                    {inv.phone && (
                      <span className="text-xs text-gray-500 truncate">{inv.phone}</span>
                    )}
                    {inv.email && (
                      <span className="text-xs text-gray-500 truncate">{inv.email}</span>
                    )}
                    <span className="text-xs text-gray-400 whitespace-nowrap">D-{daysLeft}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopyJoinUrl(inv.token)}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
                      title="초대 링크 복사"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleShowQR(inv.token)}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
                      title="QR 코드"
                    >
                      <QrCode size={16} />
                    </button>
                    {inv.deliveryMethod !== "manual" && (
                      <button
                        onClick={() => handleResend(inv.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="재발송"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleCancelInvitation(inv.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="취소"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create invitation modal */}
      {isCreateModalOpen && selectedRole && (
        <CreateInvitationModal
          roleLabel={
            selectedRole.targetRole === "student"
              ? "학생"
              : relationLabel(selectedRole.relation ?? null)
          }
          selectedDelivery={selectedDelivery}
          deliveryContact={deliveryContact}
          isCreating={isCreating}
          onDeliveryChange={setSelectedDelivery}
          onContactChange={setDeliveryContact}
          onCreate={handleCreateInvitation}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* Disconnect confirmation modal */}
      {isDisconnectModalOpen && connectionStatus?.status === "connected" && (
        <DisconnectModal
          email={connectionStatus.email}
          provider={connectionStatus.provider}
          isDisconnecting={isDisconnecting}
          onConfirm={handleDisconnect}
          onClose={() => setIsDisconnectModalOpen(false)}
        />
      )}

      {/* QR code modal */}
      {qrModal && (
        <QRModal
          qrDataUrl={qrModal.qrDataUrl}
          token={qrModal.token}
          onCopyUrl={() => handleCopyJoinUrl(qrModal.token)}
          onClose={() => setQrModal(null)}
        />
      )}

      <ParentSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        studentId={studentId}
        existingParents={parents}
        onSuccess={handleParentRefresh}
      />
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function InviteRoleDropdown({
  isCreating,
  isStudentConnected,
  hasStudentPendingInvite,
  hasParentPendingInvite,
  onSelect,
}: {
  isCreating: boolean;
  isStudentConnected: boolean;
  hasStudentPendingInvite: boolean;
  hasParentPendingInvite: boolean;
  onSelect: (targetRole: InvitationRole, relation?: InvitationRelation) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const isDisabled = (opt: typeof INVITE_ROLE_OPTIONS[number]) => {
    if (opt.targetRole === "student") {
      return isStudentConnected || hasStudentPendingInvite;
    }
    if (opt.targetRole === "parent") {
      return hasParentPendingInvite;
    }
    return false;
  };

  const disabledReason = (opt: typeof INVITE_ROLE_OPTIONS[number]) => {
    if (opt.targetRole === "student") {
      if (isStudentConnected) return "이미 연결됨";
      if (hasStudentPendingInvite) return "대기 중";
    }
    if (opt.targetRole === "parent" && hasParentPendingInvite) {
      return "대기 중";
    }
    return null;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isCreating}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={14} />
        초대 생성
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {INVITE_ROLE_OPTIONS.map((opt) => {
              const disabled = isDisabled(opt);
              const reason = disabledReason(opt);
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    if (disabled) return;
                    setIsOpen(false);
                    onSelect(opt.targetRole, opt.relation);
                  }}
                  disabled={disabled}
                  className={`w-full px-4 py-2 text-left text-sm transition flex items-center justify-between ${
                    disabled
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{opt.label}</span>
                  {reason && (
                    <span className="text-xs text-gray-300">{reason}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CreateInvitationModal({
  roleLabel,
  selectedDelivery,
  deliveryContact,
  isCreating,
  onDeliveryChange,
  onContactChange,
  onCreate,
  onClose,
}: {
  roleLabel: string;
  selectedDelivery: DeliveryMethod;
  deliveryContact: string;
  isCreating: boolean;
  onDeliveryChange: (method: DeliveryMethod) => void;
  onContactChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {roleLabel} 초대 생성
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-gray-700">발송 방식</p>
          <div className="space-y-2">
            {DELIVERY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedDelivery === opt.method;
              return (
                <button
                  key={opt.method}
                  onClick={() => onDeliveryChange(opt.method)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon size={18} className={isSelected ? "text-indigo-600" : "text-gray-400"} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? "text-indigo-700" : "text-gray-700"}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDelivery === "sms" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <input
              type="tel"
              value={deliveryContact}
              onChange={(e) => onContactChange(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
        {selectedDelivery === "email" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={deliveryContact}
              onChange={(e) => onContactChange(e.target.value)}
              placeholder="parent@email.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onCreate}
            disabled={isCreating}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                생성 중...
              </>
            ) : (
              <>
                <Send size={14} />
                {selectedDelivery === "manual" ? "생성" : "생성 및 발송"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisconnectModal({
  email,
  provider,
  isDisconnecting,
  onConfirm,
  onClose,
}: {
  email: string;
  provider: string;
  isDisconnecting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">학생 계정 연결 해제</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6 space-y-3">
          <div className="px-4 py-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{email}</span>
              <span className="text-gray-400"> ({PROVIDER_LABEL[provider] ?? provider})</span>
            </p>
          </div>

          <div className="text-sm text-gray-600 space-y-2">
            <p>이 계정의 연결을 해제하면:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>학습 데이터(캘린더, 플랜, 성적)는 모두 유지됩니다</li>
              <li>해당 계정으로는 더 이상 로그인할 수 없습니다</li>
              <li>새 초대를 생성하여 다른 계정을 연결할 수 있습니다</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDisconnecting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isDisconnecting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDisconnecting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                해제 중...
              </>
            ) : (
              <>
                <Unlink size={14} />
                연결 해제
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function QRModal({
  qrDataUrl,
  token,
  onCopyUrl,
  onClose,
}: {
  qrDataUrl: string;
  token: string;
  onCopyUrl: () => void;
  onClose: () => void;
}) {
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${token}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">QR 코드</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="초대 QR 코드" className="w-64 h-64 rounded-lg" />
        </div>

        <p className="text-xs text-gray-500 text-center mb-4 break-all">{joinUrl}</p>

        <div className="flex gap-2">
          <button
            onClick={onCopyUrl}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <Copy size={14} />
            링크 복사
          </button>
          <a
            href={qrDataUrl}
            download={`invite-${token.slice(0, 8)}.png`}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} />
            QR 저장
          </a>
        </div>
      </div>
    </div>
  );
}
