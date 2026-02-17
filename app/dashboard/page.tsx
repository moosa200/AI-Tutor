import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getOrCreateUser } from '@/lib/events'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen,
  MessageSquare,
  Target,
  TrendingUp,
  ArrowRight,
  Clock,
  AlertTriangle,
  Shield,
} from 'lucide-react'

const ADMIN_IDS = (process.env.ADMIN_CLERK_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

// Topics for A Level Physics 9702
const TOPICS = [
  { name: 'Physical Quantities and Units', level: 'AS' },
  { name: 'Kinematics', level: 'AS' },
  { name: 'Dynamics', level: 'AS' },
  { name: 'Forces, Density and Pressure', level: 'AS' },
  { name: 'Work, Energy and Power', level: 'AS' },
  { name: 'Deformation of Solids', level: 'AS' },
  { name: 'Waves', level: 'AS' },
  { name: 'Superposition', level: 'AS' },
  { name: 'Electricity', level: 'AS' },
  { name: 'D.C. Circuits', level: 'AS' },
  { name: 'Particle Physics', level: 'AS' },
  { name: 'Motion in a Circle', level: 'A2' },
  { name: 'Gravitational Fields', level: 'A2' },
  { name: 'Temperature', level: 'A2' },
  { name: 'Ideal Gases', level: 'A2' },
  { name: 'Thermodynamics', level: 'A2' },
  { name: 'Oscillations', level: 'A2' },
  { name: 'Electric Fields', level: 'A2' },
  { name: 'Capacitance', level: 'A2' },
  { name: 'Magnetic Fields', level: 'A2' },
  { name: 'Electromagnetic Induction', level: 'A2' },
  { name: 'Alternating Currents', level: 'A2' },
  { name: 'Quantum Physics', level: 'A2' },
  { name: 'Nuclear Physics', level: 'A2' },
  { name: 'Medical Physics', level: 'A2' },
  { name: 'Astronomy and Cosmology', level: 'A2' },
]

async function getRecentAttempts(userId: string) {
  try {
    return await prisma.attempt.findMany({
      where: { userId },
      include: { question: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
  } catch {
    return []
  }
}

async function getTopicStats(userId: string) {
  try {
    const attempts = await prisma.attempt.findMany({
      where: { userId },
      include: { question: true },
    })

    // Group by topic and calculate averages
    const topicScores: Record<string, { total: number; max: number; count: number }> = {}

    for (const attempt of attempts) {
      const topic = attempt.question?.topic || 'Unknown'
      if (!topicScores[topic]) {
        topicScores[topic] = { total: 0, max: 0, count: 0 }
      }
      topicScores[topic].total += attempt.score
      topicScores[topic].max += attempt.maxScore
      topicScores[topic].count++
    }

    return Object.entries(topicScores)
      .map(([topic, stats]) => ({
        topic,
        average: stats.max > 0 ? (stats.total / stats.max) * 100 : 0,
        attempts: stats.count,
      }))
      .sort((a, b) => a.average - b.average) // Sort by lowest average first
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    redirect('/sign-in')
  }

  // Get or create user
  const user = await getOrCreateUser(clerkId)

  const recentAttempts = await getRecentAttempts(user.id)
  const topicStats = await getTopicStats(user.id)
  const weakTopics = topicStats.filter(t => t.average < 60)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Physics 9702</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex gap-2">
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  AI Tutor
                </Button>
              </Link>
              <Link href="/practice">
                <Button variant="ghost" size="sm">
                  <Target className="mr-2 h-4 w-4" />
                  Practice
                </Button>
              </Link>
              {ADMIN_IDS.includes(clerkId) && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Link href="/practice">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <Target className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Start Practice Session</CardTitle>
                <CardDescription>
                  Practice past paper questions with AI marking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Start Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/chat">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <MessageSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Ask AI Tutor</CardTitle>
                <CardDescription>
                  Get explanations and exam tips from your AI tutor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Open Chat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="pb-2">
              <TrendingUp className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>
                {recentAttempts.length} questions attempted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {recentAttempts.length > 0
                  ? Math.round(
                      (recentAttempts.reduce((sum, a) => sum + a.score, 0) /
                        recentAttempts.reduce((sum, a) => sum + a.maxScore, 0)) *
                        100
                    )
                  : 0}
                %
              </div>
              <p className="text-sm text-muted-foreground">Average score</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Weak Topics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <CardTitle>Topics to Review</CardTitle>
              </div>
              <CardDescription>
                Topics where you scored below 60%
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weakTopics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {recentAttempts.length === 0 ? (
                    <p>Complete some practice questions to see your weak areas.</p>
                  ) : (
                    <p>Great job! No weak topics identified yet.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {weakTopics.slice(0, 5).map((topic, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{topic.topic}</span>
                        <span className="text-muted-foreground">
                          {Math.round(topic.average)}%
                        </span>
                      </div>
                      <Progress value={topic.average} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attempts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Recent Attempts</CardTitle>
              </div>
              <CardDescription>Your latest practice questions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentAttempts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No attempts yet. Start practicing!</p>
                  <Link href="/practice">
                    <Button className="mt-4" size="sm">
                      Start Practice
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAttempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {attempt.question?.topic || 'Question'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.question
                            ? `${attempt.question.year} ${attempt.question.paper}`
                            : 'Practice Question'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            attempt.score / attempt.maxScore >= 0.6
                              ? 'success'
                              : 'destructive'
                          }
                        >
                          {attempt.score}/{attempt.maxScore}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(attempt.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Topic Overview */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Syllabus Topics</CardTitle>
            <CardDescription>
              Cambridge 9702 Physics syllabus topics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-3 text-sm">AS Level Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.filter((t) => t.level === 'AS').map((topic, index) => (
                    <Badge key={index} variant="secondary">
                      {topic.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-sm">A2 Level Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.filter((t) => t.level === 'A2').map((topic, index) => (
                    <Badge key={index} variant="outline">
                      {topic.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
