/**
 * Mueve el elemento en `fromIndex` hasta `toIndex`, sin mutar el array
 * original. Es la lógica pura detrás de "soltar" un drag-and-drop — dnd-kit
 * solo nos da los ids de origen/destino; convertir eso en el nuevo orden es
 * esto, y es justo la parte que sí se puede testear sin un navegador.
 */
export function moveItem<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= list.length) return [...list];
  const clampedTo = Math.max(0, Math.min(toIndex, list.length - 1));
  if (fromIndex === clampedTo) return [...list];

  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(clampedTo, 0, moved as T);
  return copy;
}
