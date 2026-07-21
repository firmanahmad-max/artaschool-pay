"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/guards";
import {
  academicYearSchema,
  classSchema,
  guardianInputSchema,
  importRowSchema,
  studentSchema,
  type ImportRowError,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ImportResult =
  | { ok: true; inserted: number; errors: ImportRowError[] }
  | { ok: false; error: string };

const MASTER_ROLES = ["super_admin", "operator"];

function firstIssue(e: { issues: { message: string }[] }) {
  return e.issues[0]?.message ?? "Input tidak valid";
}

// ── Tahun Ajaran ─────────────────────────────────────────────────────────────

export async function createAcademicYear(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(MASTER_ROLES);
  const parsed = academicYearSchema.safeParse({
    name: formData.get("name"),
    starts_on: formData.get("starts_on") ?? "",
    ends_on: formData.get("ends_on") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .insert({ ...parsed.data, school_id: admin.school_id })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Tahun ajaran dengan nama itu sudah ada."
          : "Gagal menyimpan tahun ajaran.",
    };
  }

  await supabase.rpc("log_audit", {
    p_action: "academic_year.created",
    p_entity: "academic_year",
    p_entity_id: data.id,
    p_after: parsed.data,
  });
  revalidatePath("/admin/tahun-ajaran");
  return { ok: true };
}

export async function activateAcademicYear(formData: FormData): Promise<void> {
  await requireAdmin(MASTER_ROLES);
  const id = String(formData.get("id") ?? "");
  const supabase = createClient();
  await supabase.rpc("activate_academic_year", { p_year_id: id });
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin/siswa");
}

// ── Kelas ────────────────────────────────────────────────────────────────────

async function getActiveYearId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createClass(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(MASTER_ROLES);
  const parsed = classSchema.safeParse({
    grade: formData.get("grade"),
    label: formData.get("label"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const yearId = await getActiveYearId();
  if (!yearId) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      ...parsed.data,
      school_id: admin.school_id,
      academic_year_id: yearId,
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Label kelas itu sudah ada di tahun ajaran aktif."
          : "Gagal menyimpan kelas.",
    };
  }

  await supabase.rpc("log_audit", {
    p_action: "class.created",
    p_entity: "class",
    p_entity_id: data.id,
    p_after: parsed.data,
  });
  revalidatePath("/admin/siswa");
  return { ok: true };
}

export async function deleteClass(formData: FormData): Promise<void> {
  await requireAdmin(MASTER_ROLES);
  const id = String(formData.get("id") ?? "");
  const supabase = createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (!error) {
    await supabase.rpc("log_audit", {
      p_action: "class.deleted",
      p_entity: "class",
      p_entity_id: id,
    });
  }
  // FK violation (masih ada siswa) dibiarkan diam — baris tidak hilang dari UI
  revalidatePath("/admin/siswa");
}

// ── Siswa ────────────────────────────────────────────────────────────────────

async function findOrCreateGuardian(
  schoolId: string,
  name: string,
  phone: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("guardians")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("guardians")
    .insert({ school_id: schoolId, full_name: name, phone })
    .select("id")
    .single();
  return error ? null : created.id;
}

export async function createStudent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(MASTER_ROLES);
  const parsed = studentSchema.safeParse({
    nis: formData.get("nis"),
    full_name: formData.get("full_name"),
    class_id: formData.get("class_id"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const guardianRaw = {
    guardian_name: String(formData.get("guardian_name") ?? "").trim(),
    guardian_phone: String(formData.get("guardian_phone") ?? "").trim(),
    relation: String(formData.get("relation") ?? "wali"),
  };
  let guardianParsed: ReturnType<typeof guardianInputSchema.safeParse> | null =
    null;
  if (guardianRaw.guardian_name || guardianRaw.guardian_phone) {
    guardianParsed = guardianInputSchema.safeParse(guardianRaw);
    if (!guardianParsed.success) {
      return { ok: false, error: firstIssue(guardianParsed.error) };
    }
  }

  const supabase = createClient();
  const { data: student, error } = await supabase
    .from("students")
    .insert({
      school_id: admin.school_id,
      nis: parsed.data.nis,
      full_name: parsed.data.full_name,
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? `NIS ${parsed.data.nis} sudah terdaftar.`
          : "Gagal menyimpan siswa.",
    };
  }

  await supabase
    .from("class_enrollments")
    .insert({ student_id: student.id, class_id: parsed.data.class_id });

  if (guardianParsed?.success) {
    const guardianId = await findOrCreateGuardian(
      admin.school_id,
      guardianParsed.data.guardian_name,
      guardianParsed.data.guardian_phone,
    );
    if (guardianId) {
      await supabase.from("guardian_students").insert({
        guardian_id: guardianId,
        student_id: student.id,
        relation: guardianParsed.data.relation,
      });
    }
  }

  await supabase.rpc("log_audit", {
    p_action: "student.created",
    p_entity: "student",
    p_entity_id: student.id,
    p_after: parsed.data,
  });
  revalidatePath("/admin/siswa");
  return { ok: true };
}

export async function updateStudent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin(MASTER_ROLES);
  const studentId = String(formData.get("student_id") ?? "");
  const parsed = studentSchema.safeParse({
    nis: formData.get("nis"),
    full_name: formData.get("full_name"),
    class_id: formData.get("class_id"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase
    .from("students")
    .update({ nis: parsed.data.nis, full_name: parsed.data.full_name })
    .eq("id", studentId);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? `NIS ${parsed.data.nis} sudah dipakai siswa lain.`
          : "Gagal menyimpan perubahan.",
    };
  }

  // Pindah kelas dalam tahun ajaran aktif: lepas enrollment lama, pasang baru
  const yearId = await getActiveYearId();
  if (yearId) {
    const { data: activeClasses } = await supabase
      .from("classes")
      .select("id")
      .eq("academic_year_id", yearId);
    const activeIds = (activeClasses ?? []).map((c) => c.id);
    if (activeIds.length > 0) {
      await supabase
        .from("class_enrollments")
        .delete()
        .eq("student_id", studentId)
        .in("class_id", activeIds);
    }
    await supabase
      .from("class_enrollments")
      .insert({ student_id: studentId, class_id: parsed.data.class_id });
  }

  await supabase.rpc("log_audit", {
    p_action: "student.updated",
    p_entity: "student",
    p_entity_id: studentId,
    p_after: parsed.data,
  });
  revalidatePath("/admin/siswa");
  revalidatePath(`/admin/siswa/${studentId}`);
  return { ok: true };
}

export async function setStudentActive(formData: FormData): Promise<void> {
  await requireAdmin(MASTER_ROLES);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = createClient();
  const { error } = await supabase
    .from("students")
    .update({ is_active: active })
    .eq("id", id);
  if (!error) {
    await supabase.rpc("log_audit", {
      p_action: active ? "student.activated" : "student.deactivated",
      p_entity: "student",
      p_entity_id: id,
    });
  }
  revalidatePath("/admin/siswa");
  revalidatePath(`/admin/siswa/${id}`);
}

// ── Wali per siswa ───────────────────────────────────────────────────────────

export async function addGuardianLink(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin(MASTER_ROLES);
  const studentId = String(formData.get("student_id") ?? "");
  const parsed = guardianInputSchema.safeParse({
    guardian_name: formData.get("guardian_name"),
    guardian_phone: formData.get("guardian_phone"),
    relation: formData.get("relation") ?? "wali",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const guardianId = await findOrCreateGuardian(
    admin.school_id,
    parsed.data.guardian_name,
    parsed.data.guardian_phone,
  );
  if (!guardianId) return { ok: false, error: "Gagal menyimpan data wali." };

  const supabase = createClient();
  const { error } = await supabase.from("guardian_students").insert({
    guardian_id: guardianId,
    student_id: studentId,
    relation: parsed.data.relation,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: "Gagal menautkan wali." };
  }

  await supabase.rpc("log_audit", {
    p_action: "student.guardian_linked",
    p_entity: "student",
    p_entity_id: studentId,
    p_after: { guardian_id: guardianId, relation: parsed.data.relation },
  });
  revalidatePath(`/admin/siswa/${studentId}`);
  return { ok: true };
}

export async function removeGuardianLink(formData: FormData): Promise<void> {
  await requireAdmin(MASTER_ROLES);
  const studentId = String(formData.get("student_id") ?? "");
  const guardianId = String(formData.get("guardian_id") ?? "");
  const supabase = createClient();
  const { error } = await supabase
    .from("guardian_students")
    .delete()
    .eq("student_id", studentId)
    .eq("guardian_id", guardianId);
  if (!error) {
    await supabase.rpc("log_audit", {
      p_action: "student.guardian_unlinked",
      p_entity: "student",
      p_entity_id: studentId,
      p_after: { guardian_id: guardianId },
    });
  }
  revalidatePath(`/admin/siswa/${studentId}`);
}

// ── Import Excel ─────────────────────────────────────────────────────────────

/**
 * Import siswa dari .xlsx (template: NIS | Nama Lengkap | Kelas | Nama Wali |
 * No HP Wali | Relasi). Validasi baris-per-baris; baris valid tetap diproses,
 * baris bermasalah dilaporkan (PRD §7.2).
 */
export async function importStudents(
  _prev: ImportResult | null,
  formData: FormData,
): Promise<ImportResult> {
  const admin = await requireAdmin(MASTER_ROLES);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih berkas .xlsx terlebih dahulu." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Berkas maksimal 2 MB." };
  }

  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!sheet) return { ok: false, error: "Berkas tidak memiliki sheet." };
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    return { ok: false, error: "Berkas bukan Excel yang valid." };
  }
  if (rows.length === 0) {
    return { ok: false, error: "Tidak ada baris data di berkas." };
  }
  if (rows.length > 2000) {
    return { ok: false, error: "Maksimal 2.000 baris per import." };
  }

  const yearId = await getActiveYearId();
  if (!yearId) return { ok: false, error: "Belum ada tahun ajaran aktif." };

  const supabase = createClient();
  const [{ data: classes }, { data: existingStudents }] = await Promise.all([
    supabase.from("classes").select("id, label").eq("academic_year_id", yearId),
    supabase.from("students").select("nis"),
  ]);
  const classByLabel = new Map(
    (classes ?? []).map((c) => [c.label.toUpperCase(), c.id]),
  );
  const seenNis = new Set((existingStudents ?? []).map((s) => s.nis));

  const errors: ImportRowError[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    const rowNo = i + 2; // baris 1 = header
    const parsed = importRowSchema.safeParse({
      nis: raw["NIS"],
      full_name: raw["Nama Lengkap"],
      class_label: raw["Kelas"],
      guardian_name: String(raw["Nama Wali"] ?? "").trim(),
      guardian_phone: String(raw["No HP Wali"] ?? "").trim(),
      relation: String(raw["Relasi"] ?? "").trim().toLowerCase(),
    });
    if (!parsed.success) {
      errors.push({ row: rowNo, message: firstIssue(parsed.error) });
      continue;
    }
    const row = parsed.data;

    if (seenNis.has(row.nis)) {
      errors.push({ row: rowNo, message: `NIS ${row.nis} sudah terdaftar` });
      continue;
    }
    const classId = classByLabel.get(row.class_label.toUpperCase());
    if (!classId) {
      errors.push({
        row: rowNo,
        message: `Kelas "${row.class_label}" tidak ada di tahun ajaran aktif`,
      });
      continue;
    }
    if (row.guardian_phone && !row.guardian_name) {
      errors.push({ row: rowNo, message: "Nama wali kosong padahal No HP diisi" });
      continue;
    }

    const { data: student, error } = await supabase
      .from("students")
      .insert({
        school_id: admin.school_id,
        nis: row.nis,
        full_name: row.full_name,
      })
      .select("id")
      .single();
    if (error) {
      errors.push({ row: rowNo, message: "Gagal menyimpan siswa" });
      continue;
    }
    seenNis.add(row.nis);

    await supabase
      .from("class_enrollments")
      .insert({ student_id: student.id, class_id: classId });

    if (row.guardian_name && row.guardian_phone) {
      const guardianId = await findOrCreateGuardian(
        admin.school_id,
        row.guardian_name,
        row.guardian_phone,
      );
      if (guardianId) {
        await supabase.from("guardian_students").insert({
          guardian_id: guardianId,
          student_id: student.id,
          relation: row.relation,
        });
      } else {
        errors.push({
          row: rowNo,
          message: "Siswa tersimpan, tetapi data wali gagal disimpan",
        });
      }
    }
    inserted++;
  }

  await supabase.rpc("log_audit", {
    p_action: "student.imported",
    p_entity: "student",
    p_after: { inserted, failed: errors.length, total: rows.length },
  });
  revalidatePath("/admin/siswa");
  return { ok: true, inserted, errors };
}
