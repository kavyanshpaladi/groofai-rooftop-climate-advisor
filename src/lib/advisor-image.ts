import type { AdvisorRequest } from "./advisor";

export type AdvisorPhoto = { url: string; mimeType: AdvisorRequest["image"]["mimeType"]; data: string };

export async function compressImage(file: File): Promise<AdvisorPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    return { url, mimeType: "image/jpeg", data: url.split(",")[1] ?? "" };
  } finally {
    bitmap.close();
  }
}