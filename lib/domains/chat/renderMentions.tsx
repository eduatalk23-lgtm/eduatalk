import type { ReactNode } from "react";
import type { MentionInfo } from "./types";

/**
 * 메시지 텍스트에서 @멘션을 파싱하여 하이라이트된 React 노드를 반환합니다.
 *
 * metadata.mentions에 포함된 이름만 멘션으로 인식합니다.
 */
export function renderContentWithMentions(
  content: string,
  mentions: MentionInfo[] | undefined
): ReactNode {
  if (!mentions || mentions.length === 0) {
    return content;
  }

  // @이름 패턴 매칭 (mentions에 있는 이름만)
  // 이름에 정규식 특수문자가 포함될 수 있으므로 이스케이프
  const escapedNames = mentions.map((m) =>
    m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`@(${escapedNames.join("|")})`, "g");

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    // 매치 전 텍스트
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // 멘션 하이라이트
    const mentionName = match[1];
    parts.push(
      <span
        key={match.index}
        className="text-primary font-medium"
        data-mention={mentionName}
      >
        @{mentionName}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
