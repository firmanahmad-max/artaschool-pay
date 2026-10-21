/**
 * Statistik perangkat ANONIM — untuk memutuskan berbasis data kapan aman
 * pindah ke Tailwind 4 (butuh Safari 16.4+/Chrome 111+; lihat
 * CHECKLIST-GO-LIVE §6). Fungsi murni; diuji `npm run test:perangkat`.
 *
 * Prinsip UU PDP: yang dikirim HANYA kategori kasar (keluarga browser, versi
 * mayor, OS + versi mayor, dukungan fitur). String user-agent utuh, IP,
 * identitas wali, dan halaman yang dibuka TIDAK pernah dikirim/disimpan.
 */

export const BROWSER = ["chrome", "safari", "firefox", "samsung", "edge", "opera", "webview", "lain"] as const;
export const OS = ["android", "ios", "windows", "macos", "linux", "lain"] as const;
export const AREA = ["wali", "admin"] as const;

export type Browser = (typeof BROWSER)[number];
export type Os = (typeof OS)[number];
export type Area = (typeof AREA)[number];

export type Perangkat = { browser: Browser; versi: number; os: Os; osVersi: number };

function angka(m: RegExpMatchArray | null, batas: number): number {
  const n = m ? Number.parseInt(m[1] ?? "", 10) : 0;
  return Number.isFinite(n) && n >= 0 && n <= batas ? n : 0;
}

/** User-agent → kategori kasar. Hasilnya hanya nilai dari daftar tertutup. */
export function kategoriPerangkat(ua: string): Perangkat {
  const u = ua || "";
  let os: Os = "lain";
  let osVersi = 0;
  if (/iPhone|iPad|iPod/.test(u)) {
    os = "ios";
    osVersi = angka(u.match(/OS (\d+)[_.]/), 99);
  } else if (/Android/.test(u)) {
    os = "android";
    osVersi = angka(u.match(/Android (\d+)/), 99);
  } else if (/Windows NT/.test(u)) {
    os = "windows";
  } else if (/Mac OS X/.test(u)) {
    os = "macos";
  } else if (/Linux/.test(u)) {
    os = "linux";
  }

  // Di iOS SEMUA browser memakai mesin Safari (WebKit) — versi yang
  // menentukan dukungan CSS adalah versi iOS, jadi dicatat sebagai safari.
  if (os === "ios") return { browser: "safari", versi: osVersi, os, osVersi };

  let browser: Browser = "lain";
  let versi = 0;
  const cocok = (re: RegExp) => u.match(re);
  if (/; wv\)|FBAN|FBAV|Instagram|Line\//.test(u)) {
    browser = "webview";
    versi = angka(cocok(/Chrome\/(\d+)/), 999);
  } else if (cocok(/SamsungBrowser\/(\d+)/)) {
    browser = "samsung";
    versi = angka(cocok(/SamsungBrowser\/(\d+)/), 999);
  } else if (cocok(/Edg(?:A|iOS)?\/(\d+)/)) {
    browser = "edge";
    versi = angka(cocok(/Edg(?:A|iOS)?\/(\d+)/), 999);
  } else if (cocok(/OPR\/(\d+)/)) {
    browser = "opera";
    versi = angka(cocok(/OPR\/(\d+)/), 999);
  } else if (cocok(/Firefox\/(\d+)/)) {
    browser = "firefox";
    versi = angka(cocok(/Firefox\/(\d+)/), 999);
  } else if (cocok(/Chrome\/(\d+)/)) {
    browser = "chrome";
    versi = angka(cocok(/Chrome\/(\d+)/), 999);
  } else if (cocok(/Version\/(\d+)[\d.]* Safari/)) {
    browser = "safari";
    versi = angka(cocok(/Version\/(\d+)/), 999);
  }
  return { browser, versi, os, osVersi };
}

/** Hormati Do Not Track & Global Privacy Control. */
export function bolehLapor(sinyal: { doNotTrack?: string | null; gpc?: boolean }): boolean {
  return sinyal.doNotTrack !== "1" && sinyal.doNotTrack !== "yes" && sinyal.gpc !== true;
}

/** Sekali per perangkat per hari (tanggal lokal perangkat). */
export function perluLapor(terakhir: string | null, hariIni: string): boolean {
  return terakhir !== hariIni;
}
