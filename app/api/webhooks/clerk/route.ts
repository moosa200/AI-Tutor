import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/db'

interface ClerkEmailAddress {
  email_address: string
  id: string
}

interface ClerkUserEvent {
  data: {
    id: string
    email_addresses: ClerkEmailAddress[]
    primary_email_address_id: string
    first_name: string | null
    last_name: string | null
    image_url: string | null
  }
  type: string
}

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET env var')
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    )
  }

  // Verify the webhook signature
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    )
  }

  const body = await req.text()

  let event: ClerkUserEvent
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event

  try {
    if (type === 'user.created' || type === 'user.updated') {
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      )
      const email = primaryEmail?.email_address ?? `${data.id}@placeholder.com`
      const name = [data.first_name, data.last_name]
        .filter(Boolean)
        .join(' ') || null

      await prisma.user.upsert({
        where: { clerkId: data.id },
        create: {
          clerkId: data.id,
          email,
          name,
          imageUrl: data.image_url,
        },
        update: {
          email,
          name,
          imageUrl: data.image_url,
        },
      })

      console.log(`Clerk webhook: ${type} — ${email}`)
    }

    if (type === 'user.deleted') {
      await prisma.user.deleteMany({
        where: { clerkId: data.id },
      })
      console.log(`Clerk webhook: user.deleted — ${data.id}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
