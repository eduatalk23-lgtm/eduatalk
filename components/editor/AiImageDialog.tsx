"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import type { AspectRatio } from "@/lib/domains/guide/actions/ai-image";

interface AiImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string, aspectRatio: AspectRatio) => Promise<void>;
  isGenerating: boolean;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
];

export function AiImageDialog({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: AiImageDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("프롬프트를 입력해주세요.");
      return;
    }
    if (trimmed.length > 500) {
      setError("프롬프트는 500자 이하여야 합니다.");
      return;
    }
    setError("");
    await onGenerate(trimmed, aspectRatio);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isGenerating) {
      setPrompt("");
      setAspectRatio("1:1");
      setError("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="AI 이미지 생성"
      description="Imagen 3 모델로 이미지를 생성합니다."
      size="md"
    >
      <DialogContent>
        <div className="space-y-4">
          {/* 프롬프트 입력 */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-heading)] mb-1.5">
              프롬프트
            </label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (error) setError("");
              }}
              rows={3}
              maxLength={500}
              disabled={isGenerating}
              placeholder="생성할 이미지를 설명하세요..."
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm resize-none",
                "border-secondary-200 dark:border-secondary-700",
                "bg-white dark:bg-secondary-900",
                "text-[var(--text-primary)]",
                "placeholder:text-[var(--text-secondary)]",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            />
            <div className="flex justify-between mt-1">
              {error ? (
                <p className="text-xs text-red-500">{error}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-[var(--text-secondary)]">
                {prompt.length}/500
              </span>
            </div>
          </div>

          {/* 비율 선택 */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-heading)] mb-1.5">
              이미지 비율
            </label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.value}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setAspectRatio(ar.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    aspectRatio === ar.value
                      ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-600"
                      : "border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800",
                  )}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={isGenerating}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={isGenerating || !prompt.trim()}
          isLoading={isGenerating}
        >
          {isGenerating ? (
            "생성 중..."
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              생성
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
