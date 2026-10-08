import { redirect } from "next/navigation";

// Por ahora la única experiencia es KRE: "/" lleva a su landing.
export default function Home() {
  redirect("/karting/kartingrentalexperience");
}
