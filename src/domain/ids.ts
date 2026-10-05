// Generación de IDs. Usa crypto.randomUUID() (disponible de forma nativa en
// Node >=14.17 y en todos los navegadores modernos) para no depender de una
// librería externa como nanoid solo para esto.

export function createId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
