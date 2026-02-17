import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		cloudflare()
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	server: {
		host: '0.0.0.0',
		port: 5173,
		// 支持 HMR（熱模組重載）
		hmr: {
			host: 'localhost',
			port: 5173
		}
	}
})
