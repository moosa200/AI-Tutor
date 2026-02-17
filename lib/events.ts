import { prisma } from '@/lib/db'

/**
 * Log an event. Awaited to avoid dangling connections on serverless.
 */
export async function logEvent(
  userId: string,
  type: string,
  metadata?: Record<string, any>
) {
  try {
    await prisma.event.create({
      data: { userId, type, metadata: metadata ?? undefined },
    })
  } catch (err) {
    console.error('Event logging failed:', err)
  }
}

/**
 * Get or create a user by Clerk ID.
 * Replaces the duplicated find-or-create pattern across API routes.
 * Also updates lastActiveAt.
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

  // Update lastActiveAt - awaited to avoid dangling connections on serverless
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })
  } catch {
    // Non-critical, don't crash
  }

  return user
}
