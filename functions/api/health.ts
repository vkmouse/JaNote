import type { AuthContext } from '../_middleware';

interface Env {
	DB: D1Database;
}

export const onRequest: PagesFunction<Env, any, AuthContext> = async (context) => {
	const db = context.env.DB;
	const email = context.data.email;
	
	const result = await db.prepare("SELECT datetime('now') as current_time").first<{ current_time: string }>();
	
	return new Response(
		JSON.stringify({
			email,
			current_time: result?.current_time || null,
		}),
		{
			headers: { 'content-type': 'application/json' },
		}
	);
};