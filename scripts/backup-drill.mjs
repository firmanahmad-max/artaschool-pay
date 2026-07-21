/**
 * Backup drill (PRD §9 Sprint 10, §6.4).
 * Membuktikan backup benar-benar bisa DIPULIHKAN — bukan sekadar ada.
 * Alur: dump DB lokal → restore ke database baru → bandingkan jumlah baris
 * tabel kritis → hapus database uji.
 *
 *   npm run backup:drill
 *
 * Prasyarat: Docker + Supabase lokal berjalan.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";

const CONTAINER = "supabase_db_ArtaSchool_Pay";
const SOURCE_DB = "postgres";
const RESTORE_DB = `drill_${Date.now()}`;
const DUMP_IN_CONTAINER = "/tmp/drill.dump";
const LOCAL_DIR = "backups";
const LOCAL_DUMP = `${LOCAL_DIR}/drill-${new Date().toISOString().slice(0, 10)}.dump`;

const TABLES = [
  "schools",
  "students",
  "guardians",
  "guardian_students",
  "bills",
  "payments",
  "payment_allocations",
  "audit_logs",
];

function docker(args, opts = {}) {
  return execFileSync("docker", args, { encoding: "utf8", ...opts });
}

function psql(db, sql) {
  return docker([
    "exec", CONTAINER, "psql", "-U", "postgres", "-d", db, "-t", "-A", "-c", sql,
  ]).trim();
}

function counts(db) {
  const out = {};
  for (const t of TABLES) {
    try {
      out[t] = Number(psql(db, `select count(*) from public.${t};`));
    } catch {
      out[t] = -1; // tabel tidak ada di hasil restore
    }
  }
  return out;
}

console.log("\n=== Backup drill ArtaSchool Pay ===\n");

console.log("[1] Dump database sumber…");
docker([
  "exec", CONTAINER, "pg_dump", "-U", "postgres", "-d", SOURCE_DB,
  "-Fc", "-f", DUMP_IN_CONTAINER,
]);
mkdirSync(LOCAL_DIR, { recursive: true });
docker(["cp", `${CONTAINER}:${DUMP_IN_CONTAINER}`, LOCAL_DUMP]);
const sizeKb = Math.round(statSync(LOCAL_DUMP).size / 1024);
console.log(`    dump tersimpan: ${LOCAL_DUMP} (${sizeKb} KB)`);

const before = counts(SOURCE_DB);
console.log("[2] Jumlah baris sumber:", before);

console.log(`[3] Restore ke database uji '${RESTORE_DB}'…`);
psql("postgres", `create database ${RESTORE_DB};`);
try {
  docker([
    "exec", CONTAINER, "pg_restore", "-U", "postgres", "-d", RESTORE_DB,
    "--no-owner", "--no-privileges", DUMP_IN_CONTAINER,
  ]);
} catch {
  // pg_restore sering exit != 0 karena peran/ekstensi milik Supabase;
  // yang menentukan adalah perbandingan data di bawah.
  console.log("    (peringatan pg_restore diabaikan — dicek lewat data)");
}

const after = counts(RESTORE_DB);
console.log("[4] Jumlah baris hasil restore:", after);

const mismatched = TABLES.filter((t) => before[t] !== after[t]);

console.log("\n[5] Bersihkan database uji…");
psql("postgres", `drop database ${RESTORE_DB};`);

if (mismatched.length > 0) {
  console.error("\nDRILL GAGAL — tabel tidak cocok:");
  for (const t of mismatched) {
    console.error(` - ${t}: sumber ${before[t]} vs restore ${after[t]}`);
  }
  process.exit(1);
}

console.log(
  `\n=== DRILL LULUS: ${TABLES.length} tabel kritis pulih utuh ===`,
);
console.log(`Simpan ${LOCAL_DUMP} ke storage terenkripsi terpisah.\n`);
