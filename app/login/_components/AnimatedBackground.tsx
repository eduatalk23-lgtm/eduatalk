"use client";

import { useEffect, useState } from "react";

export function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 -z-10 bg-neutral-50" />;
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-neutral-50">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div
        className="absolute top-0 -left-4 h-72 w-72 rounded-full bg-purple-300 opacity-30 mix-blend-multiply blur-3xl filter animate-blob-1"
      />
      <div
        className="absolute top-0 -right-4 h-72 w-72 rounded-full bg-blue-300 opacity-30 mix-blend-multiply blur-3xl filter animate-blob-2"
      />
      <div
        className="absolute -bottom-8 left-20 h-72 w-72 rounded-full bg-pink-300 opacity-30 mix-blend-multiply blur-3xl filter animate-blob-3"
      />
    </div>
  );
}
