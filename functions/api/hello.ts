export const onRequest: PagesFunction = async (context) => {
  return new Response(JSON.stringify({ message: "Hello from API" }), {
    headers: { "content-type": "application/json" }
  });
}