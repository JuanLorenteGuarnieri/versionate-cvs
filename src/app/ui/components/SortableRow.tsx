import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface DragHandleProps {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}

/**
 * Fila arrastrable genérica. El propio elemento visual se mueve entero al
 * arrastrar (`setNodeRef` en el contenedor), pero quién dispara el arrastre
 * (`attributes`/`listeners`) se pasa al hijo para poder ponerlo solo en un
 * icono de "agarre" (⠿) y no en toda la fila — así el resto de controles
 * (selects, botones) siguen siendo clicables normalmente.
 */
export function SortableRow({ id, children }: { id: string; children: (handle: DragHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-row">
      {children({ attributes, listeners })}
    </div>
  );
}
