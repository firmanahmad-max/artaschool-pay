/**
 * Service worker ArtaSchool Pay (PRD §7.1 — PWA offline-aware).
 *
 * PRINSIP KEAMANAN (ini aplikasi keuangan):
 * - JANGAN pernah men-cache bukti transfer, respons API, atau panggilan
 *   Supabase. Semuanya data sensitif / ber-signed-URL yang cepat kedaluwarsa.
 * - Hanya halaman orang tua yang di-cache, agar riwayat tetap bisa dilihat
 *   saat sinyal hilang.
 * - Cache DIHAPUS saat logout (ponsel keluarga sering dipakai bersama) —
 *   dipicu pesan `bersihkan-cache` dari aplikasi.
 */

const VERSI = "v1";
const CACHE_SHELL = `arta-shell-${VERSI}`;
const CACHE_HALAMAN = `arta-halaman-${VERSI}`;
const HALAMAN_OFFLINE = "/offline";

// Halaman orang tua yang boleh di-cache untuk dilihat offline
const POLA_HALAMAN_ORTU = /^\/(beranda|riwayat|pengumuman|akun)(\/|$)/;

/** Pasang halaman offline; tidak pernah menggagalkan pemasangan SW. */
async function pasangHalamanOffline() {
  try {
    const c = await caches.open(CACHE_SHELL);
    await c.add(HALAMAN_OFFLINE);
  } catch {
    // mis. sedang offline, atau dev server belum selesai meng-compile rute.
    // Dicoba lagi saat activate & saat navigasi berikutnya.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(pasangHalamanOffline().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((kunci) =>
        Promise.all(
          kunci
            .filter((k) => k.startsWith("arta-") && !k.endsWith(VERSI))
            .map((k) => caches.delete(k)),
        ),
      )
      // pemulihan bila precache saat install gagal
      .then(() => caches.open(CACHE_SHELL))
      .then((c) => c.match(HALAMAN_OFFLINE))
      .then((ada) => (ada ? null : pasangHalamanOffline()))
      .then(() => self.clients.claim()),
  );
});

/** Permintaan yang TIDAK BOLEH disentuh service worker sama sekali. */
function lewatiSaja(request, url) {
  return (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") || // area admin: selalu data terkini
    url.searchParams.has("token") // signed URL bukti transfer
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (lewatiSaja(request, url)) return;

  // Aset build Next.js — immutable, aman di-cache selamanya
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const salinan = res.clone();
            caches.open(CACHE_SHELL).then((c) => c.put(request, salinan));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigasi halaman: utamakan jaringan agar data selalu segar;
  // jatuh ke cache hanya saat offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && POLA_HALAMAN_ORTU.test(url.pathname)) {
            const salinan = res.clone();
            caches.open(CACHE_HALAMAN).then((c) => c.put(request, salinan));
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(request);
          if (hit) return hit;
          const offline = await caches.match(HALAMAN_OFFLINE);
          return offline ?? Response.error();
        }),
    );
  }
});

// Logout / ganti akun → buang seluruh jejak halaman di perangkat.
// Halaman offline dipasang ulang setelahnya: ia hanya ditambahkan saat
// `install`, sehingga tanpa ini pengguna offline pasca-logout akan menerima
// error mentah alih-alih halaman ramah.
self.addEventListener("message", (event) => {
  if (event.data === "bersihkan-cache") {
    event.waitUntil(
      caches
        .keys()
        .then((kunci) =>
          Promise.all(kunci.filter((k) => k.startsWith("arta-")).map((k) => caches.delete(k))),
        )
        .then(() => pasangHalamanOffline()),
    );
  }
});
