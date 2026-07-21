import { z } from "zod";

export const announcementSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi").max(150),
    body: z.string().trim().max(2000).optional().or(z.literal("")),
    scope: z.enum(["all", "class"]).default("all"),
    class_ids: z.array(z.string().uuid()).default([]),
    publish_at: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    expires_at: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    broadcast: z.coerce.boolean().default(false),
  })
  .refine((v) => v.scope !== "class" || v.class_ids.length > 0, {
    message: "Pilih minimal satu kelas untuk audiens kelas",
    path: ["class_ids"],
  });
