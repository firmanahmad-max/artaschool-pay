"use client";

import {
  createContext,
  useContext,
  useTransition,
  type FormEvent,
  type FormHTMLAttributes,
  type Ref,
} from "react";

const StatusAksi = createContext({ pending: false });

/** Pengganti `useFormStatus` untuk tombol di dalam `<AksiForm>`. */
export function useStatusAksi() {
  return useContext(StatusAksi);
}

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  /** Dispatch dari `useActionState`. */
  action: (data: FormData) => void;
  /** Dipanggil lebih dulu; `e.preventDefault()` di sini membatalkan pengiriman. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  ref?: Ref<HTMLFormElement>;
};

/**
 * `<form>` untuk aksi `useActionState` TANPA reset otomatis React 19.
 *
 * Sejak React 19, `<form action={fn}>` mengosongkan seluruh input
 * tak-terkontrol setiap kali aksi selesai — termasuk saat aksi mengembalikan
 * galat validasi. Akibatnya admin yang salah ketik sandi kehilangan emailnya,
 * dan form tambah siswa/pengumuman yang ditolak kehilangan seluruh isiannya.
 * Komponen ini mempertahankan perilaku React 18: isian tetap ada; reset hanya
 * bila diminta eksplisit (`form.reset()`, mis. setelah ubah PIN berhasil).
 */
export function AksiForm({ action, onSubmit, children, ref, ...rest }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      {...rest}
      ref={ref}
      onSubmit={(e) => {
        onSubmit?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter ?? undefined);
        startTransition(() => action(data));
      }}
    >
      <StatusAksi.Provider value={{ pending }}>{children}</StatusAksi.Provider>
    </form>
  );
}
