interface Env {
	ASSETS?: Fetcher;
}

const DEV_PROXY_ORIGIN = 'http://127.0.0.1:5173';

const isHtmlRequest = (request: Request): boolean => {
	const accept = request.headers.get('accept') ?? '';
	return accept.includes('text/html');
};

export default {
	async fetch(request, env) {
		if (!env?.ASSETS) {
			const url = new URL(request.url);
			url.protocol = 'http:';
			url.host = DEV_PROXY_ORIGIN.replace('http://', '');
			return fetch(new Request(url.toString(), request));
		}

		const response = await env.ASSETS.fetch(request);
		if (response.status !== 404) {
			return response;
		}
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return response;
		}
		if (!isHtmlRequest(request)) {
			return response;
		}

		const url = new URL(request.url);
		url.pathname = '/index.html';
		return env.ASSETS.fetch(new Request(url.toString(), request));
	},
} satisfies ExportedHandler<Env>;
