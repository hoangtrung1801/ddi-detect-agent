/** Extensions the photo picker offers. HEIC/HEIF are what iPhones produce by default. */
export const PHOTO_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg", ".jfif"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/bmp": [".bmp"],
  "image/avif": [".avif"],
  "image/heic": [".heic"],
  "image/heif": [".heif", ".hif"],
};

/** Upper bound for a picked file, before it is converted and shrunk. */
export const MAX_PICK_BYTES = 40 * 1024 * 1024;

const MAX_EDGE = 1600;
const SERVER_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const SERVER_LIMIT = 7 * 1024 * 1024;

const isHeic = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.(heic|heif|hif)$/i.test(f.name);

const withExt = (name: string, ext: string) => name.replace(/\.[^.]+$/, "") + ext;

/**
 * Turns whatever the user picked into something the server accepts: HEIC/HEIF become PNG, AVIF/BMP become JPEG,
 * and oversized photos are scaled down. Server-supported files that are already small pass through untouched.
 */
export async function prepareImage(file: File): Promise<File> {
  if (SERVER_TYPES.includes(file.type) && file.size <= SERVER_LIMIT) return file;

  let blob: Blob = file;
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/png" });
    blob = Array.isArray(out) ? out[0]! : out;
  }

  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // HEIC becomes PNG; other unsupported or oversized files become JPEG to stay small.
  const [type, ext] = isHeic(file) ? ["image/png", ".png"] : ["image/jpeg", ".jpg"];
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.88));
  if (!out) throw new Error("Could not convert image");
  return new File([out], withExt(file.name, ext), { type });
}

/** Turns a failure while preparing or uploading a photo into a short Vietnamese message. */
export function photoErrorMessage(e: unknown, stage: "convert" | "upload"): string {
  if (stage === "convert") return "Không xử lý được ảnh này (có thể ảnh bị hỏng hoặc định dạng không đọc được). Hãy thử chụp lại hoặc chọn ảnh khác.";
  const err = e as { response?: { status?: number; data?: { detail?: string } }; code?: string };
  const status = err.response?.status;
  const detail = err.response?.data?.detail;
  if (!err.response) return "Không kết nối được máy chủ. Kiểm tra mạng rồi bấm thử lại.";
  if (status === 413) return "Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn.";
  if (status === 400 || status === 415) return detail ? `Ảnh không hợp lệ: ${detail}` : "Ảnh không hợp lệ.";
  return "Máy chủ không đọc được ảnh lúc này. Bấm thử lại sau ít phút.";
}
