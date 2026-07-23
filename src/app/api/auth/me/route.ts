import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { KEYGEN_BASE_URL, getAccountPathPrefix, fetchKeygen } from '@/lib/server/keygen-fetch'

// Server-side /me endpoint that reads the token from the httpOnly cookie
// and proxies the request to the Keygen API, so the token never touches the client.
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('keygen_session')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  try {
    const targetUrl = `${KEYGEN_BASE_URL}/v1${getAccountPathPrefix()}/me`
    const response = await fetchKeygen(targetUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.api+json',
      },
    })

    const data = await response.text()
    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach API' },
      { status: 502 }
    )
  }
}
