import { useLayoutEffect, useRef, useState } from "react";

const A4_RATIO = 210 / 297;

/**
 * Deriva el ancho de un elemento EXCLUSIVAMENTE de su propio alto (fórmula
 * A4 por defecto: ancho = alto * 210/297), sin depender en ningún momento
 * del ancho que le quede libre en el contenedor.
 *
 * Petición explícita del usuario / bug real reportado: "el espacio que
 * ocupa el marco del preview se adapta de alguna forma al ancho de la
 * sección izquierda [...] no quiero que sea así". La propiedad CSS
 * `aspect-ratio` ya se probó (sesión 5) y en teoría debería bastar dentro
 * de un flex row, pero su resolución de flex-basis en ese contexto depende
 * de heurísticas del navegador que en la práctica seguían dejando que el
 * ancho disponible influyera en el resultado. Medir el alto ya renderizado
 * (que SÍ es puramente estructural — 100% del alto del panel, fijado por
 * flexbox en columna, nunca depende del ancho) y aplicar el ancho como
 * estilo inline elimina cualquier ambigüedad: el ancho es una función pura
 * del alto, sin intervención del motor de layout del navegador de por
 * medio.
 *
 * Devuelve un ref para el elemento a medir/dimensionar y el ancho en px ya
 * calculado (`undefined` mientras no se ha medido todavía, p.ej. en el
 * primer render antes de que exista un nodo del DOM).
 */
export function useHeightDerivedWidth<T extends HTMLElement>(ratio: number = A4_RATIO) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const height = el.getBoundingClientRect().height;
      if (height <= 0) return;
      const next = height * ratio;
      // Comparación antes de actualizar: el propio cambio de `width` que
      // provoca este efecto dispara de nuevo el ResizeObserver (cambia el
      // border-box del elemento aunque el ALTO no cambie), así que sin esta
      // guarda se entraría en un bucle de renders — mismo motivo/patrón que
      // ya se documenta en PreviewViewport.tsx para su propio
      // ResizeObserver.
      setWidth((prev) => (prev !== undefined && Math.abs(prev - next) < 0.5 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ratio]);

  return { ref, width };
}
