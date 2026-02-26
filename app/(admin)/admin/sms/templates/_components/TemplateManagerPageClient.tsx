"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { TemplateManager } from "@/app/(admin)/admin/students/_components/sms/TemplateManager";
import { listCustomTemplates } from "@/lib/domains/sms/actions/customTemplates";
import type { SMSCustomTemplate } from "@/lib/domains/sms/types";
import { Loader2 } from "lucide-react";

export function TemplateManagerPageClient() {
  const [templates, setTemplates] = useState<SMSCustomTemplate[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  const loadTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await listCustomTemplates({ activeOnly: false });
      setTemplates(result.success ? result.data ?? [] : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <TemplateManager
      templates={templates}
      onRefresh={loadTemplates}
      mode="page"
    />
  );
}
