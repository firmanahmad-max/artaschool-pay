/** Layout halaman login: kartu terpusat, tanpa navigasi. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            A
          </span>
          <h1 className="text-lg font-semibold">ArtaSchool Pay</h1>
          <p className="text-sm text-muted-foreground">
            Administrasi pembayaran sekolah yang cepat &amp; transparan
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
