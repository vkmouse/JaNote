export const onRequest: PagesFunction = async (context) => {
  const db = context.env.DB;
  const result = await db.prepare("SELECT datetime('now') as current_time").first();
  return new Response(JSON.stringify({ current_time: result.current_time }), {
    headers: { "content-type": "application/json" }
  });
}