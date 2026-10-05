import { useSyncExternalStore } from "react";
import type { AppStore, AppStoreState } from "../state/appStore.js";

/**
 * Envoltura fina de React sobre `AppStore`. Toda la lógica real vive en
 * `appStore.ts` (framework-agnostic y con tests reales); esto solo conecta
 * ese store a `useSyncExternalStore`, el mecanismo estándar de React para
 * suscribirse a estado externo — es literalmente lo que hace `zustand` por
 * dentro para su propio hook, así que este archivo es intencionadamente
 * "aburrido": no debería tener casi nada que pueda salir mal.
 */
export function useAppStore(store: AppStore): AppStoreState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
