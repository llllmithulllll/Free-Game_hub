import { auth } from "@/lib/firebase";

const AVATAR_API_URL = process.env.EXPO_PUBLIC_AVATAR_API_URL?.replace(/\/$/, "");
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type PickedAvatarFile = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  file?: Blob | null;
};

export type UploadedAvatar = { key: string; url: string };

async function authHeaders(contentType?: string) {
  if (!AVATAR_API_URL) throw new Error("Avatar upload service URL is not configured.");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to upload a profile picture.");
  const token = await user.getIdToken();
  return {
    url: AVATAR_API_URL,
    headers: {
      authorization: `Bearer ${token}`,
      ...(contentType ? { "content-type": contentType } : {}),
    },
  };
}

function inferImageMime(file: PickedAvatarFile, blob: Blob) {
  const provided = file.mimeType || blob.type;
  if (provided && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(provided.toLowerCase())) return provided.toLowerCase();
  const extension = `${file.fileName || file.uri}`.toLowerCase().split("?")[0].split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  throw new Error("Choose a JPEG, PNG, WebP, or GIF file.");
}

export async function uploadProfileAvatar(file: PickedAvatarFile): Promise<UploadedAvatar> {
  const blob = file.file || await fetch(file.uri).then((result) => {
    if (!result.ok) throw new Error("Could not read the selected file.");
    return result.blob();
  });
  if (!blob.size || blob.size > MAX_AVATAR_BYTES) throw new Error("Choose an image or GIF smaller than 5 MB.");
  const mimeType = inferImageMime(file, blob);
  const { url, headers } = await authHeaders(mimeType);
  const result = await fetch(`${url}/upload`, { method: "POST", headers, body: blob });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error || `Upload failed (${result.status}).`);
  return payload as UploadedAvatar;
}

export async function deleteProfileAvatar(key: string): Promise<void> {
  if (!key) return;
  const { url, headers } = await authHeaders("application/json");
  const result = await fetch(`${url}/delete`, { method: "POST", headers, body: JSON.stringify({ key }) });
  if (!result.ok) throw new Error(`Could not delete avatar (${result.status}).`);
}
