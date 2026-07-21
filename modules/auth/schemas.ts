import { z } from "zod";

/** Normalisasi nomor HP Indonesia ke format +62… */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-.]/g, "");
  if (digits.startsWith("+62")) return digits;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  return digits;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .regex(/^\+628\d{7,12}$/, "Nomor HP tidak valid (contoh: 0812xxxxxxx)"),
  );

export const otpSchema = z.object({
  phone: phoneSchema,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode OTP terdiri dari 6 angka"),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});
