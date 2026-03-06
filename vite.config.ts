import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-[hash].js`,
          chunkFileNames: `assets/[name]-[hash].js`,
          assetFileNames: `assets/[name]-[hash].[ext]`
        }
      }
    },
    define: {
      // Force-inject AWS credentials as string literals so they survive the Capacitor build
      'import.meta.env.VITE_AWS_ACCESS_KEY_ID': JSON.stringify(env.VITE_AWS_ACCESS_KEY_ID),
      'import.meta.env.VITE_AWS_SECRET_ACCESS_KEY': JSON.stringify(env.VITE_AWS_SECRET_ACCESS_KEY),
    }
  };
});
