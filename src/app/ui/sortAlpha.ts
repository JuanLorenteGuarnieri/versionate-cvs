/**
 * Orden alfabético (localizado, insensible a mayúsculas/acentos) para
 * cualquier lista de "versiones" que se le muestre al usuario — variantes
 * de un elemento, versiones de un CV... Petición explícita: "cuando
 * aparece una lista de versiones, siempre salgan ordenadas
 * alfabéticamente", en vez del orden de creación/inserción que tenían
 * antes. No muta el array de entrada.
 */
export function sortAlpha<T>(items: readonly T[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => getName(a).localeCompare(getName(b), undefined, { sensitivity: "base" }));
}
