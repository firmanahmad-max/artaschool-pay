import { z } from "zod";

/** Rupiah penuh: integer non-negatif, tanpa desimal (CONTEXT Konvensi #2). */
export const rupiahSchema = z.coerce
  .number({ invalid_type_error: "Nominal harus angka" })
  .int("Nominal harus bilangan bulat (tanpa desimal)")
  .min(0, "Nominal tidak boleh negatif")
  .max(1_000_000_000, "Nominal terlalu besar");

export const paymentTypeSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis pembayaran wajib diisi").max(60),
  default_amount: rupiahSchema,
  is_recurring: z.coerce.boolean().default(false),
});

/** Periode wajib untuk jenis recurring (SPP bulanan): "2026-08" → 2026-08-01. */
export const generateBillsSchema = z
  .object({
    payment_type_id: z.string().uuid("Pilih jenis pembayaran"),
    is_recurring: z.coerce.boolean(),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Pilih bulan periode")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    due_date: z
      .string()
      .date()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    amount: rupiahSchema.optional(),
  })
  .refine((v) => !v.is_recurring || !!v.month, {
    message: "Periode (bulan) wajib untuk pembayaran berulang",
    path: ["month"],
  });

export const individualBillSchema = z
  .object({
    student_id: z.string().uuid("Pilih siswa"),
    payment_type_id: z.string().uuid("Pilih jenis pembayaran"),
    amount: rupiahSchema.refine((v) => v > 0, "Nominal harus lebih dari 0"),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    due_date: z
      .string()
      .date()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .transform((v) => ({
    ...v,
    period: v.month ? `${v.month}-01` : undefined,
  }));

export const waiveBillSchema = z.object({
  bill_id: z.string().uuid(),
  note: z.string().trim().min(1, "Catatan wajib diisi"),
});
