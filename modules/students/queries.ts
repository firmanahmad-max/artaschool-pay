import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getAcademicYears() {
  const supabase = createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("id, name, is_active, starts_on, ends_on")
    .order("name", { ascending: false });
  return data ?? [];
}

export async function getActiveYear() {
  const supabase = createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getClasses(yearId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("classes")
    .select("id, grade, label, class_enrollments(count)")
    .eq("academic_year_id", yearId)
    .order("grade")
    .order("label");
  return (data ?? []).map((c) => ({
    id: c.id,
    grade: c.grade,
    label: c.label,
    studentCount: c.class_enrollments[0]?.count ?? 0,
  }));
}

export async function getStudents() {
  const supabase = createClient();
  const { data } = await supabase
    .from("students")
    .select(
      "id, nis, full_name, is_active, class_enrollments(classes(label, academic_year_id, academic_years(is_active))), guardian_students(relation, guardians(full_name, phone))",
    )
    .order("full_name");
  return (data ?? []).map((s) => ({
    id: s.id,
    nis: s.nis,
    full_name: s.full_name,
    is_active: s.is_active ?? true,
    classLabel:
      s.class_enrollments.find((e) => e.classes?.academic_years?.is_active)
        ?.classes?.label ?? "—",
    guardians: s.guardian_students.map((g) => ({
      name: g.guardians?.full_name ?? "?",
      phone: g.guardians?.phone ?? "",
      relation: g.relation ?? "wali",
    })),
  }));
}

export async function getStudent(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("students")
    .select(
      "id, nis, full_name, is_active, class_enrollments(class_id, classes(label, academic_years(is_active))), guardian_students(relation, guardians(id, full_name, phone))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    nis: data.nis,
    full_name: data.full_name,
    is_active: data.is_active ?? true,
    activeClassId:
      data.class_enrollments.find((e) => e.classes?.academic_years?.is_active)
        ?.class_id ?? "",
    guardians: data.guardian_students.map((g) => ({
      id: g.guardians?.id ?? "",
      name: g.guardians?.full_name ?? "?",
      phone: g.guardians?.phone ?? "",
      relation: g.relation ?? "wali",
    })),
  };
}
