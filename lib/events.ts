import { prisma } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

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
 * Fetch real user data from Clerk (name, email, image).
 */
async function fetchClerkUser(clerkId: string) {
  try {
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(clerkId)
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )
    return {
      email: primaryEmail?.emailAddress ?? `${clerkId}@placeholder.com`,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      imageUrl: clerkUser.imageUrl ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Get or create a user by Clerk ID.
 * Syncs name/email/image from Clerk if the local record has placeholder data.
 * Also updates lastActiveAt.
 */
export async function getOrCreateUser(clerkId: string) {
  let user = await prisma.user.findUnique({ where: { clerkId } })

  if (!user) {
    const clerkData = await fetchClerkUser(clerkId)
    user = await prisma.user.create({
      data: {
        clerkId,
        email: clerkData?.email ?? `${clerkId}@placeholder.com`,
        name: clerkData?.name,
        imageUrl: clerkData?.imageUrl,
      },
    })
    return user
  }

  // Sync from Clerk if user has placeholder email or missing name
  if (user.email.endsWith('@placeholder.com') || !user.name) {
    const clerkData = await fetchClerkUser(clerkId)
    if (clerkData) {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email: clerkData.email,
            name: clerkData.name,
            imageUrl: clerkData.imageUrl,
            lastActiveAt: new Date(),
          },
        })
        return user
      } catch {
        // Non-critical - continue with existing data
      }
    }
  }

  // Update lastActiveAt
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })
  } catch {
    // Non-critical
  }

  return user
}
