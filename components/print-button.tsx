"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Jalur PDF: dialog cetak browser (tanpa pustaka PDF tambahan). */
export function PrintButton() {
  return (
    <Button type="button" variant="ghost" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      Cetak / PDF
    </Button>
  );
}
