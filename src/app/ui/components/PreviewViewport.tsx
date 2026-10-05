import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.15;
const VIEWPORT_PADDING_PX = 24; // margen alrededor de la página para que no toque los bordes del visor

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Envoltorio "de visor" para la preview del CV / template.
 *
 * Sin esto, la preview crecía con su propio contenido (una página A4 mide
 * ~297mm de alto SIEMPRE, sin encogerse proporcionalmente aunque el panel
 * fuera más estrecho que 210mm de ancho — el `width` sí se adaptaba vía
 * `max-width:100%` pero el `min-height:297mm` no, así que la página salía
 * desproporcionadamente alta) y había que hacer scroll por TODA la página
 * para verla entera.
 *
 * Este componente:
 *  - ocupa el 100% del alto y ancho que le da su contenedor (CVComposer /
 *    TemplateEditor le reservan exactamente "alto de ventana menos alto
 *    del header" vía flexbox + aspect-ratio, ver styles.css) mientras el
 *    formulario de la izquierda scrollea por su cuenta — este componente ya
 *    no necesita sticky/tamaños en vh propios, solo llenar su contenedor.
 *  - por defecto ajusta el zoom para que la altura de UNA página (no de
 *    todas las páginas apiladas, si el CV ocupa varias) quepa entera en ese
 *    espacio ("ajustar a la ventana").
 *  - permite zoom manual con Ctrl/Cmd + "+" / "-", con Ctrl/Cmd + rueda del
 *    ratón (Ctrl/Cmd+0 para volver al ajuste automático), y también con los
 *    botones +/- por si acaso.
 *  - el scroll dentro del visor (rueda del ratón, SIN Ctrl/Cmd) es scroll
 *    nativo del propio contenedor — el navegador ya dirige la rueda al
 *    elemento que tiene el cursor encima, así que esto ya queda
 *    "independiente" del scroll de la página sin tener que interceptar el
 *    evento a mano.
 *
 * Importante: el `transform: scale()` que aplica este componente es solo
 * para la pantalla. Se resetea explícitamente en `@media print` (ver
 * styles.css) para que el PDF exportado salga siempre a tamaño real,
 * pase lo que pase con el zoom que tuvieras puesto en ese momento.
 */
export function PreviewViewport({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0, firstPageHeight: 0 });
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mide el tamaño NATURAL (sin escalar) del contenido de la preview.
  //
  // IMPORTANTE: dependencias vacías a propósito — este efecto se monta UNA
  // vez y deja el ResizeObserver escuchando indefinidamente sobre el mismo
  // div estable (measureRef no cambia de identidad aunque `children`
  // cambie). Con dependencias vacías es obligatorio además comparar antes
  // de llamar a setNaturalSize: sin esa comprobación, cada disparo del
  // ResizeObserver (incluida la llamada inicial) crea un objeto nuevo
  // aunque los números sean iguales, lo cual re-renderiza, lo cual el
  // propio re-render podría volver a disparar el observer indirectamente —
  // en una versión anterior esto directamente NO tenía array de
  // dependencias (se ejecutaba en cada render), lo que producía un bucle
  // infinito real que dejaba toda la pantalla en blanco (React aborta el
  // árbol entero al detectar demasiados renders seguidos, y al no haber
  // ningún error boundary desmonta la app completa, no solo este panel).
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.scrollWidth;
      const height = el.scrollHeight;
      // El "ajuste a la ventana" por defecto debe mostrar UNA página
      // entera, no encoger hasta que quepan TODAS las páginas apiladas —
      // con un CV de 2+ páginas, `height` es la suma de todas ellas, así
      // que ajustar a eso daba un zoom minúsculo que no dejaba ver bien ni
      // la primera. `.cv-preview__page` es la clase que usa CVPreview.tsx
      // para cada hoja A4 individual (acoplamiento consciente y ya
      // existente en otros puntos de este componente/styles.css, ver el
      // print media query) — si no se encuentra (contenido sin páginas),
      // se cae de vuelta al alto total.
      const firstPage = el.querySelector<HTMLElement>(".cv-preview__page");
      const firstPageHeight = firstPage ? firstPage.offsetHeight : height;
      setNaturalSize((prev) =>
        prev.width === width && prev.height === height && prev.firstPageHeight === firstPageHeight
          ? prev
          : { width, height, firstPageHeight }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const recomputeFit = useCallback(() => {
    const scrollEl = scrollRef.current;
    const fitHeight = naturalSize.firstPageHeight || naturalSize.height;
    if (!scrollEl || fitHeight <= 0 || naturalSize.width <= 0) return;
    const availableHeight = scrollEl.clientHeight - VIEWPORT_PADDING_PX * 2;
    const availableWidth = scrollEl.clientWidth - VIEWPORT_PADDING_PX * 2;
    // "Contain": el marco del visor ahora ocupa el ancho de toda su columna
    // (ver .preview-viewport en styles.css), que puede ser más ancho O más
    // estrecho que lo que pediría ajustar solo por altura — antes el marco
    // tenía un ancho derivado de su alto (aspect-ratio), así que ajustar
    // solo por altura bastaba (el ancho siempre sobraba, por construcción).
    // Ahora hay que respetar los dos límites a la vez, quedándose con el
    // más restrictivo, o la página se saldría por un lado o sobraría mucho
    // hueco por el otro según la proporción de la ventana.
    const zoomToFitHeight = availableHeight / fitHeight;
    const zoomToFitWidth = availableWidth / naturalSize.width;
    setZoom(clamp(Math.min(zoomToFitHeight, zoomToFitWidth), MIN_ZOOM, MAX_ZOOM));
  }, [naturalSize.firstPageHeight, naturalSize.height, naturalSize.width]);

  useLayoutEffect(() => {
    if (autoFit) recomputeFit();
  }, [autoFit, recomputeFit]);

  // Al entrar/salir de pantalla completa, el visor cambia de tamaño de golpe
  // sin que se dispare un evento "resize" de window (el tamaño de la
  // VENTANA no cambia, solo el de este contenedor) — hay que recalcular el
  // ajuste a mano. Si el usuario tenía puesto un zoom manual, se respeta
  // (no se fuerza autoFit aquí, igual que con el resize de la ventana).
  useLayoutEffect(() => {
    if (autoFit) recomputeFit();
  }, [isFullscreen, autoFit, recomputeFit]);

  useEffect(() => {
    if (!autoFit) return;
    window.addEventListener("resize", recomputeFit);
    return () => window.removeEventListener("resize", recomputeFit);
  }, [autoFit, recomputeFit]);

  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), []);

  // Petición explícita: un botón "X" para volver atrás desde pantalla
  // completa — además, Escape hace lo mismo (patrón estándar en cualquier
  // vista de pantalla completa, incluida la nativa del navegador).
  useEffect(() => {
    if (!isFullscreen) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [isFullscreen]);

  const zoomBy = useCallback((factor: number) => {
    setAutoFit(false);
    setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const resetZoom = useCallback(() => setAutoFit(true), []);

  // Zoom anclado a un punto de la PANTALLA (coordenadas de cliente): el
  // punto del contenido que había justo ahí antes del zoom se queda justo
  // ahí después — petición explícita ("que se haga zoom a donde se apunta
  // con el ratón, no a la parte de arriba a la izquierda de lo que se
  // ve"). Antes, cualquier cambio de zoom dejaba fija la esquina superior
  // izquierda del contenido VISIBLE (consecuencia de que el `scale()` se
  // aplica con `transform-origin: top left` sobre TODO el stage, no solo
  // sobre la parte visible — ver esa nota en styles.css) y todo lo demás se
  // desplazaba desde ahí, en vez de desde donde estuviera mirando el
  // usuario.
  //
  // Funciona en dos pasos porque el punto de anclaje se calcula con el
  // zoom ANTIGUO (antes de que React vuelva a renderizar con el zoom
  // nuevo) pero el ajuste de scroll solo puede aplicarse una vez el DOM ya
  // tiene el tamaño NUEVO (para saber cuánto hay que desplazar) — de ahí el
  // ref con el punto pendiente + el `useLayoutEffect` de más abajo, que se
  // dispara síncronamente antes de que el navegador pinte el frame nuevo
  // (sin ese "antes de pintar", se vería un parpadeo del zoom saltando al
  // sitio viejo y luego corrigiéndose).
  const pendingZoomAnchorRef = useRef<{ clientX: number; clientY: number; naturalX: number; naturalY: number } | null>(
    null
  );

  const zoomTowardPoint = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const stageEl = measureRef.current;
      if (!stageEl) {
        zoomBy(factor);
        return;
      }
      const stageRect = stageEl.getBoundingClientRect();
      // Coordenadas del punto señalado dentro del contenido SIN escalar
      // (dividiendo por el zoom actual, antes de cambiarlo).
      const naturalX = (clientX - stageRect.left) / zoom;
      const naturalY = (clientY - stageRect.top) / zoom;
      pendingZoomAnchorRef.current = { clientX, clientY, naturalX, naturalY };
      setAutoFit(false);
      setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
    },
    [zoom, zoomBy]
  );

  // Aplica el ajuste de scroll pendiente (ver zoomTowardPoint) justo
  // después de que el zoom nuevo ya se haya pintado en el DOM.
  useLayoutEffect(() => {
    const pending = pendingZoomAnchorRef.current;
    pendingZoomAnchorRef.current = null;
    const stageEl = measureRef.current;
    const scrollEl = scrollRef.current;
    if (!pending || !stageEl || !scrollEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    // Dónde ha quedado ahora (con el zoom nuevo, pero el scroll todavía
    // viejo) el mismo punto del contenido que se señaló.
    const currentScreenX = stageRect.left + pending.naturalX * zoom;
    const currentScreenY = stageRect.top + pending.naturalY * zoom;
    // Cuánto hay que mover el scroll para que ese punto vuelva a caer justo
    // donde estaba el ratón.
    scrollEl.scrollLeft += currentScreenX - pending.clientX;
    scrollEl.scrollTop += currentScreenY - pending.clientY;
  }, [zoom]);

  // Punto de anclaje para el zoom con botones/atajos de teclado (sin
  // posición de ratón asociada): el centro de lo que se ve ahora mismo en
  // el visor, en vez de top-left — mismo criterio que con la rueda, solo
  // que aquí no hay un puntero que mirar.
  const zoomTowardViewportCenter = useCallback(
    (factor: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) {
        zoomBy(factor);
        return;
      }
      const rect = scrollEl.getBoundingClientRect();
      zoomTowardPoint(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomBy, zoomTowardPoint]
  );

  // Ctrl/Cmd + "+"/"-" hacen zoom de la preview en vez del zoom nativo de
  // la pestaña del navegador, mientras este visor esté montado en pantalla
  // (§ petición: "controles iguales que una pestaña del navegador pero de
  // forma independiente a la propia pestaña").
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomTowardViewportCenter(ZOOM_STEP);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomTowardViewportCenter(1 / ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [zoomTowardViewportCenter, resetZoom]);

  // Ctrl/Cmd + rueda del ratón también hace zoom del visor (además de
  // Ctrl+"+"/"-" de arriba), igual que el zoom nativo del navegador pero
  // sin afectar a la pestaña entera. Se engancha "a mano" con
  // addEventListener en vez de con la prop onWheel de React: el evento
  // necesita poder cancelarse (preventDefault) para que el navegador no
  // haga SU zoom de página nativo a la vez, y como esto solo debe pasar
  // con Ctrl/Cmd pulsado, no se puede registrar el listener como pasivo.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomTowardPoint(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, e.clientX, e.clientY);
    }
    scrollEl.addEventListener("wheel", onWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", onWheel);
  }, [zoomTowardPoint]);

  const scaledWidth = naturalSize.width * zoom;
  const scaledHeight = naturalSize.height * zoom;

  return (
    <div className={`preview-viewport${isFullscreen ? " preview-viewport--fullscreen" : ""}`}>
      <div className="preview-viewport__toolbar">
        <button
          type="button"
          className="preview-viewport__fullscreen-button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
        >
          {isFullscreen ? "✕" : "⛶"}
        </button>
        <div className="preview-viewport__zoom-controls">
          <button
            type="button"
            className="preview-viewport__zoom-button"
            onClick={() => zoomTowardViewportCenter(1 / ZOOM_STEP)}
            title="Alejar (Ctrl −)"
          >
            −
          </button>
          <button type="button" className="preview-viewport__zoom-level" onClick={resetZoom} title="Ajustar a la ventana (Ctrl 0)">
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="preview-viewport__zoom-button"
            onClick={() => zoomTowardViewportCenter(ZOOM_STEP)}
            title="Acercar (Ctrl +)"
          >
            +
          </button>
        </div>
      </div>
      <div className="preview-viewport__scroll" ref={scrollRef}>
        <div className="preview-viewport__sizer" style={{ width: scaledWidth || undefined, height: scaledHeight || undefined }}>
          <div className="preview-viewport__stage" ref={measureRef} style={{ transform: `scale(${zoom})` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
