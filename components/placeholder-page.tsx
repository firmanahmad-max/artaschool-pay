import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Placeholder Sprint 1 — diganti implementasi nyata di sprint terkait (PRD §9). */
export function PlaceholderPage({
  title,
  description,
  sprint,
}: {
  title: string;
  description: string;
  sprint: number;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segera hadir</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Modul ini dijadwalkan pada Sprint {sprint} (lihat PRD §9).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
