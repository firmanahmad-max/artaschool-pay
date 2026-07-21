import { redirect } from "next/navigation";

export default function Home() {
  // Root diarahkan ke beranda orang tua; admin masuk via /admin
  redirect("/beranda");
}
