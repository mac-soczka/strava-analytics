export async function GET(req) {
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.STRAVA_REDIRECT_URI)}&approval_prompt=auto&scope=read,activity:read`;
  return Response.redirect(stravaAuthUrl);
}
