import { useState, useCallback } from "react";
import { requestUploadUrl } from "@workspace/api-client-react";

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

interface UseFileUploadOptions {
  onSuccess?: (objectPath: string) => void;
  onError?: (error: Error) => void;
  accept?: string[];
  maxSizeMB?: number;
}

const imageExtensions = /\.(avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp)$/i;

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      const maxBytes = (options.maxSizeMB ?? 10) * 1024 * 1024;
      if (file.size > maxBytes) {
        const msg = `File too large. Max size is ${options.maxSizeMB ?? 10}MB.`;
        setError(msg);
        options.onError?.(new Error(msg));
        return null;
      }

      if (
        options.accept &&
        !options.accept.some(
          (t) => file.type.startsWith(t) || (t === "image/" && imageExtensions.test(file.name)),
        )
      ) {
        const msg = "File type not allowed.";
        setError(msg);
        options.onError?.(new Error(msg));
        return null;
      }

      setIsUploading(true);
      setError(null);
      setProgress(10);

      try {
        const { uploadURL, objectPath } = await requestUploadUrl({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        });
        setProgress(40);

        const putRes = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        if (!putRes.ok) throw new Error("Failed to upload file");
        setProgress(100);
        options.onSuccess?.(objectPath);
        return objectPath;
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Upload failed");
        setError(e.message);
        options.onError?.(e);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options],
  );

  return { uploadFile, isUploading, progress, error };
}
