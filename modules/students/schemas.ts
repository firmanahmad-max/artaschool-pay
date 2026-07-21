import { z } from "zod";
import { phoneSchema } from "@/modules/auth/schemas";

export const academicYearSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, 'Format nama: "2026/2027"'),
  starts_on: z.string().date().optional().or(z.literal("").transform(() => undefined)),
  ends_on: z.string().date().optional().or(z.literal("").transform(() => undefined)),
});

export const classSchema = z.object({
  grade: z.coerce.number().int().min(1, "Tingkat 1–6").max(6, "Tingkat 1–6"),
  label: z.string().trim().min(1, "Label kelas wajib diisi").max(10),
});

export const guardianInputSchema = z.object({
  guardian_name: z.string().trim().min(1, "Nama wali wajib diisi"),
  guardian_phone: phoneSchema,
  relation: z.enum(["ayah", "ibu", "wali"]).default("wali"),
});

export const studentSchema = z.object({
  nis: z.string().trim().min(1, "NIS wajib diisi").max(30),
  full_name: z.string().trim().min(1, "Nama wajib diisi").max(120),
  class_id: z.string().uuid("Pilih kelas"),
});

/** Baris template import Excel: NIS | Nama Lengkap | Kelas | Nama Wali | No HP Wali | Relasi */
export const importRowSchema = z.object({
  nis: z.coerce.string().trim().min(1, "NIS kosong"),
  full_name: z.string().trim().min(1, "Nama kosong"),
  class_label: z.string().trim().min(1, "Kelas kosong"),
  guardian_name: z.string().trim().optional(),
  guardian_phone: z
    .union([phoneSchema, z.literal(""), z.undefined()])
    .transform((v) => (v ? v : undefined)),
  relation: z
    .union([z.enum(["ayah", "ibu", "wali"]), z.literal(""), z.undefined()])
    .transform((v) => (v ? v : "wali")),
});

export type ImportRowError = { row: number; message: string };
