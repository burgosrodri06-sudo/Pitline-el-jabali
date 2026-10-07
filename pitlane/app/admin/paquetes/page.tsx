import { requireAdmin } from "@/lib/auth";
import { getPackages } from "@/services/packages.service";
import type { PackageRow } from "@/domain/events/inventory";
import { InventoryShell } from "@/components/kre/InventoryShell";
import { InventoryForm } from "@/components/kre/InventoryForm";
export const dynamic = "force-dynamic";
export const metadata = { title: 'Paquetes | PitLane' };
function Fields({ pack }: { pack?: PackageRow }) {
  return (
    <>
      <input type="hidden" name="operation" value="package" />
      <input type="hidden" name="id" value={pack?.id ?? ""} />
      <label>
        Paquete
        <select name="name" defaultValue={pack?.name ?? "Individual"}>
          <option>Individual</option>
          <option>Segunda vuelta</option>
          <option>Friends Combo</option>
        </select>
      </label>
      <label>
        Precio (USD)
        <input
          name="price"
          required
          type="number"
          step="0.01"
          min="0.01"
          max="99999999.99"
          defaultValue={pack?.price ?? 15}
        />
      </label>
      <label>
        Vigente desde
        <input
          type="date"
          name="valid_from"
          defaultValue={pack?.valid_from ?? ""}
        />
      </label>
      <label>
        Vigente hasta
        <input
          type="date"
          name="valid_to"
          defaultValue={pack?.valid_to ?? ""}
        />
      </label>
      <label>
        Activo
        <input
          type="checkbox"
          name="active"
          defaultChecked={pack?.active ?? true}
        />
      </label>
    </>
  );
}
export default async function PackagesPage() {
  await requireAdmin();
  const packages = await getPackages(true);
  return (
    <InventoryShell admin>
      <p className="eyebrow">CATÁLOGO KRE</p>
      <h1>Paquetes</h1>
      <p>
        Individual: 1 cupo · Segunda vuelta: 1 cupo después de completar la
        primera · Friends Combo: 5 cupos en la misma tanda. Todos duran 10
        minutos.
      </p>
      <div className="grid">
        {packages.map((pack) => (
          <article key={pack.id}>
            <span className="badge">{pack.active ? "Activo" : "Inactivo"}</span>
            <h2>{pack.name}</h2>
            <h3>
              ${pack.price.toFixed(2)} · {pack.spots}{" "}
              {pack.spots === 1 ? "cupo" : "cupos"}
            </h3>
            <p>
              {pack.eligibility === "requires_first_ride"
                ? "Requiere primera vuelta completada."
                : "Sin requisito de primera vuelta."}
            </p>
            <InventoryForm>
              <Fields pack={pack} />
            </InventoryForm>
            <InventoryForm
              label={pack.active ? "Desactivar paquete" : "Activar paquete"}
            >
              <input type="hidden" name="operation" value="package-active" />
              <input type="hidden" name="id" value={pack.id} />
              <input type="hidden" name="active" value={String(!pack.active)} />
            </InventoryForm>
          </article>
        ))}
      </div>
      <details>
        <summary>Crear una versión de paquete</summary>
        <section>
          <p>
            Para nuevas vigencias o tarifas. Desactiva la versión anterior si no
            debe seguir disponible. Los registros históricos se conservan.
          </p>
          <InventoryForm label="Crear paquete">
            <Fields />
          </InventoryForm>
        </section>
      </details>
    </InventoryShell>
  );
}
