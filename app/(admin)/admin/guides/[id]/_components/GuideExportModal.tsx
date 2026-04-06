"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Link2, Check, FileText, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import type { GuideType } from "@/lib/domains/guide/types";
import { GUIDE_SECTION_CONFIG } from "@/lib/domains/guide/section-config";

interface GuideExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideType: GuideType;
  /** "download" = PDF/DOCX, "share" = 공유 링크 생성 */
  mode: "download" | "share";
  onConfirm: (
    selectedKeys: string[],
    options: {
      format?: "pdf" | "docx";
      includeBookInfo: boolean;
      includeRelatedPapers: boolean;
      includeRelatedBooks: boolean;
    },
  ) => void;
  isLoading?: boolean;
  /** 실제 콘텐츠가 있는 섹션 키 목록 */
  availableSectionKeys?: string[];
  /** 독서탐구 도서 정보 존재 여부 */
  hasBookInfo?: boolean;
  /** 관련 논문 존재 여부 */
  hasRelatedPapers?: boolean;
  /** 관련 도서 존재 여부 */
  hasRelatedBooks?: boolean;
}

const STORAGE_KEY_PREFIX = "guide-export-sections-";

export function GuideExportModal({
  open,
  onOpenChange,
  guideType,
  mode,
  onConfirm,
  isLoading = false,
  availableSectionKeys,
  hasBookInfo = false,
  hasRelatedPapers = false,
  hasRelatedBooks = false,
}: GuideExportModalProps) {
  const availableSet = useMemo(
    () => (availableSectionKeys ? new Set(availableSectionKeys) : null),
    [availableSectionKeys],
  );
  const sections = useMemo(
    () =>
      (GUIDE_SECTION_CONFIG[guideType] ?? [])
        .sort((a, b) => a.order - b.order),
    [guideType],
  );

  const allKeys = useMemo(() => sections.map((s) => s.key), [sections]);
  /** 실제 콘텐츠가 있는 섹션 키 */
  const activeKeys = useMemo(
    () => (availableSet ? allKeys.filter((k) => availableSet.has(k)) : allKeys),
    [allKeys, availableSet],
  );

  // 섹션 선택 상태
  const [selectedKeys, setSelectedKeys] = useState<string[]>(activeKeys);
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [includeBookInfo, setIncludeBookInfo] = useState(true);
  const [includeRelatedPapers, setIncludeRelatedPapers] = useState(false);
  const [includeRelatedBooks, setIncludeRelatedBooks] = useState(false);

  // localStorage에서 이전 선택 복원
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + guideType);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          keys: string[];
          bookInfo?: boolean;
          papers?: boolean;
          books?: boolean;
        };
        // 현재 유효하고 콘텐츠가 있는 키만 필터
        setSelectedKeys(parsed.keys.filter((k: string) => activeKeys.includes(k)));
        if (parsed.bookInfo !== undefined) setIncludeBookInfo(parsed.bookInfo);
        if (parsed.papers !== undefined) setIncludeRelatedPapers(parsed.papers);
        if (parsed.books !== undefined) setIncludeRelatedBooks(parsed.books);
      } else {
        setSelectedKeys(activeKeys);
      }
    } catch {
      setSelectedKeys(activeKeys);
    }
   
  }, [open, guideType, activeKeys]);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) =>
      prev.length === activeKeys.length ? [] : [...activeKeys],
    );
  }, [activeKeys]);

  const handleConfirm = () => {
    // localStorage에 선택 저장
    try {
      localStorage.setItem(
        STORAGE_KEY_PREFIX + guideType,
        JSON.stringify({
          keys: selectedKeys,
          bookInfo: includeBookInfo,
          papers: includeRelatedPapers,
          books: includeRelatedBooks,
        }),
      );
    } catch { /* ignore */ }

    onConfirm(selectedKeys, {
      format: mode === "download" ? format : undefined,
      includeBookInfo,
      includeRelatedPapers,
      includeRelatedBooks,
    });
  };

  const allSelected = selectedKeys.length === activeKeys.length;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "download" ? "가이드 내보내기" : "공유 링크 생성"}
      description="포함할 구성 요소를 선택하세요"
      size="md"
      showCloseButton
    >
      <DialogContent className="space-y-4 overflow-y-auto max-h-[60vh]">
        {/* 전체 선택 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            전체 {allSelected ? "해제" : "선택"}
          </span>
        </label>

        <div className="border-t border-secondary-200 dark:border-secondary-700" />

        {/* 섹션 체크박스 */}
        <div className="space-y-2">
          {sections.map((def) => {
            const hasContent = !availableSet || availableSet.has(def.key);
            return (
              <label key={def.key} className={`flex items-center gap-2 ${hasContent ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(def.key)}
                  onChange={() => toggleKey(def.key)}
                  disabled={!hasContent}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <span className="text-sm text-[var(--text-primary)]">
                  {def.label}
                </span>
                {!hasContent && (
                  <span className="text-[10px] text-[var(--text-secondary)]">내용 없음</span>
                )}
              </label>
            );
          })}
        </div>

        {/* 추가 옵션 */}
        <div className="border-t border-secondary-200 dark:border-secondary-700 pt-3 space-y-2">
          <p className="text-xs font-medium text-[var(--text-secondary)]">추가 항목</p>
          {hasBookInfo && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBookInfo}
                onChange={(e) => setIncludeBookInfo(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-[var(--text-primary)]">도서 정보</span>
            </label>
          )}
          {hasRelatedPapers && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRelatedPapers}
                onChange={(e) => setIncludeRelatedPapers(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-[var(--text-primary)]">관련 논문</span>
            </label>
          )}
          {hasRelatedBooks && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRelatedBooks}
                onChange={(e) => setIncludeRelatedBooks(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-[var(--text-primary)]">관련 도서</span>
            </label>
          )}
        </div>

        {/* 다운로드 포맷 선택 */}
        {mode === "download" && (
          <div className="border-t border-secondary-200 dark:border-secondary-700 pt-3">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">파일 형식</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="pdf"
                  checked={format === "pdf"}
                  onChange={() => setFormat("pdf")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <FileText className="w-4 h-4 text-red-500" />
                <span className="text-sm text-[var(--text-primary)]">PDF</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="docx"
                  checked={format === "docx"}
                  onChange={() => setFormat("docx")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <FileDown className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-[var(--text-primary)]">Word (DOCX)</span>
              </label>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          isLoading={isLoading}
          disabled={selectedKeys.length === 0}
        >
          {mode === "download" ? (
            <>
              <Download className="w-4 h-4 mr-1.5" />
              다운로드
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4 mr-1.5" />
              링크 생성
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
