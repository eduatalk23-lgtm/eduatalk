import { memo, useRef, useEffect } from "react";

// Row Size Measurer
export function MeasureRow({
  index,
  setSize,
  children,
  expandedKey
}: {
  index: number;
  setSize: (index: number, size: number) => void;
  children: React.ReactNode;
  expandedKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      setSize(index, ref.current.getBoundingClientRect().height);
    }
  }, [setSize, index, expandedKey, children]);

  return <div ref={ref}>{children}</div>;
}
