"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Mirrors in-page admin tabs in the URL without changing their API or data
 * isolation. Deep links and browser Back/Forward remain consistent.
 */
export function useAdminSectionRoute<T extends string>(
  basePath: string,
  allowed: readonly T[],
  fallback: T
): { routedTab: T; navigateTab: (tab: T) => void } {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("tab")?.toLowerCase();
  const routedTab = allowed.find((value) => value.toLowerCase() === query) ?? fallback;

  function navigateTab(tab: T) {
    if (!allowed.includes(tab)) return;
    router.push(tab === fallback ? basePath : basePath + "?tab=" + encodeURIComponent(tab.toLowerCase()), {
      scroll: false
    });
  }

  return { routedTab, navigateTab };
}
