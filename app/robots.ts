import type { MetadataRoute } from "next";
import {
  SITE_URL,
  CRAWLER_DISALLOW_PATHS,
  CRAWLER_ALLOW_PATHS,
} from "@/lib/constants/routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: [...CRAWLER_DISALLOW_PATHS],
        allow: [...CRAWLER_ALLOW_PATHS],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
