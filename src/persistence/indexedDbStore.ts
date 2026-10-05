import type { AppDatabase } from "../domain/model/types.js";
import { migrateRawDatabase } from "./migrations.js";
import type { Store } from "./store.js";

// NOTA IMPORTANTE (ver README.md "Verificación manual de IndexedDbStore"):
// Este fichero solo puede ejecutarse de verdad dentro de un navegador (usa el
// objeto global `indexedDB`, que no existe en Node). Los tests automáticos de
// este proyecto NO pueden cubrirlo directamente por eso — sí cubren, con
// `MemoryStore`, todo lo que consume un `Store` (autosave, etc.), y por
// separado cubren toda la lógica de validación/migración que usa este
// fichero (`migrations.ts`), que es donde vive la parte con más riesgo de
// bugs. Lo que queda sin cubrir automáticamente es "pura mecánica de
// IndexedDB" (abrir la conexión, transacciones, get/put), que es la parte
// más estable y menos propensa a bugs sutiles.

const DB_NAME = "versionate-cvs";
const DB_VERSION = 1;
const STORE_NAME = "app-database";
const RECORD_KEY = "singleton";

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onblocked = () =>
      reject(new Error("IndexedDB bloqueado: hay otra pestaña con una versión anterior abierta."));
  });
}

/**
 * Store real de la aplicación. Guarda toda la AppDatabase como un único
 * registro (ARCHITECTURE.md §13): la app siempre carga todo en memoria de
 * todas formas, así que no hay ninguna ventaja en trocearlo en varias
 * "tablas" de IndexedDB, y sí una complejidad de migración innecesaria.
 */
export function createIndexedDbStore(): Store {
  return {
    async load(): Promise<AppDatabase | null> {
      if (!isIndexedDbAvailable()) {
        throw new Error(
          "IndexedDB no está disponible en este entorno. Consulta ARCHITECTURE.md §14: " +
            "esta app debe ejecutarse desde un servidor local estático, no abriendo el HTML con file://."
        );
      }
      const db = await openConnection();
      try {
        const raw = await new Promise<unknown>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error ?? new Error("Fallo al leer de IndexedDB"));
        });
        if (raw === undefined) return null;
        return migrateRawDatabase(raw);
      } finally {
        db.close();
      }
    },

    async save(database: AppDatabase): Promise<void> {
      if (!isIndexedDbAvailable()) {
        throw new Error("IndexedDB no está disponible en este entorno.");
      }
      const db = await openConnection();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(database, RECORD_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("Fallo al escribir en IndexedDB"));
          tx.onabort = () => reject(tx.error ?? new Error("Transacción abortada al escribir en IndexedDB"));
        });
      } finally {
        db.close();
      }
    },

    async clear(): Promise<void> {
      if (!isIndexedDbAvailable()) {
        throw new Error("IndexedDB no está disponible en este entorno.");
      }
      const db = await openConnection();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).delete(RECORD_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("Fallo al borrar en IndexedDB"));
        });
      } finally {
        db.close();
      }
    },
  };
}
