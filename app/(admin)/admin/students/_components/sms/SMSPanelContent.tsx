"use client";

import { useState, useCallback, useTransition, useMemo, useEffect, useRef } from "react";
import { Send, ChevronDown, ChevronUp, Loader2, Settings2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { CombinedTemplateSelector } from "./CombinedTemplateSelector";
import { TemplateManager } from "./TemplateManager";
import {
  substituteTemplateVariables,
  extractTemplateVariables,
  calculateMessageBytes,
  getMessageType,
} from "@/lib/domains/sms/utils/templateSubstitution";
import type { SMSPanelPhoneData, SMSCustomTemplate, SMSLogEntry } from "@/lib/domains/sms/types";

type SMSPanelContentProps = {
  studentId: string;
  studentName: string;
  phoneData: SMSPanelPhoneData;
  customTemplates: SMSCustomTemplate[];
  smsHistory: SMSLogEntry[];
  academyName: string;
  onRefreshTemplates: () => void;
  onRefreshHistory: () => void;
};

type RecipientKey = "student" | "mother" | "father";

const RECIPIENT_LABELS: Record<RecipientKey, string> = {
  student: "본인",
  mother: "어머니",
  father: "아버지",
};

export function SMSPanelContent({
  studentId,
  studentName,
  phoneData,
  customTemplates,
  smsHistory,
  academyName,
  onRefreshTemplates,
  onRefreshHistory,
}: SMSPanelContentProps) {
  const { showError } = useToast();
  const [isPending, startTransition] = useTransition();

  // 수신자 선택
  const [selectedRecipients, setSelectedRecipients] = useState<Set<RecipientKey>>(
    () => {
      const initial = new Set<RecipientKey>();
      if (phoneData.mother_phone) initial.add("mother");
      else if (phoneData.father_phone) initial.add("father");
      else if (phoneData.phone) initial.add("student");
      return initial;
    }
  );

  // 템플릿 & 메시지
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // UI 상태
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; fail: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const phones: Record<RecipientKey, string | null> = {
    student: phoneData.phone,
    mother: phoneData.mother_phone,
    father: phoneData.father_phone,
  };

  const toggleRecipient = useCallback((key: RecipientKey) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 템플릿 변수 중 자동 주입 가능한 것들
  const autoVars: Record<string, string> = useMemo(
    () => ({ 학원명: academyName, 학생명: studentName }),
    [academyName, studentName]
  );

  // 템플릿 선택 핸들러
  const handleTemplateChange = useCallback(
    (id: string, content: string, variables: string[]) => {
      setSelectedTemplateId(id);
      if (id && content) {
        // 자동 주입 변수를 치환한 결과를 메시지에 채움
        const initialVars: Record<string, string> = {};
        for (const v of variables) {
          if (autoVars[v]) {
            initialVars[v] = autoVars[v];
          }
        }
        setTemplateVariables(initialVars);
        setMessage(substituteTemplateVariables(content, initialVars));
      } else {
        setMessage("");
        setTemplateVariables({});
      }
    },
    [autoVars]
  );

  // 변수 값 변경 시 메시지 재생성
  const handleVariableChange = useCallback(
    (key: string, value: string) => {
      setTemplateVariables((prev) => {
        const next = { ...prev, [key]: value };
        // 템플릿에서 현재 변수들로 재치환
        const tmpl = customTemplates.find((t) => t.id === selectedTemplateId);
        if (tmpl) {
          setMessage(substituteTemplateVariables(tmpl.content, { ...autoVars, ...next }));
        }
        return next;
      });
    },
    [selectedTemplateId, customTemplates, autoVars]
  );

  // 현재 템플릿의 수동 입력 필요 변수
  const manualVariables = useMemo(() => {
    const vars = extractTemplateVariables(message);
    // 이미 치환된 변수 + 자동 주입 변수 제외
    return vars.filter((v) => !autoVars[v] && !templateVariables[v]);
  }, [message, autoVars, templateVariables]);

  // 메시지 통계
  const msgBytes = calculateMessageBytes(message);
  const msgType = getMessageType(message);

  // 발송 가능한 수신자
  const validRecipients = useMemo(
    () =>
      Array.from(selectedRecipients)
        .filter((key) => phones[key])
        .map((key) => ({ type: key, phone: phones[key]! })),
    [selectedRecipients, phones]
  );

  // 미리보기 메시지
  const previewMessage = useMemo(() => {
    return substituteTemplateVariables(message, { ...autoVars, ...templateVariables });
  }, [message, autoVars, templateVariables]);

  // 발송
  const handleSend = useCallback(() => {
    if (validRecipients.length === 0) {
      showError("수신자를 선택해주세요.");
      return;
    }
    if (!message.trim()) {
      showError("메시지 내용을 입력해주세요.");
      return;
    }
    setShowPreview(true);
  }, [validRecipients, message, showError]);

  const resetForm = useCallback(() => {
    setMessage("");
    setSubject("");
    setSelectedTemplateId("");
    setTemplateVariables({});
  }, []);

  const handleConfirmSend = useCallback(() => {
    startTransition(async () => {
      let successCount = 0;
      let failCount = 0;

      for (const recipient of validRecipients) {
        try {
          const res = await fetch("/api/purio/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "single",
              phone: recipient.phone,
              message: previewMessage,
              recipientId: studentId,
              ...(subject.trim() ? { subject: subject.trim() } : {}),
            }),
          });
          const result = await res.json();
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setShowPreview(false);

      if (successCount > 0) {
        resetForm();
        setSendResult({ success: successCount, fail: failCount });
        onRefreshHistory();
        // 스크롤 최상단 이동
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        showError("발송에 실패했습니다.");
      }
    });
  }, [validRecipients, previewMessage, studentId, subject, resetForm, showError, onRefreshHistory]);

  // 발송 결과 배너 자동 숨김
  useEffect(() => {
    if (!sendResult) return;
    const timer = setTimeout(() => setSendResult(null), 4000);
    return () => clearTimeout(timer);
  }, [sendResult]);

  // 미리보기 모달 열릴 때 ESC로 모달만 닫기 (패널 닫기 방지)
  useEffect(() => {
    if (!showPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowPreview(false);
      }
    };
    // capture 단계에서 잡아야 SlideOverPanel의 ESC 핸들러보다 먼저 실행
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showPreview]);

  return (
    <div ref={scrollRef} className="flex flex-col gap-6">
      {/* 발송 완료 배너 */}
      {sendResult && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <span>
            {sendResult.success}건 발송 완료
            {sendResult.fail > 0 && <span className="text-red-600">, {sendResult.fail}건 실패</span>}
          </span>
        </div>
      )}

      {/* 1. 수신자 선택 */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">수신자 선택</h3>
        <div className="flex flex-col gap-2">
          {(["student", "mother", "father"] as RecipientKey[]).map((key) => {
            const phone = phones[key];
            const disabled = !phone;
            const checked = selectedRecipients.has(key);

            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                  disabled
                    ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-50"
                    : checked
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleRecipient(key)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  {RECIPIENT_LABELS[key]}
                </span>
                <span className="ml-auto text-sm text-gray-500">
                  {phone ?? "번호 없음"}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* 2. 템플릿 & 메시지 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">메시지 작성</h3>
          <button
            type="button"
            onClick={() => setShowTemplateManager(!showTemplateManager)}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 transition hover:text-indigo-700"
          >
            <Settings2 className="h-3.5 w-3.5" />
            템플릿 관리
          </button>
        </div>

        {showTemplateManager && (
          <div className="mb-4">
            <TemplateManager
              templates={customTemplates}
              onRefresh={onRefreshTemplates}
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <CombinedTemplateSelector
            customTemplates={customTemplates}
            selectedTemplateId={selectedTemplateId}
            onChange={handleTemplateChange}
          />

          {/* 수동 입력 변수 필드 */}
          {manualVariables.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <span className="text-xs font-medium text-amber-800">
                아래 변수를 입력해주세요:
              </span>
              {manualVariables.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-amber-700">{`{${v}}`}</span>
                  <input
                    type="text"
                    value={templateVariables[v] ?? ""}
                    onChange={(e) => handleVariableChange(v, e.target.value)}
                    placeholder={v}
                    className="flex-1 rounded border border-amber-300 px-2 py-1 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* 제목 (뿌리오 발송 관리용, SMS/LMS 공통) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                제목
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="발송 제목 (최대 30자)"
                maxLength={30}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span className="mt-0.5 block text-xs text-gray-400">
                {msgType === "LMS"
                  ? "LMS: 수신자 알림에 제목이 표시됩니다."
                  : "SMS: 수신자에게는 표시되지 않으며, 뿌리오 발송 관리용으로 사용됩니다."}
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                본문
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="메시지 내용을 입력하세요..."
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {"{학원명}"}, {"{학생명}"} 자동 치환
              </span>
              <span className={`text-xs font-medium ${msgBytes > 2000 ? "text-red-600" : msgBytes > 90 ? "text-amber-600" : "text-gray-500"}`}>
                {message.length}자 / {msgBytes}byte ({msgType})
              </span>
            </div>

            {/* 스팸 필터 경고 */}
            {msgType === "LMS" && message.includes("https://") && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-red-700">
                    통신사 스팸 차단 주의
                  </span>
                  <span className="text-xs text-red-600">
                    https:// 링크가 포함된 LMS는 통신사에서 스팸으로 차단될 수 있습니다.
                    URL은 &quot;eduatalk.vercel.app&quot; 형태로 프로토콜 없이 작성하세요.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 발송 버튼 */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || validRecipients.length === 0 || !message.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isPending ? "발송 중..." : `발송하기 (${validRecipients.length}건)`}
          </button>
        </div>
      </section>

      {/* 3. 발송 이력 (접이식) */}
      <section>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
        >
          발송 이력 ({smsHistory.length}건)
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showHistory && (
          <div className="mt-2 max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {smsHistory.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                발송 이력이 없습니다.
              </p>
            ) : (
              smsHistory.map((log) => (
                <div key={log.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString("ko-KR")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {log.recipient_phone}
                    </span>
                    <StatusBadge status={log.status} />
                    {log.channel && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-3xs font-medium text-gray-600">
                        {log.channel.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-600">
                    {log.message_content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* 미리보기 모달 */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">발송 미리보기</h3>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-xs text-gray-500">
                수신자: {validRecipients.map((r) => `${RECIPIENT_LABELS[r.type]} (${r.phone})`).join(", ")}
              </div>
              {subject.trim() && (
                <div className="mb-1 text-sm font-semibold text-gray-900">
                  [{msgType}] {subject}
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm text-gray-900">
                {previewMessage}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isPending ? "발송 중..." : "발송하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    sent: { bg: "bg-green-100", text: "text-green-700", label: "발송완료" },
    delivered: { bg: "bg-blue-100", text: "text-blue-700", label: "수신확인" },
    failed: { bg: "bg-red-100", text: "text-red-700", label: "실패" },
    scheduled: { bg: "bg-amber-100", text: "text-amber-700", label: "예약" },
    pending: { bg: "bg-gray-100", text: "text-gray-700", label: "대기" },
  };

  const c = config[status] ?? { bg: "bg-gray-100", text: "text-gray-600", label: status };

  return (
    <span className={`rounded-full px-2 py-0.5 text-3xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
