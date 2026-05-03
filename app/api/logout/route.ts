export async function POST(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': 'aeo_auth=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
    },
  });
}
