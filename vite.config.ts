import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cloudflare } from "@cloudflare/vite-plugin"
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		cloudflare(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.ico', '256x256.png', '512x512.png', '766x766.png'],
			manifest: {
				name: 'JaNote',
				short_name: 'JaNote',
				description: 'Just a Note',
				theme_color: '#ffffff',
				background_color: '#ffffff',
				display: 'standalone',
				icons: [
					{
						src: '/256x256.png',
						sizes: '256x256',
						type: 'image/png'
					},
					{
						src: '/512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			}
		})
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	server: {
		host: '0.0.0.0',
		port: 5173,
		// Docker volume needs polling to detect file changes reliably.
		watch: {
			usePolling: true
		},
		// Support HMR from the host browser.
		hmr: {
			host: 'localhost',
			port: 5173,
			clientPort: 5173
		}
	}
})
