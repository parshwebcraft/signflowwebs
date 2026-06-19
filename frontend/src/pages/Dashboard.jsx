import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Link } from "react-router-dom";
import { FileText, Clock, CheckCircle2, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/StatusBadge";

function Kpi({ label, value, icon: Icon, testid }) {
  return (
    <div className="py-6 px-1" data-testid={testid}>
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="mt-3 text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/dashboard/stats");
        setStats(data);
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
  }, []);

  return (
    <div className="space-y-10" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl sm:text-5xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Dashboard
        </h1>
        <p className="text-zinc-500 mt-2">Overview of your documents and signature requests.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-12 border-y border-zinc-200">
        {!stats && !error && (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        )}
        {stats && (
          <>
            <Kpi label="Total Documents" value={stats.totals.total} icon={FileText} testid="kpi-total" />
            <Kpi label="Pending Signatures" value={stats.totals.pending} icon={Clock} testid="kpi-pending" />
            <Kpi label="Signed Documents" value={stats.totals.signed} icon={CheckCircle2} testid="kpi-signed" />
          </>
        )}
      </div>

      {error && <div className="text-sm text-red-600" data-testid="dashboard-error">{error}</div>}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Recent Activity
          </h2>
          <Link to="/app/documents" className="text-sm text-zinc-600 hover:text-zinc-950 inline-flex items-center gap-1" data-testid="view-all-link">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-200 border-t border-zinc-200" data-testid="activity-list">
          {stats?.activity?.length === 0 && (
            <div className="py-10 text-center text-zinc-500 text-sm" data-testid="activity-empty">
              No activity yet. Upload your first document to get started.
            </div>
          )}
          {stats?.activity?.map((a, i) => (
            <Link
              key={i}
              to={`/app/documents/${a.doc_id}`}
              data-testid={`activity-item-${i}`}
              className="flex items-center justify-between py-4 group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-950 truncate group-hover:underline underline-offset-4">
                  {a.title}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {a.type === "signature_request" ? "Signature request" : "Document"} · {new Date(a.at).toLocaleString()}
                </div>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
