"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getAllSMSTemplates,
  formatSMSTemplate,
  type SMSTemplateType,
} from "@/lib/services/smsTemplates";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import Select from "@/components/atoms/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { SMSPreviewModal } from "./SMSPreviewModal";
import { SMSSendSummary } from "./SMSSendSummary";
import SMSFilterPanel, {
  type SMSFilter,
  type RecipientType,
} from "./SMSFilterPanel";
import SMSRecipientList from "./SMSRecipientList";
import SelectedRecipientsList from "./SelectedRecipientsList";
import type {
  SMSRecipient,
} from "@/app/api/admin/sms/students/route";

type SMSSendFormProps = {
  academyName?: string;
};

export function SMSSendForm({
  academyName = "학원",
}: SMSSendFormProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  
  // 필터 상태
  const [filter, setFilter] = useState<SMSFilter>({
    search: "",
    grades: [],
    divisions: [],
    recipientTypes: [],
  });
  
  // 조회 결과
  const [queryResults, setQueryResults] = useState<SMSRecipient[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  
  // 선택된 연락처 (누적 선택)
  const [selectedRecipients, setSelectedRecipients] = useState<
    Map<string, SMSRecipient>
  >(new Map());
  
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplateType | "">(
    ""
  );
  const [message, setMessage] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, string>
  >({});
  const [showPreview, setShowPreview] = useState(false);
  const [sendMode, setSendMode] = useState<"single" | "bulk">("bulk");
  // 전송 대상자 선택 (단일 발송 모드용)
  const [recipientType, setRecipientType] = useState<RecipientType>("mother");

  // recipient 키 생성
  const getRecipientKey = useCallback((recipient: SMSRecipient): string => {
    return `${recipient.studentId}-${recipient.recipientType}`;
  }, []);

  // 조회 실행
  const handleSearch = useCallback(async () => {
    if (filter.recipientTypes.length === 0) {
      showError("전송 대상자를 최소 1개 이상 선택해주세요.");
      return;
    }

    setIsLoadingResults(true);
    try {
      // Query Parameters 구성
      const params = new URLSearchParams();
      if (filter.search) {
        params.append("search", filter.search);
      }
      if (filter.grades.length > 0) {
        params.append("grades", filter.grades.join(","));
      }
      if (filter.divisions.length > 0) {
        params.append(
          "divisions",
          filter.divisions.map((d) => (d === null ? "null" : d)).join(",")
        );
      }
      params.append("recipientTypes", filter.recipientTypes.join(","));

      const response = await fetch(
        `/api/admin/sms/students?${params.toString()}`
      );
      const result: { recipients: SMSRecipient[]; total: number; error?: string } =
        await response.json();

      if (!response.ok || result.error) {
        showError(result.error || "조회 중 오류가 발생했습니다.");
        setQueryResults([]);
        return;
      }

      setQueryResults(result.recipients);
    } catch (error) {
      console.error("[SMS] 조회 실패:", error);
      showError("조회 중 오류가 발생했습니다.");
      setQueryResults([]);
    } finally {
      setIsLoadingResults(false);
    }
  }, [filter, showError]);

  // 연락처 선택/해제
  const handleToggleRecipient = useCallback(
    (recipient: SMSRecipient) => {
      setSelectedRecipients((prev) => {
        const next = new Map(prev);
        const key = getRecipientKey(recipient);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.set(key, recipient);
        }
        return next;
      });
    },
    [getRecipientKey]
  );

  // 연락처 제거
  const handleRemoveRecipient = useCallback((key: string) => {
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // 전체 해제
  const handleClearAllRecipients = useCallback(() => {
    setSelectedRecipients(new Map());
  }, []);

  const templates = getAllSMSTemplates();

  // 선택된 연락처 목록 (배열)
  const selectedRecipientsList = useMemo(() => {
    return Array.from(selectedRecipients.values());
  }, [selectedRecipients]);

  // 템플릿 선택 시 메시지 자동 채우기
  const handleTemplateChange = (templateType: SMSTemplateType) => {
    const template = templates.find((t) => t.id === templateType);
    if (template) {
      // 템플릿 변수를 기본값으로 채우기
      const defaultVariables: Record<string, string> = {
        학원명: academyName,
      };

      // 템플릿 변수가 있으면 변수 입력 폼을 위해 저장 (학원명, 학생명 제외)
      const variablesToInput = template.variables.filter(
        (v) => v !== "학원명" && v !== "학생명"
      );
      if (variablesToInput.length > 0) {
        // 기존 변수는 유지하고 새로운 변수만 추가
        setTemplateVariables((prev) => {
          const next = { ...prev };
          variablesToInput.forEach((v) => {
            if (!next[v]) {
              next[v] = "";
            }
          });
          return next;
        });
      } else {
        setTemplateVariables({});
      }

      // 기본 변수로 메시지 생성 (학생명은 예시로 표시)
      try {
        const exampleVariables = {
          ...defaultVariables,
          학생명: "학생명", // 예시
        };
        const formattedMessage = formatSMSTemplate(
          templateType,
          exampleVariables
        );
        setMessage(formattedMessage);
      } catch {
        // 변수가 부족하면 예시로 표시
        let exampleMessage = template.content;
        template.variables.forEach((variable) => {
          if (variable === "학원명") {
            exampleMessage = exampleMessage.replace(
              /\{학원명\}/g,
              academyName
            );
          } else if (variable === "학생명") {
            exampleMessage = exampleMessage.replace(/\{학생명\}/g, "학생명");
          } else {
            exampleMessage = exampleMessage.replace(
              new RegExp(`\\{${variable}\\}`, "g"),
              `[${variable}]`
            );
          }
        });
        setMessage(exampleMessage);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (sendMode === "single") {
      // 단일 발송 모드
      if (!customPhone.trim()) {
        showError("수신자 전화번호를 입력해주세요.");
        return;
      }
    } else {
      // 일괄 발송 모드
      if (selectedRecipients.size === 0) {
        showError("최소 1개 이상의 연락처를 선택해주세요.");
        return;
      }
    }

    if (!message.trim()) {
      showError("메시지 내용을 입력해주세요.");
      return;
    }

    // 미리보기 표시
    if (sendMode === "bulk" && selectedRecipients.size > 0) {
      setShowPreview(true);
      return;
    }

    // 단일 발송은 바로 발송
    handleSend();
  };

  const handleSend = useCallback(() => {
    setShowPreview(false);

    startTransition(async () => {
      try {
        if (sendMode === "single") {
          // 단일 발송 - API Route 호출
          const response = await fetch("/api/purio/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "single",
              phone: customPhone.trim(),
              message: message.trim(),
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            showError(result.error || "SMS 발송에 실패했습니다.");
            return;
          }

          showSuccess("SMS가 성공적으로 발송되었습니다.");
          // 결과 페이지로 이동
          setTimeout(() => {
            router.push("/admin/sms/results");
          }, 1000);
        } else {
          // 일괄 발송 - recipients 배열 전송
          const recipients = selectedRecipientsList.map((r) => ({
            studentId: r.studentId,
            phone: r.phone,
            recipientType: r.recipientType,
          }));

          const response = await fetch("/api/purio/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "bulk",
              recipients,
              message: message.trim(),
              templateVariables: {
                ...templateVariables,
                학원명: academyName,
              },
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            showError(result.error || "SMS 발송에 실패했습니다.");
            return;
          }

          if (result.success > 0) {
            showSuccess(
              `${result.success}명에게 SMS가 성공적으로 발송되었습니다.${
                result.failed > 0
                  ? ` (${result.failed}명 실패)`
                  : ""
              }`
            );
            // 결과 페이지로 이동
            setTimeout(() => {
              router.push("/admin/sms/results");
            }, 1000);
          } else {
            showError(
              result.errors && result.errors.length > 0
                ? result.errors[0].error
                : "SMS 발송에 실패했습니다."
            );
          }
        }
      } catch (error: any) {
        console.error("[SMS] 발송 실패:", error);
        showError(error.message || "SMS 발송 중 오류가 발생했습니다.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sendMode,
    customPhone,
    message,
    selectedRecipientsList,
    templateVariables,
    academyName,
    startTransition,
    // showSuccess와 showError는 useToast에서 가져온 안정적인 함수이므로
    // dependency에 포함하지 않아도 됩니다 (클로저로 캡처됨)
  ]);

  // 선택된 템플릿
  const selectedTemplateObj = useMemo(() => {
    if (!selectedTemplate) return null;
    return templates.find((t) => t.id === selectedTemplate);
  }, [selectedTemplate, templates]);

  return (
    <>
      <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">SMS 발송</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 발송 모드 선택 */}
          <div className="flex flex-col gap-2">
            <Label>발송 모드</Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="sendMode"
                  value="bulk"
                  checked={sendMode === "bulk"}
                  onChange={() => {
                    setSendMode("bulk");
                    setCustomPhone("");
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">일괄 발송</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="sendMode"
                  value="single"
                  checked={sendMode === "single"}
                  onChange={() => {
                    setSendMode("single");
                    setSelectedRecipients(new Map());
                    setCustomPhone("");
                    setSelectedStudentName("");
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">단일 발송</span>
              </label>
            </div>
          </div>

          {/* 발송 대상자 선택 (일괄 발송 모드) */}
          {sendMode === "bulk" && (
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
              {/* 필터 패널 */}
              <div className="lg:col-span-1">
                <SMSFilterPanel
                  filter={filter}
                  onFilterChange={setFilter}
                  onSearch={handleSearch}
                  isLoading={isLoadingResults}
                />
              </div>

              {/* 조회 결과 및 선택된 연락처 */}
              <div className="flex flex-col gap-6 lg:col-span-1">
                {/* 조회 결과 */}
                {queryResults.length > 0 && (
                  <SMSRecipientList
                    recipients={queryResults}
                    selectedRecipients={selectedRecipients}
                    onToggleRecipient={handleToggleRecipient}
                    isLoading={isLoadingResults}
                  />
                )}

                {/* 선택된 연락처 목록 */}
                {selectedRecipients.size > 0 && (
                  <SelectedRecipientsList
                    selectedRecipients={selectedRecipients}
                    onRemoveRecipient={handleRemoveRecipient}
                    onClearAll={handleClearAllRecipients}
                  />
                )}

                {/* 조회 결과가 없을 때 안내 */}
                {queryResults.length === 0 && !isLoadingResults && (
                  <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                    <p className="text-sm text-gray-500">
                      필터를 설정하고 조회 버튼을 클릭하여 발송 대상을 검색하세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 전송 대상자 선택 (단일 발송 모드 전용) */}
          {sendMode === "single" && (
            <div className="flex flex-col gap-2">
              <Label>전송 대상자</Label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="recipientType"
                    value="student"
                    checked={recipientType === "student"}
                    onChange={() => setRecipientType("student")}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">학생 본인</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="recipientType"
                    value="mother"
                    checked={recipientType === "mother"}
                    onChange={() => setRecipientType("mother")}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">어머니</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="recipientType"
                    value="father"
                    checked={recipientType === "father"}
                    onChange={() => setRecipientType("father")}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">아버지</span>
                </label>
              </div>
            </div>
          )}

          {/* 수신자 입력 (단일 발송 모드) */}
          {sendMode === "single" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">수신자 전화번호 *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="010-1234-5678"
                value={customPhone}
                onChange={(e) => {
                  setCustomPhone(e.target.value);
                  if (!e.target.value) {
                    setSelectedStudentName("");
                  }
                }}
                required
              />
              {selectedStudentName && (
                <p className="text-xs text-gray-600">
                  선택된 학생: {selectedStudentName}
                </p>
              )}
            </div>
          )}

          {/* 템플릿 선택 및 메시지 입력 섹션 */}
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
            {/* 템플릿 선택 */}
            <div className="flex flex-col gap-2 lg:col-span-1">
              <Label htmlFor="template">템플릿 선택 (선택사항)</Label>
              <Select
                id="template"
                value={selectedTemplate}
                onChange={(e) => {
                  const templateType = e.target.value as SMSTemplateType | "";
                  setSelectedTemplate(templateType);
                  if (templateType) {
                    handleTemplateChange(templateType);
                  } else {
                    setTemplateVariables({});
                  }
                }}
              >
                <option value="">템플릿 선택 안 함</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </Select>
            </div>

            {/* 메시지 내용 */}
            <div className="flex flex-col gap-1 lg:col-span-1">
              <Label htmlFor="message">메시지 내용 *</Label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="메시지 내용을 입력하세요..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                rows={4}
                required
              />
              <p className="text-xs text-gray-500">
                {message.length}자 / SMS는 90자, LMS는 2000자까지 가능합니다.
              </p>
            </div>
          </div>

          {/* 템플릿 변수 입력 (템플릿 선택 시) */}
          {selectedTemplateObj &&
            selectedTemplateObj.variables.length > 0 &&
            selectedTemplateObj.variables.filter(
              (v) => v !== "학원명" && v !== "학생명"
            ).length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <Label className="block text-sm font-medium text-gray-700">
                  템플릿 변수 입력
                </Label>
                <div className="flex flex-col gap-2">
                  {selectedTemplateObj.variables
                    .filter((v) => v !== "학원명" && v !== "학생명")
                    .map((variable) => (
                      <div key={variable}>
                        <Label htmlFor={`var-${variable}`} className="text-xs">
                          {variable}
                        </Label>
                        <Input
                          id={`var-${variable}`}
                          type="text"
                          value={templateVariables[variable] || ""}
                          onChange={(e) =>
                            setTemplateVariables((prev) => ({
                              ...prev,
                              [variable]: e.target.value,
                            }))
                          }
                          placeholder={`${variable} 입력`}
                        />
                      </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500">
                  * 학원명과 학생명은 자동으로 채워집니다.
                </p>
              </div>
            )}

          {/* 발송 요약 (일괄 발송 모드) */}
          {sendMode === "bulk" && selectedRecipients.size > 0 && (
            <SMSSendSummary
              recipientCount={selectedRecipients.size}
              messageLength={message.length}
            />
          )}

          {/* 발송 버튼 */}
          <div className="flex justify-end gap-2">
            {sendMode === "bulk" && selectedRecipients.size > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(true)}
                disabled={isPending || !message.trim()}
              >
                미리보기
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                isPending ||
                !message.trim() ||
                (sendMode === "bulk" && selectedRecipients.size === 0)
              }
            >
              {isPending ? "발송 중..." : "SMS 발송"}
            </Button>
          </div>
        </form>
      </div>

      {/* 미리보기 모달 */}
      {sendMode === "bulk" && (
        <SMSPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          onConfirm={handleSend}
          selectedRecipients={selectedRecipientsList}
          message={message}
          templateType={selectedTemplate || undefined}
          templateVariables={templateVariables}
          academyName={academyName}
          isSending={isPending}
        />
      )}
    </>
  );
}

