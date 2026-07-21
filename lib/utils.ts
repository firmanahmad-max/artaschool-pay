import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format nominal ke Rupiah penuh tanpa desimal (uang selalu integer, lihat CONTEXT.md). */
export function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format tanggal Indonesia, mis. "18 Juli 2026". */
export function formatTanggal(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}
