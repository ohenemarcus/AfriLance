import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { FileText } from "lucide-react";

type DisputeEvidenceFileProps = {
  objectPath: string;
  fileName: string;
  contentType?: string | null;
};

function getEvidenceUrl(objectPath: string): string {
  const apiPath = objectPath.startsWith("/api/storage/")
    ? objectPath
    : objectPath.startsWith("/objects/")
      ? `/api/storage${objectPath}`
      : "";
  if (!apiPath) throw new Error("Unsupported evidence file path");

  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  return new URL(apiPath, apiBase).toString();
}

export function DisputeEvidenceFile({
  objectPath,
  fileName,
  contentType,
}: DisputeEvidenceFileProps) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";

    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch(getEvidenceUrl(objectPath), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Could not load evidence (${response.status})`);
        }
        objectUrl = URL.createObjectURL(await response.blob());
        setUrl(objectUrl);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load evidence");
        }
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getToken, objectPath]);

  if (error) {
    return <p role="alert" className="text-xs text-destructive">{fileName}: {error}</p>;
  }
  if (!url) {
    return <p className="text-xs text-muted-foreground">Loading evidence: {fileName}…</p>;
  }

  const isImage = (contentType ?? "").startsWith("image/");
  return isImage ? (
    <a href={url} target="_blank" rel="noreferrer" className="block max-w-xs">
      <img
        src={url}
        alt={fileName}
        className="max-h-56 max-w-full rounded-md border border-border object-contain"
      />
      <span className="mt-1 block break-all text-xs text-primary hover:underline">{fileName}</span>
    </a>
  ) : (
    <a
      href={url}
      download={fileName}
      className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="break-all">{fileName}</span>
    </a>
  );
}
