import { prisma } from '@/lib/db'

/**
 * Log an event (fire-and-forget — does not block the caller).
 */
export function logEvent(
  userId: string,
  type: string,
  metadata?: Record<string, any>
) {
  prisma.event
    .create({
      data: { userId, type, metadata: metadata ?? undefined },
    })
    .catch((err) => console.error('Event logging failed:', err))
}

/**
 * Get or create a user by Clerk ID.
 * Replaces the duplicated find-or-create pattern across API routes.
 * Also updates lastActiveAt in the background.
 */
export async function getOrCreateUser(clerkId: string) {
  let user = await prisma.user.findUnique({ where: { clerkId } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId,
        email: `${clerkId}@placeholder.com`,
      },
    })
  }

  // Update lastActiveAt (fire-and-forget)
  prisma.user
    .update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {})

  return user
}
