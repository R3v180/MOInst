"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, Upload, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface UploadedFile {
  id: string;
  fileName: string;
  filePath: string;
  fileType: "PHOTO" | "PDF" | "EXCEL" | "OTHER";
  mimeType: string;
  url: string;
}

interface AttachmentUploaderProps {
  entityType: string;
  entityId: string;
  onUploaded?: (f: UploadedFile) => void;
  accept?: string;
  className?: string;
  label?: string;
  variant?: "default" | "compact";
}

function detectFileType(file: File): "PHOTO" | "PDF" | "EXCEL" | "OTHER" {
  if (file.type.startsWith("image/")) return "PHOTO";
  if (file.type === "application/pdf") return "PDF";
  if (
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.name.match(/\.(xlsx?|csv)$/i)
  )
    return "EXCEL";
  return "OTHER";
}

export function AttachmentUploader({
  entityType,
  entityId,
  onUploaded,
  accept = "image/*,application/pdf",
  className,
  label = "Adjuntar",
  variant = "default",
}: AttachmentUploaderProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("entityType", entityType);
        fd.append("entityId", entityId);
        const r = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error ?? "Error al subir archivo");
        }
        const data = (await r.json()) as UploadedFile;
        onUploaded?.(data);
        toast({ title: "Archivo subido", description: data.fileName });
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, onUploaded]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      Array.from(files).forEach(upload);
    },
    [upload]
  );

  if (variant === "compact") {
    return (
      <>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          title="Hacer foto"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          title="Subir archivo"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => cameraRef.current?.click()}
      >
        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
        Cámara
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        {label}
      </Button>
    </div>
  );
}

export function AttachmentThumb({
  file,
  onDelete,
}: {
  file: { id: string; fileName: string; filePath: string; fileType: string; mimeType: string };
  onDelete?: () => void;
}) {
  const isPhoto = file.fileType === "PHOTO";
  const isPdf = file.fileType === "PDF";
  return (
    <div className="group relative aspect-square rounded-md border border-border overflow-hidden bg-muted">
      {isPhoto ? (
        <img src={file.filePath} alt={file.fileName} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center">
          {isPdf ? <FileText className="w-8 h-8 text-destructive" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
          <span className="text-[10px] truncate w-full text-muted-foreground">{file.fileName}</span>
        </div>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
