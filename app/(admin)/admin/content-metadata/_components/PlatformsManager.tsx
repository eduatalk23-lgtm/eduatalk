"use client";

import {
  getPlatformsAction,
  createPlatformAction,
  updatePlatformAction,
  deletePlatformAction,
} from "@/app/(admin)/actions/contentMetadataActions";
import type { Platform } from "@/lib/data/contentMetadata";
import { BaseMetadataManager } from "./BaseMetadataManager";

export function PlatformsManager() {
  return (
    <BaseMetadataManager<Platform>
      title="플랫폼 관리"
      fetchAction={getPlatformsAction}
      createAction={createPlatformAction}
      updateAction={updatePlatformAction}
      deleteAction={deletePlatformAction}
      namePlaceholder="예: 메가스터디"
    />
  );
}

