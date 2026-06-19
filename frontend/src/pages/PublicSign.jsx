import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { FileSignature, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatApiError, API } from "@/lib/api";

export default function PublicSign() {
  const { token } = useParams();
  const sigRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/public/sign/${token}`);
        if (cancelled) return;
        setInfo(data);
        if (data.request.status === "signed") setDone(true);
      } catch (e) {
        setError(formatApiError(e));
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!info) return;
    let urlToRevoke = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/public/sign/${token}/file`, { responseType: "blob" });
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        urlToRevoke = url;
        setPdfBlobUrl(url);
      } catch (_) {
        // ignore preview load errors
      }
    })();
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [info, token]);

  const clearSig = () => {
    sigRef.current?.clear();
  };

  const submit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please draw your signature first.");
      return;
    }
    setSubmitting(true);
    try {
      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      await axios.post(`${API}/public/sign/${token}`, { signature_data_url: dataUrl });
      setDone(true);
      toast.success("Document signed successfully");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="max-w-md text-center space-y-3" data-testid="sign-error">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Link unavailable</h1>
          <p className="text-zinc-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-zinc-500" data-testid="sign-loading">
        Loading document…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }} data-testid="public-sign-page">
      <header className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-zinc-950 flex items-center justify-center">
            <FileSignature className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Inksign</span>
        </div>
        <div className="text-xs text-zinc-500 hidden sm:block">Secure signing</div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} data-testid="sign-document-title">
            {info.document.title}
          </h1>
          <p className="text-zinc-500 text-sm">
            Hi <span className="text-zinc-950 font-medium">{info.request.signer_name}</span>, please review the document and add your signature below.
          </p>
        </div>

        <div className="bg-[#F7F7F8] border border-zinc-200 rounded-md overflow-hidden h-[560px]" data-testid="sign-pdf-preview">
          {pdfBlobUrl ? (
            <iframe title="Document" src={pdfBlobUrl} className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">Loading document…</div>
          )}
        </div>

        {done ? (
          <div className="border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-md p-6 flex items-start gap-3" data-testid="sign-done">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">Document signed</div>
              <div className="text-sm">Thank you. Your signature has been recorded and the document is now finalized.</div>
            </div>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Draw your signature</h2>
              <button
                type="button"
                onClick={clearSig}
                className="text-xs text-zinc-600 hover:text-zinc-950 inline-flex items-center gap-1"
                data-testid="clear-signature-button"
              >
                <RefreshCw className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="border border-zinc-300 rounded-md bg-white" data-testid="signature-pad-container">
              <SignatureCanvas
                ref={sigRef}
                penColor="#09090b"
                canvasProps={{
                  className: "w-full h-48 rounded-md",
                  "data-testid": "signature-pad",
                }}
              />
            </div>
            <Button
              onClick={submit}
              disabled={submitting}
              className="bg-zinc-950 hover:bg-zinc-800 text-white shadow-none h-11 px-6"
              data-testid="submit-signature-button"
            >
              {submitting ? "Submitting…" : "Submit Signature"}
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
