import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const ADMIN_IDS = (process.env.ADMIN_CLERK_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId || !ADMIN_IDS.includes(userId)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
