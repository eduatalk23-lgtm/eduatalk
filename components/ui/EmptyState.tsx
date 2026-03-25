interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{description}</p>
      )}
    </div>
  );
}
