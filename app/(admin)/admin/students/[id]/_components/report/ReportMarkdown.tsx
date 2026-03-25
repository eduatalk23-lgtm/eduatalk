import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReportMarkdownProps {
  children: string;
  className?: string;
}

/**
 * 리포트 전용 마크다운 렌더러.
 * AI 생성 텍스트의 ###, **, - 등을 올바르게 렌더링하되
 * report-typography 스타일과 일관되게 표시한다.
 */
export function ReportMarkdown({ children, className }: ReportMarkdownProps) {
  return (
    <div className={`report-markdown ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
