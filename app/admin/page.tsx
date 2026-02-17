import { prisma } from '@/lib/db'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Users,
  Activity,
  Target,
  TrendingUp,
  ArrowLeft,
  BookOpen,
} from 'lucide-react'

async function getOverviewStats() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [totalUsers, totalAttempts, dauCount, avgScoreResult] =
    await Promise.all([
      prisma.user.count(),
      prisma.attempt.count(),
      prisma.event.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: todayStart } },
        _count: true,
      }),
      prisma.attempt.aggregate({
        _avg: { score: true },
        _sum: { score: true, maxScore: true },
      }),
    ])

  const avgPercent =
    avgScoreResult._sum.maxScore && avgScoreResult._sum.maxScore > 0
      ? Math.round(
          ((avgScoreResult._sum.score ?? 0) / avgScoreResult._sum.maxScore) *
            100
        )
      : 0

  return {
    totalUsers,
    totalAttempts,
    dau: dauCount.length,
    avgPercent,
  }
}

async function getFeatureUsage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const usage = await prisma.event.groupBy({
    by: ['type'],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
  })

  // Get unique users per type
  const uniqueUsersPerType = await Promise.all(
    usage.map(async (u) => {
      const unique = await prisma.event.groupBy({
        by: ['userId'],
        where: { type: u.type, createdAt: { gte: thirtyDaysAgo } },
      })
      return { type: u.type, count: u._count.id, uniqueUsers: unique.length }
    })
  )

  return uniqueUsersPerType.sort((a, b) => b.count - a.count)
}

async function getMostActiveUsers() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const activeUsers = await prisma.event.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  })

  const userIds = activeUsers.map((u) => u.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true, lastActiveAt: true },
  })

  const userMap = new Map(users.map((u) => [u.id, u]))

  return activeUsers.map((a) => {
    const user = userMap.get(a.userId)
    return {
      email: user?.email ?? 'Unknown',
      name: user?.name ?? null,
      eventCount: a._count.id,
      lastActive: user?.lastActiveAt,
    }
  })
}

async function getScoresByTopic() {
  const attempts = await prisma.attempt.findMany({
    where: { maxScore: { gt: 0 } },
    select: { score: true, maxScore: true, question: { select: { topic: true } } },
  })

  const topicScores: Record<
    string,
    { total: number; max: number; count: number }
  > = {}

  for (const a of attempts) {
    const topic = a.question?.topic || 'Unknown'
    if (!topicScores[topic]) topicScores[topic] = { total: 0, max: 0, count: 0 }
    topicScores[topic].total += a.score
    topicScores[topic].max += a.maxScore
    topicScores[topic].count++
  }

  return Object.entries(topicScores)
    .map(([topic, s]) => ({
      topic,
      avgPercent: s.max > 0 ? Math.round((s.total / s.max) * 100) : 0,
      attempts: s.count,
    }))
    .sort((a, b) => a.avgPercent - b.avgPercent)
}

async function getAllUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      imageUrl: true,
      role: true,
      lastActiveAt: true,
      createdAt: true,
      _count: { select: { attempts: true, events: true } },
    },
  })

  // Get per-user attempt stats
  const userStats = await Promise.all(
    users.map(async (u) => {
      const attempts = await prisma.attempt.findMany({
        where: { userId: u.id },
        select: {
          score: true,
          maxScore: true,
          question: { select: { topic: true } },
        },
      })

      const totalScore = attempts.reduce((s, a) => s + a.score, 0)
      const totalMax = attempts.reduce((s, a) => s + a.maxScore, 0)
      const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null

      // Find weakest topic
      const topicScores: Record<string, { total: number; max: number }> = {}
      for (const a of attempts) {
        const topic = a.question?.topic || 'Unknown'
        if (!topicScores[topic]) topicScores[topic] = { total: 0, max: 0 }
        topicScores[topic].total += a.score
        topicScores[topic].max += a.maxScore
      }

      let weakestTopic: string | null = null
      let weakestPct = 101
      for (const [topic, s] of Object.entries(topicScores)) {
        const pct = s.max > 0 ? (s.total / s.max) * 100 : 0
        if (pct < weakestPct) {
          weakestPct = pct
          weakestTopic = topic
        }
      }

      return {
        ...u,
        attempts: u._count.attempts,
        events: u._count.events,
        avgPercent,
        weakestTopic,
      }
    })
  )

  return userStats
}

async function getSignupTrend() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const days: Record<string, number> = {}
  for (const u of users) {
    const day = u.createdAt.toISOString().split('T')[0]
    days[day] = (days[day] || 0) + 1
  }

  return Object.entries(days).map(([day, count]) => ({ day, count }))
}

export default async function AdminPage() {
  const [overview, featureUsage, activeUsers, topicScores, signupTrend, allUsers] =
    await Promise.all([
      getOverviewStats(),
      getFeatureUsage(),
      getMostActiveUsers(),
      getScoresByTopic(),
      getSignupTrend(),
      getAllUsers(),
    ])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Admin Dashboard</span>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to App
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardDescription>Total Users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{overview.totalUsers}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardDescription>Active Today</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{overview.dau}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <CardDescription>Total Attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{overview.totalAttempts}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardDescription>Avg Score</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{overview.avgPercent}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Feature Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage (30 days)</CardTitle>
              <CardDescription>Event counts by type</CardDescription>
            </CardHeader>
            <CardContent>
              {featureUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No events recorded yet
                </p>
              ) : (
                <div className="space-y-3">
                  {featureUsage.map((f) => (
                    <div
                      key={f.type}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{f.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.uniqueUsers} unique users
                        </p>
                      </div>
                      <Badge variant="secondary">{f.count} events</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Most Active Users */}
          <Card>
            <CardHeader>
              <CardTitle>Most Active Users (30 days)</CardTitle>
              <CardDescription>By event count</CardDescription>
            </CardHeader>
            <CardContent>
              {activeUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity yet
                </p>
              ) : (
                <div className="space-y-2">
                  {activeUsers.slice(0, 10).map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {u.name || u.email}
                        </p>
                        {u.lastActive && (
                          <p className="text-xs text-muted-foreground">
                            Last:{' '}
                            {new Date(u.lastActive).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{u.eventCount}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score by Topic */}
          <Card>
            <CardHeader>
              <CardTitle>Average Score by Topic</CardTitle>
              <CardDescription>
                Sorted by weakest first
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topicScores.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No attempts yet
                </p>
              ) : (
                <div className="space-y-3">
                  {topicScores.map((t) => (
                    <div key={t.topic} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate">
                          {t.topic}
                        </span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {t.avgPercent}% ({t.attempts})
                        </span>
                      </div>
                      <Progress value={t.avgPercent} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signup Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Signups (Last 30 Days)</CardTitle>
              <CardDescription>New user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {signupTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No signups in the last 30 days
                </p>
              ) : (
                <div className="space-y-2">
                  {signupTrend.map((d) => (
                    <div
                      key={d.day}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <span className="text-sm">{d.day}</span>
                      <Badge variant="secondary">
                        {d.count} {d.count === 1 ? 'signup' : 'signups'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Per-user details with attempts, avg score, and weakest topic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium">Last Active</th>
                    <th className="pb-3 font-medium text-center">Attempts</th>
                    <th className="pb-3 font-medium text-center">Events</th>
                    <th className="pb-3 font-medium text-center">Avg Score</th>
                    <th className="pb-3 font-medium">Weakest Topic</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">
                            {u.name || 'No name'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {u.lastActiveAt
                          ? new Date(u.lastActiveAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 text-center">{u.attempts}</td>
                      <td className="py-3 text-center">{u.events}</td>
                      <td className="py-3 text-center">
                        {u.avgPercent !== null ? (
                          <Badge
                            variant={
                              u.avgPercent >= 60 ? 'secondary' : 'destructive'
                            }
                          >
                            {u.avgPercent}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        {u.weakestTopic ? (
                          <Badge variant="outline">{u.weakestTopic}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
