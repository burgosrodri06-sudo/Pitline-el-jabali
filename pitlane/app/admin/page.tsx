import { barlow, barlowCondensed } from "@/components/auth/fonts";
import { requireAdmin } from "@/lib/auth";

// Página mínima para probar requireAdmin().
export default async function AdminPage() {
  const { user, profile } = await requireAdmin();

  return (
    <div className={`${barlow.className} min-h-dvh bg-[#0A0A0A] text-[#F4F4F4]`}>
      <div className="h-1 bg-[#C8102E]" />
      <main className="mx-auto max-w-md px-5 py-12">
        <h1 className={`${barlowCondensed.className} text-4xl font-bold leading-tight`}>
          Panel de administración
        </h1>
        <p className="mt-2 text-[#A3A3A3]">{profile.full_name || user.email}</p>
      </main>
    </div>
  );
}
