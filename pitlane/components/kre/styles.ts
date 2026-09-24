import styles from "./kre.module.css";
export function cx(names: string) {
  return names
    .split(/\s+/)
    .map((name) => styles[name] ?? name)
    .join(" ");
}
