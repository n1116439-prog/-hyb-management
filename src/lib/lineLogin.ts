const LINE_CLIENT_ID = import.meta.env.VITE_LINE_CLIENT_ID || ''
const LINE_CLIENT_SECRET = import.meta.env.VITE_LINE_CLIENT_SECRET || ''
const LINE_CALLBACK_URL = import.meta.env.VITE_LINE_CALLBACK_URL || ''

// 產生 LINE 授權 URL
export function getLineLoginUrl(): string {
  const state = crypto.randomUUID()
  localStorage.setItem('line_state', state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CLIENT_ID,
    redirect_uri: LINE_CALLBACK_URL,
    state,
    scope: 'profile openid',
  })
  return 'https://access.line.me/oauth2/v2.1/authorize?' + params.toString()
}

// 用 code 換 token
export async function exchangeLineToken(code: string): Promise<{ access_token: string; id_token: string }> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINE_CALLBACK_URL,
      client_id: LINE_CLIENT_ID,
      client_secret: LINE_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error('LINE token exchange failed')
  return res.json()
}

// 用 token 取得 profile
export async function getLineProfile(accessToken: string): Promise<{ userId: string; displayName: string; pictureUrl?: string }> {
  const res = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: 'Bearer ' + accessToken },
  })
  if (!res.ok) throw new Error('LINE profile fetch failed')
  return res.json()
}
