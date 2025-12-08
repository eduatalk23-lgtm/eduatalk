"use client";

import { useState, useTransition } from "react";
import { sendGeneralSMS } from "@/app/actions/smsActions";
import { getAllSMSTemplates, type SMSTemplateType } from "@/lib/services/smsTemplates";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import Select from "@/components/atoms/Select";
import { useToast } from "@/components/ui/ToastProvider";

type Student = {
  id: string;
  name: string | null;
  parent_contact: string | null;
};

type SMSSendFormProps = {
  students: Student[];
};

export function SMSSendForm({ students }: SMSSendFormProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplateType | "">("");
  const [message, setMessage] = useState("");
  const [customPhone, setCustomPhone] = useState("");

  const templates = getAllSMSTemplates();
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // 템플릿 선택 시 메시지 자동 채우기 (예시)
  const handleTemplateChange = (templateType: SMSTemplateType) => {
    const template = templates.find((t) => t.id === templateType);
    if (template) {
      // 템플릿 변수를 예시 값으로 채우기
      let exampleMessage = template.content;
      template.variables.forEach((variable) => {
        exampleMessage = exampleMessage.replace(
          new RegExp(`\\{${variable}\\}`, "g"),
          `[${variable}]`
        );
      });
      setMessage(exampleMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const recipientPhone = customPhone.trim() || selectedStudent?.parent_contact;
    if (!recipientPhone) {
      showError("수신자 전화번호를 입력하거나 학생을 선택해주세요.");
      return;
    }

    if (!message.trim()) {
      showError("메시지 내용을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await sendGeneralSMS(
          recipientPhone,
          message.trim(),
          selectedStudentId || undefined
        );

        if (result.success) {
          showSuccess("SMS가 성공적으로 발송되었습니다.");
          // 폼 초기화
          setMessage("");
          setCustomPhone("");
          setSelectedStudentId("");
          setSelectedTemplate("");
        } else {
          showError(result.error || "SMS 발송에 실패했습니다.");
        }
      } catch (error: any) {
        console.error("[SMS] 발송 실패:", error);
        showError(error.message || "SMS 발송 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">SMS 발송</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="student_select">학생 선택 (선택사항)</Label>
          <Select
            id="student_select"
            value={selectedStudentId}
            onChange={(e) => {
              setSelectedStudentId(e.target.value);
              if (e.target.value) {
                const student = students.find((s) => s.id === e.target.value);
                if (student?.parent_contact) {
                  setCustomPhone("");
                }
              }
            }}
          >
            <option value="">학생 선택 안 함</option>
            {students
              .filter((s) => s.parent_contact)
              .map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name || "이름 없음"} ({student.parent_contact})
                </option>
              ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="phone">수신자 전화번호 *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="010-1234-5678"
            value={customPhone || selectedStudent?.parent_contact || ""}
            onChange={(e) => setCustomPhone(e.target.value)}
            disabled={!!selectedStudentId && !!selectedStudent?.parent_contact}
            required
          />
          {selectedStudentId && selectedStudent?.parent_contact && (
            <p className="mt-1 text-xs text-gray-500">
              선택한 학생의 학부모 연락처가 자동으로 입력됩니다.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="template">템플릿 선택 (선택사항)</Label>
          <Select
            id="template"
            value={selectedTemplate}
            onChange={(e) => {
              const templateType = e.target.value as SMSTemplateType | "";
              setSelectedTemplate(templateType);
              if (templateType) {
                handleTemplateChange(templateType);
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

        <div>
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
          <p className="mt-1 text-xs text-gray-500">
            {message.length}자 / SMS는 90자, LMS는 2000자까지 가능합니다.
          </p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "발송 중..." : "SMS 발송"}
        </Button>
      </form>
    </div>
  );
}

