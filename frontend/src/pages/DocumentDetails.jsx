import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api, { formatApiError, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/StatusBadge";
import { Download, Copy, ArrowLeft, Link2, CheckCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function DocumentDetails() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      setDoc(data);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line

  // fetch PDF via authenticated request and create blob url for preview
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let urlToRevoke = null;
    const fetchPdf = async () => {
      try {
        const kind = doc.status === "signed" && doc.signed_file ? "signed" : "original";
        const res = await api.get(`/documents/${doc.id}/file`, {
          params: { kind },
          responseType: "blob",
        });
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(res.data);
        urlToRevoke = blobUrl;
        setPdfBlobUrl(blobUrl);
      } catch (e) {
        // ignore preview failures, still show metadata
      }
    };
    fetchPdf();
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [doc?.id, doc?.status, doc?.signed_file]); // eslint-disable-line

  const createRequest = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post(`/documents/${id}/signature-requests`, {
        signer_name: signerName,
        signer_email: signerEmail,
      });
      setSignerName("");
      setSignerEmail("");
      toast.success("Signature request created");
      await load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const downloadFile = async (kind) => {
    try {
      const res = await api.get(`/documents/${id}/file`, {
        params: { kind },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.title}${kind === "signed" ? "-signed" : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const copyLink = async (token) => {
    const link = `${window.location.origin}/sign/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedToken(null), 1500);
    } catch (_) {
      toast.error("Could not copy link");
    }
  };

  if (error) return <div className="text-sm text-red-600" data-testid="details-error">{error}</div>;
  if (!doc) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="document-details-page">
      <div>
        <Link to="/app/documents" className="text-sm text-zinc-500 hover:text-zinc-950 inline-flex items-center gap-1" data-testid="back-to-documents">
          <ArrowLeft className="h-3.5 w-3.5" />
          All Documents
        </Link>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} data-testid="document-title">
            {doc.title}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={doc.status} />
            <Button
              variant="outline"
              className="shadow-none h-9"
              onClick={() => downloadFile(doc.status === "signed" ? "signed" : "original")}
              data-testid="download-button"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="bg-[#F7F7F8] border border-zinc-200 rounded-md overflow-hidden h-[640px]" data-testid="pdf-preview">
            {pdfBlobUrl ? (
              <iframe title="PDF Preview" src={pdfBlobUrl} className="w-full h-full" />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-zinc-500">Loading preview…</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Details</h2>
            <div className="space-y-2 text-sm">
              <Row label="Status" value={<StatusBadge status={doc.status} />} />
              <Row label="Uploaded" value={new Date(doc.created_at).toLocaleString()} />
              <Row label="Original" value={doc.original_filename} />
            </div>
          </section>

          {doc.status !== "signed" && (
            <section className="space-y-3 pt-4 border-t border-zinc-200">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Request Signature</h2>
              <form onSubmit={createRequest} className="space-y-3" data-testid="request-form">
                <div className="space-y-1.5">
                  <Label htmlFor="signer-name" className="text-xs">Signer Name</Label>
                  <Input
                    id="signer-name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    required
                    className="h-10"
                    data-testid="signer-name-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signer-email" className="text-xs">Signer Email</Label>
                  <Input
                    id="signer-email"
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    required
                    className="h-10"
                    data-testid="signer-email-input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-zinc-950 hover:bg-zinc-800 text-white shadow-none h-10"
                  data-testid="create-request-button"
                >
                  {creating ? "Creating…" : "Generate Signing Link"}
                </Button>
              </form>
            </section>
          )}

          <section className="space-y-3 pt-4 border-t border-zinc-200">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Signature Requests</h2>
            <div className="space-y-3" data-testid="requests-list">
              {(!doc.signature_requests || doc.signature_requests.length === 0) && (
                <div className="text-sm text-zinc-500" data-testid="requests-empty">No requests yet.</div>
              )}
              {doc.signature_requests?.map((r) => (
                <div key={r.id} className="rounded-md border border-zinc-200 p-3 space-y-2" data-testid={`request-${r.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.signer_name}</div>
                      <div className="text-xs text-zinc-500 truncate">{r.signer_email}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.status !== "signed" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(r.token)}
                      className="w-full shadow-none h-8 text-xs justify-start"
                      data-testid={`copy-link-${r.id}`}
                    >
                      {copiedToken === r.token ? (
                        <>
                          <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                          Link copied
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                          Copy signing link
                        </>
                      )}
                    </Button>
                  )}
                  {r.signed_at && (
                    <div className="text-xs text-zinc-500">Signed on {new Date(r.signed_at).toLocaleString()}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-950 text-right truncate">{value}</span>
    </div>
  );
}
