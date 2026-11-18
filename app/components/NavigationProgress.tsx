import { TRProgress } from "@tinyrack/ui/components/progress";
import { useEffect, useState } from "react";
import { useNavigation } from "react-router";
import { useT } from "~/lib/i18n";

/**
 * True once `on` has stayed true for `delay` ms; false again as soon as it turns false. Loading UI
 * waits like this so navigations that finish at once don't flash it.
 */
export function useDelayed(on: boolean, delay: number) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) return setShown(false);
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [on, delay]);
  return on && shown;
}

/**
 * A thin indeterminate bar along the top of the window while the next page loads (e.g. a word page
 * fetching its data chunks), so a click never looks ignored.
 */
export function NavigationProgress() {
  const t = useT();
  const shown = useDelayed(useNavigation().state !== "idle", 100);
  if (!shown) return null;
  return (
    <TRProgress.Root value={null} aria-label={t.loading} className="nav-progress fixed inset-x-0 top-0 z-tinyrack-toast">
      <TRProgress.Track>
        <TRProgress.Indicator />
      </TRProgress.Track>
    </TRProgress.Root>
  );
}
