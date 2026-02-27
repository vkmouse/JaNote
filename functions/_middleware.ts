import type { AuthContext, Env } from './types';
import { jwtVerify, createRemoteJWKSet } from "jose";

async function verifyCloudflareAccessToken(token: string, env: Env): Promise<string | null> {
	// Check if environment variables are configured
	if (!env.POLICY_AUD || !env.TEAM_DOMAIN) {
		return null;
	}

	try {
		// Create JWKS from your team domain
		const JWKS = createRemoteJWKSet(
			new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`)
		);

		// Verify the JWT
		const { payload } = await jwtVerify(token, JWKS, {
			issuer: env.TEAM_DOMAIN,
			audience: env.POLICY_AUD,
		});

		// Return email from verified token
		return (payload.email as string) || null;
	} catch {
		return null;
	}
}

export const onRequest: PagesFunction<Env, any, AuthContext> = async (context) => {
	// Get email from Cloudflare Access JWT or fallback to demo
	let email = 'demo@example.com';
	
	const jwtHeader = context.request.headers.get('Cf-Access-Jwt-Assertion');
	if (jwtHeader) {
		const verifiedEmail = await verifyCloudflareAccessToken(jwtHeader, context.env);
		if (verifiedEmail) {
			email = verifiedEmail;
		}
	}
	
	// Add email to context for downstream handlers
	context.data.email = email;
	
	// Continue to the next handler
	return await context.next();
};
