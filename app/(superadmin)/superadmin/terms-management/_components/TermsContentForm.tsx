"use client";

import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import {
  createTermsContent,
  updateTermsContent,
  activateTermsContent,
  getTermsContentById,
} from "@/app/(superadmin)/actions/termsContents";
import type { TermsContentType, TermsContentInput } from "@/lib/types/terms";
import FormInput from "@/components/ui/FormInput";
import FormMessage from "@/components/ui/FormMessage";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import Button from "@/components/atoms/Button";
import { X } from "lucide-react";

type TermsContentFormProps = {
  contentType: TermsContentType;
  contentId?: string | "new";
  onCancel: () => void;
  onSuccess: () => void;
};

type FormState = {
  error?: string;
  message?: string;
};

const initialState: FormState = { error: "", message: "" };

async function formAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const contentType = formData.get("contentType") as TermsContentType;
  const contentId = formData.get("contentId") as string;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const shouldActivate = formData.get("shouldActivate") === "true";

  if (!title || !content) {
    return {
      error: "제목과 내용을 모두 입력해주세요.",
    };
  }

  try {
    if (contentId === "new") {
      // 새 버전 생성
      const result = await createTermsContent({
        content_type: contentType,
        title,
        content,
      });

      if (!result.success) {
        return {
          error: result.error || "약관 생성에 실패했습니다.",
        };
      }

      // 활성화 요청이 있으면 활성화
      if (shouldActivate && result.data) {
        const activateResult = await activateTermsContent(result.data.id);
        if (!activateResult.success) {
          return {
            error: activateResult.error || "약관 활성화에 실패했습니다.",
          };
        }
      }

      return {
        message: "약관이 성공적으로 생성되었습니다.",
      };
    } else {
      // 기존 버전 수정
      const result = await updateTermsContent(contentId, {
        title,
        content,
      });

      if (!result.success) {
        return {
          error: result.error || "약관 수정에 실패했습니다.",
        };
      }

      // 활성화 요청이 있으면 활성화
      if (shouldActivate) {
        const activateResult = await activateTermsContent(contentId);
        if (!activateResult.success) {
          return {
            error: activateResult.error || "약관 활성화에 실패했습니다.",
          };
        }
      }

      return {
        message: "약관이 성공적으로 수정되었습니다.",
      };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

export function TermsContentForm({
  contentType,
  contentId = "new",
  onCancel,
  onSuccess,
}: TermsContentFormProps) {
  const [state, formActionWithState] = useActionState<FormState, FormData>(
    formAction,
    initialState
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shouldActivate, setShouldActivate] = useState(false);
  const [loading, setLoading] = useState(contentId !== "new");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (contentId !== "new") {
      loadContent();
    }
  }, [contentId]);

  useEffect(() => {
    if (state.message) {
      const timer = setTimeout(() => {
        onSuccess();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.message, onSuccess]);

  const loadContent = async () => {
    if (contentId === "new") return;

    setLoading(true);
    try {
      const result = await getTermsContentById(contentId);
      if (result.success && result.data) {
        setTitle(result.data.title);
        setContent(result.data.content);
        setShouldActivate(result.data.is_active);
      } else {
        console.error("약관 로드 실패:", result.error);
      }
    } catch (error) {
      console.error("약관 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (formData: FormData) => {
    formData.append("contentType", contentType);
    formData.append("contentId", contentId);
    formData.append("shouldActivate", shouldActivate.toString());
    startTransition(() => {
      formActionWithState(formData);
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {contentId === "new" ? "새 버전 생성" : "약관 수정"}
        </h2>
        <Button onClick={onCancel} variant="outline" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="contentType" value={contentType} />
        <input type="hidden" name="contentId" value={contentId} />

        <FormInput
          label="제목"
          name="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="약관 제목을 입력하세요"
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="content" className="text-sm font-medium text-gray-700">
            내용 (마크다운) <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="약관 내용을 마크다운 형식으로 입력하세요"
            rows={20}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500">
            마크다운 형식으로 입력하세요. 미리보기에서 확인할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="shouldActivate"
            checked={shouldActivate}
            onChange={(e) => setShouldActivate(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="shouldActivate" className="text-sm text-gray-700">
            저장 후 즉시 활성화 (기존 활성 버전은 자동으로 비활성화됩니다)
          </label>
        </div>

        {state?.error && <FormMessage type="error" message={state.error} />}
        {state?.message && (
          <FormMessage type="success" message={state.message} />
        )}

        <div className="flex items-center gap-2">
          <FormSubmitButton
            defaultText={contentId === "new" ? "생성" : "수정"}
            pendingText={contentId === "new" ? "생성 중..." : "수정 중..."}
            disabled={isPending}
          />
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            disabled={isPending}
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}

