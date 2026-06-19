import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Plus, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsList() {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/documents");
        setDocs(data);
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
  }, []);

  return (
    <div className="space-y-8" data-testid="documents-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Documents
          </h1>
          <p className="text-zinc-500 mt-2">All your uploaded PDFs and their status.</p>
        </div>
        <Link to="/app/upload">
          <Button className="bg-zinc-950 hover:bg-zinc-800 text-white shadow-none h-10" data-testid="upload-document-button">
            <Plus className="h-4 w-4 mr-1.5" />
            Upload Document
          </Button>
        </Link>
      </div>

      {error && <div className="text-sm text-red-600" data-testid="documents-error">{error}</div>}

      <div className="border-t border-zinc-200" data-testid="documents-list">
        {!docs && (
          <div className="py-6 space-y-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {docs && docs.length === 0 && (
          <div className="py-16 text-center text-zinc-500 text-sm" data-testid="documents-empty">
            No documents yet.{" "}
            <Link to="/app/upload" className="text-zinc-950 underline underline-offset-4">
              Upload your first one
            </Link>
            .
          </div>
        )}
        {docs?.map((d) => (
          <Link
            key={d.id}
            to={`/app/documents/${d.id}`}
            data-testid={`document-row-${d.id}`}
            className="flex items-center justify-between py-5 border-b border-zinc-200 group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-10 w-10 rounded-md bg-[#F7F7F8] border border-zinc-200 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-950 truncate group-hover:underline underline-offset-4">
                  {d.title}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Uploaded {new Date(d.created_at).toLocaleDateString()} · {formatBytes(d.size_bytes)}
                </div>
              </div>
            </div>
            <StatusBadge status={d.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatBytes(b) {
  if (!b) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
