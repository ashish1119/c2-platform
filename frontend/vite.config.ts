import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const reactPackages = ["/react/", "/react-dom/", "/react-router-dom/", "/scheduler/"];
const mapPackages = ["/leaflet/", "/react-leaflet/", "/leaflet-draw/"];
const rechartsPackages = ["/recharts/"];
const chartCorePackages = ["/victory-vendor/", "/d3-", "/internmap/"];
const pdfPackages = ["/jspdf/", "/jspdf-autotable/"];
const canvasExportPackages = ["/html2canvas/"];

function matchesAnyPackage(id: string, packages: string[]) {
  return packages.some((packageName) => id.includes(packageName));
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (matchesAnyPackage(id, reactPackages)) {
            return "react-vendor";
          }
          if (matchesAnyPackage(id, mapPackages)) {
            return "map-vendor";
          }
          if (matchesAnyPackage(id, rechartsPackages)) {
            return "recharts-vendor";
          }
          if (matchesAnyPackage(id, chartCorePackages)) {
            return "chart-core-vendor";
          }
          if (matchesAnyPackage(id, pdfPackages)) {
            return "pdf-vendor";
          }
          if (matchesAnyPackage(id, canvasExportPackages)) {
            return "canvas-export-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});