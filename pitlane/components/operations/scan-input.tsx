"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import styles from "./operations.module.css";
export function ScanInput() {
  const [code, setCode] = useState("");
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    async function start() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (disposed || !video.current) return;
        const reader = new BrowserQRCodeReader();
        const scan = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          video.current,
          (result, _error, control) => {
            if (result && !disposed) {
              setCode(result.getText());
              control.stop();
              setActive(false);
            }
          },
        );
        if (disposed) scan.stop();
        else controls.current = scan;
      } catch {
        if (!disposed) {
          setError(
            "No se pudo abrir la cámara. Permite el acceso o ingresa el código manualmente.",
          );
          setActive(false);
        }
      }
    }
    void start();
    return () => {
      disposed = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [active]);
  return (
    <>
      <label className={styles.label}>
        Código de reserva o QR
        <input
          className={styles.input}
          name="lookup"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={100}
          required
          autoComplete="off"
          placeholder="KRE-…"
        />
      </label>
      <button
        type="button"
        className={`${styles.button} ${styles.secondary}`}
        onClick={() => {
          setError("");
          setActive(!active);
        }}
      >
        {active ? "Cerrar cámara" : "Escanear QR con cámara"}
      </button>
      {active && (
        <video
          className={styles.video}
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Vista de cámara para leer QR"
        />
      )}
      {code && (
        <p className={styles.muted}>
          Verifica la tanda seleccionada antes de registrar la entrada.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}
