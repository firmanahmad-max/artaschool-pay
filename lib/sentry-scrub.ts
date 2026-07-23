/**
 * Penyaring data pribadi sebelum laporan error dikirim ke Sentry.
 *
 * PRD §8 mewajibkan kepatuhan UU PDP ("data anak minimal"). Laporan error
 * mudah sekali membocorkan nomor HP wali, NIS, nama siswa, nominal, atau
 * path bukti transfer lewat pesan galat, URL, dan breadcrumb. Semua itu
 * disamarkan di sini SEBELUM meninggalkan server.
 *
 * Prinsipnya: lebih baik kehilangan sedikit konteks debugging daripada
 * mengirim data anak ke layanan pihak ketiga.
 */

type Pola = { re: RegExp; ganti: string };

const POLA: Pola[] = [
  // Nomor HP Indonesia: +628…, 628…, 08…
  { re: /(\+?62|\b0)8\d{7,12}\b/g, ganti: "[nomor-hp]" },
  // Token signed URL bukti transfer
  { re: /([?&](token|signature|jwt)=)[^&\s"']+/gi, ganti: "$1[disamarkan]" },
  // Path bukti transfer: {uuid}/{uuid}/{uuid}.jpg
  {
    re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f-]{36}\/[^\s"']+/gi,
    ganti: "[path-bukti]",
  },
  // Alamat email
  { re: /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, ganti: "[email]" },
  // Bearer token / apikey
  { re: /\b(bearer\s+|apikey[=:\s]+)[A-Za-z0-9._-]{10,}/gi, ganti: "$1[disamarkan]" },
  // JWT
  { re: /\beyJ[A-Za-z0-9._-]{10,}/g, ganti: "[jwt]" },
];

/** Kunci yang isinya selalu dibuang, apa pun nilainya. */
const KUNCI_SENSITIF =
  /^(phone|no_hp|nis|full_name|nama|sender_name|bank_name|amount|nominal|proof_path|proof_sha256|password|token|secret|authorization|cookie|review_note|body)$/i;

/** Samarkan pola data pribadi di dalam teks bebas. */
export function samarkanTeks(teks: string): string {
  let hasil = teks;
  for (const { re, ganti } of POLA) hasil = hasil.replace(re, ganti);
  return hasil;
}

/**
 * Telusuri objek (event Sentry) dan samarkan isinya. Kedalaman dibatasi agar
 * struktur melingkar / sangat dalam tidak menggantung proses.
 */
export function samarkanObjek<T>(nilai: T, kedalaman = 0): T {
  if (kedalaman > 8) return "[terlalu-dalam]" as unknown as T;
  if (typeof nilai === "string") return samarkanTeks(nilai) as unknown as T;
  if (!nilai || typeof nilai !== "object") return nilai;

  if (Array.isArray(nilai)) {
    return nilai.map((v) => samarkanObjek(v, kedalaman + 1)) as unknown as T;
  }

  const keluar: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) {
    keluar[k] = KUNCI_SENSITIF.test(k) ? "[disamarkan]" : samarkanObjek(v, kedalaman + 1);
  }
  return keluar as unknown as T;
}

/**
 * beforeSend Sentry: buang identitas pengguna, lalu samarkan seluruh isi
 * laporan. Dipakai bersama `sendDefaultPii: false`.
 */
export function saringEventSentry<T>(event: T): T {
  const bersih = samarkanObjek(event);
  // Jangan pernah kirim identitas — cukup tahu ADA error, bukan siapa
  if (bersih && typeof bersih === "object") {
    delete (bersih as Record<string, unknown>).user;
    const req = (bersih as Record<string, unknown>).request as
      | Record<string, unknown>
      | undefined;
    if (req) {
      delete req.cookies;
      delete req.headers;
      delete req.data;
    }
  }
  return bersih;
}
