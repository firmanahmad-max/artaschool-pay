/**
 * Kompresi gambar sisi-klien sebelum upload (hemat kuota orang tua — PRD §7.1).
 * PDF & tipe non-gambar dikembalikan apa adanya. Gambar diperkecil ke sisi
 * terpanjang <= maxDim dan diekspor JPEG kualitas 0.8.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.8,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // Latar putih agar PNG transparan tidak jadi hitam saat ke JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob || blob.size >= file.size) return file; // jangan perbesar

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
