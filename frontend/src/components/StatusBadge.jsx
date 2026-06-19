import React from "react";

const STYLES = {
  draft: "bg-zinc-100 text-zinc-600",
  pending: "bg-amber-100 text-amber-700",
  signed: "bg-emerald-100 text-emerald-700",
};

const LABELS = {
  draft: "Draft",
  pending: "Pending",
  signed: "Signed",
};

export default function StatusBadge({ status }) {
  const key = (status || "draft").toLowerCase();
  const cls = STYLES[key] || STYLES.draft;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}
      data-testid={`status-badge-${key}`}
    >
      {LABELS[key] || status}
    </span>
  );
}
