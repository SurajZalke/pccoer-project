// vite.config.ts
import { defineConfig } from "file:///C:/Users/suraj/OneDrive/Desktop/mspcollage-advance/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/suraj/OneDrive/Desktop/mspcollage-advance/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { componentTagger } from "file:///C:/Users/suraj/OneDrive/Desktop/mspcollage-advance/node_modules/lovable-tagger/dist/index.js";
import Pages from "file:///C:/Users/suraj/OneDrive/Desktop/mspcollage-advance/node_modules/vite-plugin-pages/dist/index.js";
import Sitemap from "file:///C:/Users/suraj/OneDrive/Desktop/mspcollage-advance/node_modules/vite-plugin-pages-sitemap/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\suraj\\OneDrive\\Desktop\\mspcollage-advance";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  build: {
    chunkSizeWarningLimit: 1e4
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    Pages({
      onRoutesGenerated: (routes) => Sitemap({
        routes,
        hostname: "https://mspcollage-advance.netlify.app"
        // your base URL
      })
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzdXJhalxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXG1zcGNvbGxhZ2UtYWR2YW5jZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcc3VyYWpcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxtc3Bjb2xsYWdlLWFkdmFuY2VcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3N1cmFqL09uZURyaXZlL0Rlc2t0b3AvbXNwY29sbGFnZS1hZHZhbmNlL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcbmltcG9ydCBQYWdlcyBmcm9tICd2aXRlLXBsdWdpbi1wYWdlcydcclxuaW1wb3J0IFNpdGVtYXAgZnJvbSAndml0ZS1wbHVnaW4tcGFnZXMtc2l0ZW1hcCdcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMDAsXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbW9kZSA9PT0gJ2RldmVsb3BtZW50JyAmJlxyXG4gICAgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgICBQYWdlcyh7XHJcbiAgICAgIG9uUm91dGVzR2VuZXJhdGVkOiAocm91dGVzKSA9PlxyXG4gICAgICAgIFNpdGVtYXAoe1xyXG4gICAgICAgICAgcm91dGVzLFxyXG4gICAgICAgICAgaG9zdG5hbWU6ICdodHRwczovL21zcGNvbGxhZ2UtYWR2YW5jZS5uZXRsaWZ5LmFwcCcsIC8vIHlvdXIgYmFzZSBVUkxcclxuICAgICAgICB9KSxcclxuICAgIH0pLFxyXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9WLFNBQVMsb0JBQW9CO0FBQ2pYLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sYUFBYTtBQUxwQixJQUFNLG1DQUFtQztBQVF6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxFQUN6QjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFDVCxnQkFBZ0I7QUFBQSxJQUNoQixNQUFNO0FBQUEsTUFDSixtQkFBbUIsQ0FBQyxXQUNsQixRQUFRO0FBQUEsUUFDTjtBQUFBLFFBQ0EsVUFBVTtBQUFBO0FBQUEsTUFDWixDQUFDO0FBQUEsSUFDTCxDQUFDO0FBQUEsRUFDSCxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
