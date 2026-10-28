/**
 * Backup drill (PRD §9 Sprint 10, §6.4).
 * Membuktikan backup benar-benar bisa DIPULIHKAN — dan pulih dalam keadaan
 * AMAN, bukan sekadar ada.
 *
 * Alur: dump DB lokal → restore ke database baru → bandingkan:
 *   1. SELURUH tabel skema public (otomatis — tabel baru ikut tercek):
 *      jumlah baris + checksum isi;
 *   2. paritas KEAMANAN: hak EXECUTE anon/authenticated tiap fungsi, status
 *      RLS tiap tabel, policy, dan trigger.
 * → hapus database uji.
 *
 *   npm run backup:drill
 *
 * Mengapa (2) penting: restore dengan `--no-privileges` membuang semua
 * GRANT/REVOKE — terbukti membuat RPC internal (enqueue/claim notifikasi,
 * verify_activation_code, auth_user_id_by_phone, …) kembali bisa dipanggil
 * anon, membuka lagi celah yg ditutup migration 018. Restore WAJIB membawa
 * privilese (lihat CHECKLIST-GO-LIVE).
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
// Hanya untuk uji-gigit drill ini sendiri: BACKUP_DRILL_NO_PRIVILEGES=1
const TANPA_PRIVILESE = process.env.BACKUP_DRILL_NO_PRIVILEGES === "1";

function docker(args, opts = {}) {
  return execFileSync("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
}

function psql(db, sql) {
  return docker([
    "exec", CONTAINER, "psql", "-U", "postgres", "-d", db, "-t", "-A", "-F", "|", "-c", sql,
  ]).trim();
}

function daftarTabel(db) {
  return psql(db, "select tablename from pg_tables where schemaname = 'public' order by 1;")
    .split("\n")
    .filter(Boolean);
}

/** Jumlah baris + checksum isi per tabel (urutan baris dinormalkan). */
function isiTabel(db, tabel) {
  const out = {};
  for (const t of tabel) {
    try {
      out[t] = psql(
        db,
        `select count(*) || ':' || md5(coalesce(string_agg(x::text, '|' order by x::text), ''))
         from public."${t}" x;`,
      );
    } catch {
      out[t] = "TIDAK-ADA";
    }
  }
  return out;
}

/** Sidik keamanan: ACL fungsi, RLS tabel, policy, trigger — dlm teks yg bisa dibandingkan. */
function sidikKeamanan(db) {
  const fungsi = psql(
    db,
    `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
            || ' definer=' || p.prosecdef
            || ' anon=' || has_function_privilege('anon', p.oid, 'execute')
            || ' auth=' || has_function_privilege('authenticated', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' order by 1;`,
  );
  const rls = psql(
    db,
    `select c.relname || ' rls=' || c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by 1;`,
  );
  const policy = psql(
    db,
    // Ekspresi policy bisa multi-baris → satukan spasi agar 1 policy = 1 baris.
    `select tablename || '.' || policyname || ' ' || cmd || ' '
            || regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''), '\\s+', ' ', 'g')
     from pg_policies where schemaname = 'public' order by 1;`,
  );
  const trigger = psql(
    db,
    `select c.relname || '.' || t.tgname
     from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal order by 1;`,
  );
  const baris = (s) => s.split("\n").filter(Boolean);
  return { fungsi: baris(fungsi), rls: baris(rls), policy: baris(policy), trigger: baris(trigger) };
}

function selisih(a, b) {
  const setB = new Set(b);
  const setA = new Set(a);
  return {
    hilang: a.filter((x) => !setB.has(x)),
    berbeda: b.filter((x) => !setA.has(x)),
  };
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

const tabel = daftarTabel(SOURCE_DB);
const sebelum = isiTabel(SOURCE_DB, tabel);
const kunciSebelum = sidikKeamanan(SOURCE_DB);
console.log(
  `[2] Sumber: ${tabel.length} tabel, ${kunciSebelum.fungsi.length} fungsi, ` +
    `${kunciSebelum.policy.length} policy, ${kunciSebelum.trigger.length} trigger`,
);

console.log(
  `[3] Restore ke database uji '${RESTORE_DB}'` +
    (TANPA_PRIVILESE ? " (UJI-GIGIT: --no-privileges)" : " (dengan privilese)") + "…",
);
psql("postgres", `create database ${RESTORE_DB};`);
try {
  docker([
    "exec", CONTAINER, "pg_restore", "-U", "postgres", "-d", RESTORE_DB, "--no-owner",
    ...(TANPA_PRIVILESE ? ["--no-privileges"] : []),
    DUMP_IN_CONTAINER,
  ], { stdio: ["ignore", "pipe", "pipe"] });
} catch {
  // pg_restore kerap exit != 0 karena objek MILIK PLATFORM Supabase (default
  // privileges peran supabase_*, vault, parameter log). Yang menentukan
  // adalah perbandingan data & keamanan di bawah.
  console.log("    (galat objek milik platform diabaikan — dicek lewat data & keamanan)");
}

const sesudah = isiTabel(RESTORE_DB, tabel);
const kunciSesudah = sidikKeamanan(RESTORE_DB);

console.log("\n[4] Bersihkan database uji…");
psql("postgres", `drop database ${RESTORE_DB};`);

const dataBeda = tabel.filter((t) => sebelum[t] !== sesudah[t]);
const keamananBeda = {};
for (const k of Object.keys(kunciSebelum)) {
  const d = selisih(kunciSebelum[k], kunciSesudah[k]);
  if (d.hilang.length || d.berbeda.length) keamananBeda[k] = d;
}

let gagal = false;
if (dataBeda.length) {
  gagal = true;
  console.error("\nDATA TIDAK PULIH UTUH:");
  for (const t of dataBeda) console.error(` - ${t}: sumber ${sebelum[t]} vs restore ${sesudah[t]}`);
}
if (Object.keys(keamananBeda).length) {
  gagal = true;
  console.error("\nKEAMANAN TIDAK PULIH SAMA (restore bisa membuka celah!):");
  for (const [k, d] of Object.entries(keamananBeda)) {
    for (const x of d.hilang.slice(0, 8)) console.error(` - ${k} sumber : ${x}`);
    for (const x of d.berbeda.slice(0, 8)) console.error(` + ${k} restore: ${x}`);
  }
}
if (gagal) {
  console.error("\n=== DRILL GAGAL ===");
  process.exit(1);
}

console.log(
  `\n=== DRILL LULUS: ${tabel.length} tabel pulih utuh (jumlah + checksum isi), ` +
    `${kunciSebelum.fungsi.length} fungsi dgn hak akses identik, ` +
    `${kunciSebelum.policy.length} policy & ${kunciSebelum.trigger.length} trigger sama ===`,
);
console.log(`Simpan ${LOCAL_DUMP} ke storage terenkripsi terpisah.\n`);
