import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText } from "lucide-react";
import { toast } from "sonner";

export default function UploadDocument() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setError("");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", title || file.name);
      fd.append("file", file);
      const { data } = await api.post("/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded");
      navigate(`/app/documents/${data.id}`);
    } catch (err) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl" data-testid="upload-page">
      <div>
        <h1 className="text-4xl sm:text-5xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Upload Document
        </h1>
        <p className="text-zinc-500 mt-2">Upload a PDF to start a signature workflow.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Service Agreement 2026"
            className="h-11"
            data-testid="upload-title-input"
          />
        </div>

        <div className="space-y-2">
          <Label>PDF File</Label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            data-testid="upload-dropzone"
            className={`w-full border border-dashed rounded-md py-12 px-6 flex flex-col items-center justify-center text-center transition-colors ${
              dragOver ? "border-zinc-950 bg-[#F7F7F8]" : "border-zinc-300 hover:bg-[#F7F7F8]"
            }`}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-zinc-950 mb-3" />
                <div className="text-sm font-medium" data-testid="upload-selected-file">{file.name}</div>
                <div className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</div>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-zinc-500 mb-3" />
                <div className="text-sm font-medium text-zinc-950">Drop a PDF or click to browse</div>
                <div className="text-xs text-zinc-500 mt-1">Up to 20 MB</div>
              </>
            )}
          </button>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => handleFile(e.target.files?.[0])}
            data-testid="upload-file-input"
          />
        </div>

        {error && <div className="text-sm text-red-600" data-testid="upload-error">{error}</div>}

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={loading || !file}
            className="bg-zinc-950 hover:bg-zinc-800 text-white shadow-none h-11"
            data-testid="upload-submit-button"
          >
            {loading ? "Uploading…" : "Upload Document"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 shadow-none"
            onClick={() => navigate("/app/documents")}
            data-testid="upload-cancel-button"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
