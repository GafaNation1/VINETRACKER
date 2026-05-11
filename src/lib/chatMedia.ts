import { supabase } from "@/integrations/supabase/client";

export type ChatMessageType = "text" | "image" | "video" | "audio" | "file";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function detectType(file: File): ChatMessageType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

/** Compress an image client-side before upload. Returns a Blob (jpeg). */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
  });
}

export interface UploadResult {
  path: string;
  type: ChatMessageType;
  meta: { name: string; size: number; mime: string; width?: number; height?: number };
}

/** Upload a chat attachment to chat-media bucket and return the storage path. */
export async function uploadChatMedia(file: File, userId: string): Promise<UploadResult> {
  const type = detectType(file);
  let blob: Blob = file;
  let mime = file.type || "application/octet-stream";
  let ext = file.name.split(".").pop() || "bin";

  if (type === "video" && file.size > MAX_VIDEO_BYTES) {
    throw new Error("Videos must be 50 MB or less");
  }
  if (type === "image" && file.size > MAX_IMAGE_BYTES) {
    // Compress aggressively if oversized
  }
  if (type === "file" && file.size > MAX_FILE_BYTES) {
    throw new Error("Files must be 25 MB or less");
  }

  if (type === "image") {
    try {
      blob = await compressImage(file);
      mime = "image/jpeg";
      ext = "jpg";
    } catch {
      // fall back to original
    }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, blob, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error;

  return {
    path,
    type,
    meta: { name: file.name, size: blob.size, mime },
  };
}

/** Get a signed URL for a stored chat-media path (1 hour). */
export async function getChatMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, 60 * 60);
  if (error || !data) return "";
  return data.signedUrl;
}
