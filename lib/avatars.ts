// Profile pictures: public URLs and in-browser resizing before upload.
import { SUPABASE_URL } from "@/lib/supabase/env";

export const AVATAR_BUCKET = "avatars";
/** Largest picture a player can pick. The bucket enforces the same limit. */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
/** Stored avatars are square images this many pixels wide. */
export const AVATAR_SIZE = 256;

export function avatarUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/**
 * Centre-crops an image to a square and shrinks it to AVATAR_SIZE. Re-encoding
 * through a canvas also drops photo metadata such as GPS location.
 */
export async function resizeForAvatar(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That picture is over 5 MB. Please pick a smaller one.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file isn't an image we can read. Try a PNG, JPEG or WebP.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't resize images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  // Safari can't encode WebP.
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("Couldn't process that picture.");
  return { blob: jpeg, ext: "jpg" };
}
