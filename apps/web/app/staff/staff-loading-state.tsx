import type { ReactNode } from "react";
import "./staff-work.css";

/**
 * Shared, screen-reader-visible feedback while staff data loads.
 * Text remains visible; the spinner is decorative and respects reduced motion.
 */
export function StaffLoadingState({ label, className = "" }: {
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-panel staff-loading-state ${className}`.trim()}
      role="status" aria-live="polite" aria-busy="true">
      <span aria-hidden="true" className="staff-loading-spinner" />
      <span>{label}</span>
    </div>
  );
}
