import axios from 'axios';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', null, {
      params: {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      },
    });
    // For demo: return the token JSON
    return new Response(JSON.stringify(response.data, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
