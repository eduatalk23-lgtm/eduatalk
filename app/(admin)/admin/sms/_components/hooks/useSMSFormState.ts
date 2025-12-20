"use client";

import { useState, useCallback, useMemo } from "react";
import {
  getAllSMSTemplates,
  formatSMSTemplate,
  type SMSTemplateType,
} from "@/lib/services/smsTemplates";

type UseSMSFormStateProps = {
  academyName?: string;
  initialSendMode?: "single" | "bulk";
};

export function useSMSFormState({
  academyName = "학원",
  initialSendMode = "bulk",
}: UseSMSFormStateProps = {}) {
  // 발송 모드
  const [sendMode, setSendMode] = useState<"single" | "bulk">(initialSendMode);

  // 메시지 관련 상태
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplateType | "">(
    ""
  );
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, string>
  >({});

  // 단일 발송 관련 상태
  const [customPhone, setCustomPhone] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [recipientType, setRecipientType] = useState<
    "student" | "mother" | "father"
  >("mother");

  const templates = getAllSMSTemplates();

  // 선택된 템플릿 객체
  const selectedTemplateObj = useMemo(() => {
    if (!selectedTemplate) return null;
    return templates.find((t) => t.id === selectedTemplate);
  }, [selectedTemplate, templates]);

  // 템플릿 선택 핸들러
  const handleTemplateChange = useCallback(
    (templateType: SMSTemplateType) => {
      const template = templates.find((t) => t.id === templateType);
      if (!template) return;

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
    },
    [templates, academyName]
  );

  // 템플릿 선택 변경 핸들러
  const handleTemplateSelect = useCallback(
    (templateType: SMSTemplateType | "") => {
      setSelectedTemplate(templateType);
      if (templateType) {
        handleTemplateChange(templateType);
      } else {
        setTemplateVariables({});
      }
    },
    [handleTemplateChange]
  );

  // 발송 모드 변경 핸들러
  const handleSendModeChange = useCallback((mode: "single" | "bulk") => {
    setSendMode(mode);
    if (mode === "single") {
      setCustomPhone("");
      setSelectedStudentName("");
    }
  }, []);

  // 템플릿 변수 업데이트
  const updateTemplateVariable = useCallback(
    (variable: string, value: string) => {
      setTemplateVariables((prev) => ({
        ...prev,
        [variable]: value,
      }));
    },
    []
  );

  // 폼 초기화
  const resetForm = useCallback(() => {
    setMessage("");
    setSelectedTemplate("");
    setTemplateVariables({});
    setCustomPhone("");
    setSelectedStudentName("");
  }, []);

  return {
    // 상태
    sendMode,
    message,
    selectedTemplate,
    selectedTemplateObj,
    templateVariables,
    customPhone,
    selectedStudentName,
    recipientType,
    templates,

    // 핸들러
    setSendMode: handleSendModeChange,
    setMessage,
    setSelectedTemplate: handleTemplateSelect,
    setTemplateVariables: updateTemplateVariable,
    setCustomPhone,
    setSelectedStudentName,
    setRecipientType,
    resetForm,
  };
}

