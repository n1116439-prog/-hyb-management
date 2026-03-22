const LINE_CLIENT_ID = import.meta.env.VITE_LINE_CLIENT_ID || ''
const LINE_CLIENT_SECRET = import.meta.env.VITE_LINE_CLIENT_SECRET || ''
const LINE_CALLBACK_URL = import.meta.env.VITE_LINE_CALLBACK_URL || ''

// 多重存儲 state（確保跨瀏覽器可用）
export function getLineLoginUrl(): string {
  const state = crypto.randomUUID()
  try { localStorage.setItem('line_state', state) } catch(e) {}
  try { sessionStorage.setItem('line_state', state) } catch(e) {}
  document.cookie = 'line_state=' + state + ';path=/;max-age=600;SameSite=Lax'

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CLIENT_ID,
    redirect_uri: LINE_CALLBACK_URL,
    state,
    scope: 'profile openid',
  })
  return 'https://access.line.me/oauth2/v2.1/authorize?' + params.toString()
}

// 依序嘗試讀取 state：localStorage → sessionStorage → cookie
export function getSavedLineState(): string | null {
  let state: string | null = null
  try { state = localStorage.getItem('line_state') } catch(e) {}
  if (!state) try { state = sessionStorage.getItem('line_state') } catch(e) {}
  if (!state) {
    const match = document.cookie.match(/line_state=([^;]+)/)
    if (match) state = match[1]
  }
  return state
}

// 清除所有存儲的 state
export function clearLineState(): void {
  try { localStorage.removeItem('line_state') } catch(e) {}
  try { sessionStorage.removeItem('line_state') } catch(e) {}
  document.cookie = 'line_state=;path=/;max-age=0'
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
