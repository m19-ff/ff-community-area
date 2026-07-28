import { NextResponse } from 'next/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function GET() {
  return NextResponse.json(
    { success: true, status: 'ok', timestamp: new Date().toISOString() },
    { headers: corsHeaders }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders })
}
