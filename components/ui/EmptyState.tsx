interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[rgb(var(--color-secondary-300))] p-6 text-center">
      <p className="text-sm text-[var(--text-tertiary)]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{description}</p>
      )}
    </div>
  );
}
