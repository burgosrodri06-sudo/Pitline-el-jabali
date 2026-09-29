import type { Metadata } from "next";
import styles from "./mockup.module.css";

// Design mockup only: every value below is invented sample data. Nothing here
// reads the catalog, the database, or booking logic.
export const metadata: Metadata = {
  title: "Mockup · PitLane El Jabalí",
  description: "Mockup visual de la landing de PitLane con datos de ejemplo.",
  robots: { index: false, follow: false },
};

const next = {
  session: "Tanda libre",
  date: "Viernes 9 de octubre",
  time: "7:30 p. m.",
  duration: "10 min",
  seats: 6,
  capacity: 10,
  price: "$15.00",
  priceUnit: "por kart",
};

const schedule = [
  { time: "7:30 p. m.", session: "Tanda libre", seats: 6, capacity: 10, price: "$15.00", unit: "por kart", next: true },
  { time: "8:00 p. m.", session: "Tanda grupal · hasta 5 karts", seats: 5, capacity: 10, price: "$60.00", unit: "por grupo" },
  { time: "8:30 p. m.", session: "Tanda libre", seats: 0, capacity: 10, price: "$15.00", unit: "por kart" },
  { time: "9:00 p. m.", session: "Tanda larga · 15 min", seats: 3, capacity: 10, price: "$20.00", unit: "por kart" },
  { time: "9:30 p. m.", session: "Tanda libre", seats: 9, capacity: 10, price: "$15.00", unit: "por kart" },
  { time: "10:00 p. m.", session: "Tanda libre", seats: 10, capacity: 10, price: "$15.00", unit: "por kart" },
];

const steps = [
  {
    title: "Elige tu horario",
    body: "Revisa los horarios del día y los karts libres en cada tanda.",
  },
  {
    title: "Completa tus datos",
    body: "Registra a cada piloto y acepta el descargo de responsabilidad.",
  },
  {
    title: "Llega 20 minutos antes",
    body: "Recibe tu equipo y la charla de seguridad antes de salir a pista.",
  },
];

// Monospace only for the digits ("7:30"), not the "p. m." suffix.
function clockTime(time: string) {
  const [clock, ...suffix] = time.split(" ");
  return (
    <>
      <span className={styles.num}>{clock}</span> {suffix.join(" ")}
    </>
  );
}

export default function MockupPage() {
  return (
    <div className={styles.root} lang="es-SV">
      <a className={styles.skip} href="#contenido">
        Saltar al contenido
      </a>
      <p className={styles.banner}>
        Mockup de diseño · Datos de ejemplo. El botón no realiza reservas.
      </p>
      <header className={styles.header}>
        <span className={styles.brand}>
          Pitlane <small>El Jabalí · Karting</small>
        </span>
      </header>
      <main id="contenido" className={styles.layout}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Autódromo Internacional El Jabalí</p>
          <h1>Karting nocturno en El Jabalí</h1>
        </div>

        <section className={styles.panel} aria-labelledby="proxima">
          <h2 id="proxima" className={styles.eyebrow}>
            Próxima sesión
          </h2>
          <h3 className={styles.session}>{next.session}</h3>
          <dl className={styles.facts}>
            <div className={styles.factWide}>
              <dt>Fecha</dt>
              <dd>{next.date}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{clockTime(next.time)}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd className={styles.num}>{next.duration}</dd>
            </div>
            <div>
              <dt>Karts libres</dt>
              <dd>
                <span className={styles.num}>{next.seats}</span> de{" "}
                <span className={styles.num}>{next.capacity}</span>
              </dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>
                <span className={`${styles.num} ${styles.price}`}>
                  {next.price}
                </span>{" "}
                <span className={styles.unit}>{next.priceUnit}</span>
              </dd>
            </div>
          </dl>
          <button type="button" className={styles.cta}>
            Reservar esta sesión
          </button>
          <p className={styles.help}>
            Revisarás los datos antes de confirmar. Hora de El Salvador
            (UTC−6).
          </p>
        </section>

        <section className={styles.schedule} aria-labelledby="horarios">
          <div className={styles.sectionHead}>
            <h2 id="horarios">Horarios del día</h2>
            <p>{next.date}</p>
          </div>
          <ul className={styles.rows}>
            {schedule.map((row) => (
              <li
                key={row.time}
                className={`${styles.row} ${row.next ? styles.rowNext : ""} ${row.seats === 0 ? styles.rowFull : ""}`}
              >
                <span className={styles.time}>{clockTime(row.time)}</span>
                <span className={styles.rowSession}>
                  {row.session}
                  {row.next && (
                    <span className={styles.tag}>Próxima</span>
                  )}
                </span>
                <span className={styles.rowSeats}>
                  {row.seats === 0 ? (
                    "Sin karts libres"
                  ) : (
                    <>
                      <span className={styles.num}>{row.seats}</span> de{" "}
                      <span className={styles.num}>{row.capacity}</span> karts
                      libres
                    </>
                  )}
                </span>
                <span className={styles.rowPrice}>
                  <span className={styles.num}>{row.price}</span>
                  <span className={styles.unit}>{row.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.how} aria-labelledby="como">
          <h2 id="como">Cómo funciona</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.policy} aria-labelledby="cancelacion">
          <h2 id="cancelacion">Política de cancelación</h2>
          <p>
            Puedes cancelar sin costo hasta 24 horas antes de tu tanda. Con
            menos de 24 horas puedes reprogramar una vez a otra fecha
            disponible. Si la pista se cierra por lluvia, reprogramamos o
            reembolsamos el total.
          </p>
          <p className={styles.sample}>Texto de ejemplo para el mockup.</p>
        </section>
      </main>
      <footer className={styles.footer}>
        Mockup de diseño · PitLane El Jabalí
      </footer>
    </div>
  );
}
