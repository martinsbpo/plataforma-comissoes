import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { tenantId } = await request.json()

  const response = NextResponse.json({ ok: true })
  response.cookies.set('tenant_id', tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  })

  return response
}
