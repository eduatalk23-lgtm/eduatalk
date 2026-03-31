import { cn } from "@/lib/cn";
import { CARD, TYPO, SPACING } from "@/lib/design-tokens/report";

interface SectionActionSummaryProps {
  actions: string[];
}

export function SectionActionSummary({ actions }: SectionActionSummaryProps) {
  if (actions.length === 0) return null;
  return (
    <div className={cn(CARD.amber, "mt-4")}>
      <p className={cn(TYPO.subsectionTitle, "mb-1")}>다음 단계</p>
      <ul className={cn(SPACING.itemGap, "list-inside list-disc")}>
        {actions.map((a, i) => (
          <li key={i} className={TYPO.body}>
            {a}
          </li>
        ))}
      </ul>
    </div>
  );
}
