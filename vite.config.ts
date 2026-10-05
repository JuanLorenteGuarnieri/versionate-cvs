import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Base relativa: facilita servir la app tanto desde un servidor estático
  // local en la raíz como desde un subpath de GitHub Pages sin tocar nada
  // (ARCHITECTURE.md §14 y §24).
  base: "./",
});
