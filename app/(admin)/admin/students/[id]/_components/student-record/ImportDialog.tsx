"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  detectFileFormat,
  validateImportFile,
  extractContent,
  ACCEPT_FILE_TYPES,
} from "@/lib/domains/student-record/import/extractor";
import type {
  ImportPreviewData,
  ImportPhase,
  ManualSubjectMapping,
  SubjectMatch,
} from "@/lib/domains/student-record/import/types";
// dynamic import — SSR에서 @google/genai import 방지
const loadParser = () => import("@/lib/domains/student-record/import/parser");
const loadHtmlParser = () => import("@/lib/domains/student-record/import/html-parser");
import {
  matchAndPreviewAction,
  executeImportAction,
} from "@/lib/domains/student-record/actions/import";

// ============================================
// Props
// ============================================

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  tenantId: string;
  subjects: { id: string; name: string }[];
};

// ============================================
// 메인 컴포넌트
// ============================================

export function ImportDialog({
  open,
  onOpenChange,
  studentId,
  tenantId,
  subjects,
}: ImportDialogProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [manualMappings, setManualMappings] = useState<ManualSubjectMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setMessage("");
    setSelectedFile(null);
    setPreview(null);
    setOverwrite(false);
    setManualMappings([]);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === "extracting" || phase === "parsing" || phase === "importing") return;
    reset();
    onOpenChange(false);
  }, [phase, reset, onOpenChange]);

  // ============================================
  // 파일 선택
  // ============================================

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validationError = validateImportFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setSelectedFile(file);
      setError(null);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;

      const validationError = validateImportFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setSelectedFile(file);
      setError(null);
    },
    [],
  );

  // ============================================
  // 분석 시작 (Extract → Parse → Preview)
  // ============================================

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const format = detectFileFormat(selectedFile);
      if (!format) throw new Error("지원하지 않는 파일 형식입니다.");

      let parsed;

      if (format === "html") {
        // ── HTML: 직접 파싱 (AI 없이 즉시) ──
        setPhase("extracting");
        setMessage("HTML 파일을 분석하는 중...");
        setProgress(30);

        const htmlContent = await selectedFile.text();
        const { parseNeisHtml } = await loadHtmlParser();
        parsed = parseNeisHtml(htmlContent);
        setProgress(80);
      } else {
        // ── PDF / 이미지: Gemini AI 호출 ──
        const geminiApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
        if (!geminiApiKey) {
          setError("NEXT_PUBLIC_GOOGLE_API_KEY가 설정되지 않았습니다.");
          return;
        }

        setPhase("extracting");
        setMessage("파일에서 콘텐츠를 추출하는 중...");
        setProgress(10);

        const content = await extractContent(selectedFile, (p) => {
          setProgress(10 + Math.round(p * 0.3));
        });

        setPhase("parsing");
        setMessage("AI가 생기부를 분석하는 중... (1~3분 소요)");
        setProgress(50);

        const progressTimer = setInterval(() => {
          setProgress((prev) => (prev < 90 ? prev + 1 : prev));
        }, 2000);

        try {
          const { parseRecordContent } = await loadParser();
          parsed = await parseRecordContent(content, geminiApiKey);
          clearInterval(progressTimer);
        } catch (innerErr) {
          clearInterval(progressTimer);
          throw innerErr;
        }
      }

      // ── 과목 매칭 (서버 — JSON만 전송) ──
      setPhase("matching");
      setMessage("과목명을 매칭하는 중...");
      setProgress(92);

      const result = await matchAndPreviewAction(parsed);

      if (!result.success) {
        throw new Error(result.error ?? "과목 매칭 실패");
      }
      if (!result.data) {
        throw new Error("매칭 결과가 없습니다.");
      }

      setProgress(100);
      setPreview(result.data);
      setPhase("previewing");
      setMessage("분석 완료");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    }
  }, [selectedFile]);

  // ============================================
  // DB 저장 실행
  // ============================================

  const handleImport = useCallback(async () => {
    if (!preview) return;

    try {
      setPhase("importing");
      setMessage("데이터를 저장하는 중...");
      setProgress(70);

      const result = await executeImportAction(preview, {
        studentId,
        overwriteExisting: overwrite,
        manualMappings,
      });

      if (!result.success) {
        throw new Error(result.error ?? "저장 실패");
      }
      if (!result.data) {
        throw new Error("저장 결과가 없습니다.");
      }

      setPhase("complete");
      setProgress(100);

      const c = result.data.counts;
      const total = c.seteks + c.changche + c.haengteuk + c.readings + c.attendance + c.awards + c.volunteer;
      showToast(`생기부 ${total}건 저장 완료`, "success");

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["studentRecord"] });

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    }
  }, [preview, studentId, overwrite, manualMappings, showToast, queryClient, handleClose]);

  // ============================================
  // 수동 매핑 핸들러
  // ============================================

  const handleManualMapping = useCallback(
    (parsedName: string, subjectId: string) => {
      setManualMappings((prev) => {
        const next = prev.filter((m) => m.parsedName !== parsedName);
        next.push({ parsedName, subjectId });
        return next;
      });
    },
    [],
  );

  // ============================================
  // 렌더링
  // ============================================

  const isProcessing = phase === "extracting" || phase === "parsing" || phase === "importing";

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="생기부 가져오기"
      size="lg"
    >
      <DialogContent>
        {/* 에러 배너 */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 단계 1: 파일 선택 */}
        {(phase === "idle" || phase === "error") && !preview && (
          <FileDropzone
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onDrop={handleDrop}
            fileInputRef={fileInputRef}
          />
        )}

        {/* 프로그레스 바 */}
        {isProcessing && (
          <ProgressBar progress={progress} message={message} />
        )}

        {/* 단계 2: 미리보기 */}
        {phase === "previewing" && preview && (
          <PreviewPanel
            preview={preview}
            subjects={subjects}
            overwrite={overwrite}
            onOverwriteChange={setOverwrite}
            onManualMapping={handleManualMapping}
            manualMappings={manualMappings}
          />
        )}

        {/* 완료 메시지 */}
        {phase === "complete" && (
          <div className="py-8 text-center">
            <div className="mb-2 text-2xl">✓</div>
            <p className="text-sm text-[var(--text-secondary)]">저장이 완료되었습니다.</p>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        {/* 분석 시작 */}
        {(phase === "idle" || phase === "error") && !preview && (
          <>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!selectedFile}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              분석 시작
            </button>
          </>
        )}

        {/* 저장 확인 */}
        {phase === "previewing" && (
          <>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setPhase("idle");
              }}
              className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              다시 선택
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              저장
            </button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// ============================================
// 서브 컴포넌트: FileDropzone
// ============================================

function FileDropzone({
  selectedFile,
  onFileSelect,
  onDrop,
  fileInputRef,
}: {
  selectedFile: File | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const format = selectedFile ? detectFileFormat(selectedFile) : null;
  const formatLabel = format === "pdf" ? "PDF" : format === "html" ? "HTML" : format === "image" ? "이미지" : "";

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-primary-400 dark:border-gray-600 dark:hover:border-primary-500"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FILE_TYPES}
        onChange={onFileSelect}
        className="hidden"
      />

      {selectedFile ? (
        <>
          <div className="text-3xl">
            {format === "pdf" ? "📄" : format === "html" ? "🌐" : "🖼️"}
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {selectedFile.name}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {formatLabel} · {(selectedFile.size / 1024 / 1024).toFixed(1)}MB
          </p>
        </>
      ) : (
        <>
          <div className="text-3xl text-gray-400">📁</div>
          <p className="text-sm text-[var(--text-secondary)]">
            파일을 드래그하거나 클릭하여 선택
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            PDF, HTML, 이미지(PNG/JPG) 지원 · 최대 50MB
          </p>
        </>
      )}
    </div>
  );
}

// ============================================
// 서브 컴포넌트: ProgressBar
// ============================================

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  const isParsing = progress >= 50 && progress < 100;

  return (
    <div className="space-y-3 py-4">
      <p className="text-center text-sm text-[var(--text-secondary)]">{message}</p>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full bg-primary-500 transition-all duration-1000 ${isParsing ? "animate-pulse" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs text-[var(--text-tertiary)]">
        {isParsing ? `분석 중... ${progress}%` : `${progress}%`}
      </p>
    </div>
  );
}

// ============================================
// 서브 컴포넌트: PreviewPanel
// ============================================

function PreviewPanel({
  preview,
  subjects,
  overwrite,
  onOverwriteChange,
  onManualMapping,
  manualMappings,
}: {
  preview: ImportPreviewData;
  subjects: { id: string; name: string }[];
  overwrite: boolean;
  onOverwriteChange: (v: boolean) => void;
  onManualMapping: (parsedName: string, subjectId: string) => void;
  manualMappings: ManualSubjectMapping[];
}) {
  const { summary, subjectMatches } = preview;
  const unmatchedSubjects = subjectMatches.filter((m) => m.confidence === "unmatched");
  const manualMap = new Map(manualMappings.map((m) => [m.parsedName, m.subjectId]));

  return (
    <div className="space-y-4">
      {/* 학생 정보 */}
      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {preview.parsed.studentInfo.name} · {preview.parsed.studentInfo.schoolName}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          입학년도: {preview.parsed.studentInfo.schoolYear}
        </p>
      </div>

      {/* 건수 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryBadge label="세특" count={summary.setekCount} />
        <SummaryBadge label="창체" count={summary.changcheCount} />
        <SummaryBadge label="행특" count={summary.haengteukCount} />
        <SummaryBadge label="독서" count={summary.readingCount} />
        <SummaryBadge label="출결" count={summary.attendanceCount} />
        <SummaryBadge label="성적" count={summary.gradeCount} />
        <SummaryBadge label="수상" count={summary.awardCount} />
        <SummaryBadge label="봉사" count={summary.volunteerCount} />
        <SummaryBadge label="학반" count={summary.classInfoCount} />
      </div>

      {/* 미매칭 과목 수동 매핑 */}
      {unmatchedSubjects.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            ⚠ 미매칭 과목 {unmatchedSubjects.length}건
          </p>
          {unmatchedSubjects.map((match) => (
            <UnmatchedSubjectRow
              key={match.parsedName}
              match={match}
              subjects={subjects}
              selectedId={manualMap.get(match.parsedName) ?? ""}
              onSelect={(subjectId) => onManualMapping(match.parsedName, subjectId)}
            />
          ))}
        </div>
      )}

      {/* 덮어쓰기 옵션 */}
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => onOverwriteChange(e.target.checked)}
          className="rounded"
        />
        기존 데이터 덮어쓰기
      </label>

      {/* 성적 안내 */}
      {summary.gradeCount > 0 && (
        <p className="text-xs text-[var(--text-tertiary)]">
          ※ 성적 데이터({summary.gradeCount}건)가 교과학습발달상황에 자동 반영됩니다.
        </p>
      )}
    </div>
  );
}

function SummaryBadge({ label, count, warn }: { label: string; count: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 p-2 text-center dark:border-gray-700">
      <p className="text-lg font-semibold text-[var(--text-primary)]">{count}</p>
      <p className={`text-xs ${warn ? "text-amber-500" : "text-[var(--text-tertiary)]"}`}>
        {label}
        {warn && " (참고)"}
      </p>
    </div>
  );
}

function UnmatchedSubjectRow({
  match,
  subjects,
  selectedId,
  onSelect,
}: {
  match: SubjectMatch;
  subjects: { id: string; name: string }[];
  selectedId: string;
  onSelect: (subjectId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 dark:bg-amber-950/20">
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
        &ldquo;{match.parsedName}&rdquo;
      </span>
      <span className="text-xs text-[var(--text-tertiary)]">→</span>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-40 rounded border border-gray-300 px-2 py-1 text-sm text-[var(--text-primary)] dark:border-gray-600 dark:bg-gray-800"
      >
        <option value="">과목 선택</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
