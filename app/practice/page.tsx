'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BookOpen,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'

// Sample questions for demo (in production, these come from the database/RAG)
const SAMPLE_QUESTIONS = [
  {
    id: '1',
    year: 2023,
    paper: 'Paper 2',
    questionNumber: '1a',
    topic: 'Mechanics',
    text: 'A ball of mass 0.15 kg is thrown vertically upwards with an initial velocity of 20 m/s. Assuming air resistance is negligible, calculate:\n(i) the maximum height reached by the ball [2]\n(ii) the time taken to reach maximum height [2]',
    markScheme: '(i) Using v² = u² + 2as where v = 0, u = 20 m/s, a = -9.81 m/s²\n0 = 400 + 2(-9.81)s\ns = 400/19.62 = 20.4 m (or 20 m to 2 s.f.)\n\n(ii) Using v = u + at\n0 = 20 + (-9.81)t\nt = 20/9.81 = 2.04 s (or 2.0 s to 2 s.f.)',
    examinerRemarks: 'Common errors: Using g = 10 m/s² without stating it. Not showing working. Incorrect significant figures.',
    marks: 4,
    difficulty: 'easy',
  },
  {
    id: '2',
    year: 2023,
    paper: 'Paper 2',
    questionNumber: '2b',
    topic: 'Waves',
    text: 'A sound wave has a frequency of 440 Hz and travels at 340 m/s in air.\n(i) Calculate the wavelength of this sound wave. [2]\n(ii) The sound wave enters water where its speed increases to 1500 m/s. State and explain what happens to the frequency and wavelength. [3]',
    markScheme: '(i) λ = v/f = 340/440 = 0.773 m (or 0.77 m)\n\n(ii) Frequency remains the same (440 Hz) because frequency is determined by the source, not the medium.\nWavelength increases because λ = v/f, and v increases while f stays constant.\nNew wavelength = 1500/440 = 3.41 m',
    examinerRemarks: 'Many candidates incorrectly stated that frequency changes when wave enters new medium. Remember: frequency is determined by the SOURCE.',
    marks: 5,
    difficulty: 'medium',
  },
  {
    id: '3',
    year: 2022,
    paper: 'Paper 4',
    questionNumber: '3a',
    topic: 'Electricity',
    text: 'A cell of e.m.f. 1.5 V and internal resistance 0.50 Ω is connected to an external resistance of 2.5 Ω.\n(i) Calculate the current in the circuit. [2]\n(ii) Calculate the terminal potential difference across the cell. [2]\n(iii) Calculate the power dissipated in the external resistance. [2]',
    markScheme: '(i) I = E/(R + r) = 1.5/(2.5 + 0.5) = 1.5/3.0 = 0.50 A\n\n(ii) V = E - Ir = 1.5 - (0.50)(0.50) = 1.5 - 0.25 = 1.25 V\nOR V = IR = 0.50 × 2.5 = 1.25 V\n\n(iii) P = I²R = (0.50)² × 2.5 = 0.625 W (or 0.63 W)',
    examinerRemarks: 'Some candidates confused e.m.f. with terminal p.d. Remember: e.m.f. = terminal p.d. + lost volts (Ir)',
    marks: 6,
    difficulty: 'medium',
  },
]

interface MarkingResult {
  score: number
  maxScore: number
  feedback: string
  breakdown: { point: string; awarded: boolean; comment: string }[]
  mistakeTags: string[]
  improvements: string[]
}

export default function PracticePage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [isMarking, setIsMarking] = useState(false)
  const [result, setResult] = useState<MarkingResult | null>(null)

  const currentQuestion = SAMPLE_QUESTIONS[currentQuestionIndex]

  const handleSubmit = async () => {
    if (!answer.trim()) return

    setIsMarking(true)
    setResult(null)

    try {
      const response = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          studentAnswer: answer,
          question: {
            text: currentQuestion.text,
            markScheme: currentQuestion.markScheme,
            marks: currentQuestion.marks,
            examinerRemarks: currentQuestion.examinerRemarks,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResult(data.result)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Marking error:', error)
      setResult({
        score: 0,
        maxScore: currentQuestion.marks,
        feedback: 'Failed to mark your answer. Please try again.',
        breakdown: [],
        mistakeTags: ['error'],
        improvements: [],
      })
    } finally {
      setIsMarking(false)
    }
  }

  const nextQuestion = () => {
    setCurrentQuestionIndex((prev) => (prev + 1) % SAMPLE_QUESTIONS.length)
    setAnswer('')
    setResult(null)
  }

  const resetQuestion = () => {
    setAnswer('')
    setResult(null)
  }

  const scorePercentage = result ? (result.score / result.maxScore) * 100 : 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80">
              <ArrowLeft className="h-4 w-4" />
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-semibold">Physics 9702</span>
            </Link>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm text-muted-foreground">Practice Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Question {currentQuestionIndex + 1}/{SAMPLE_QUESTIONS.length}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Question Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {currentQuestion.topic}
                  </Badge>
                  <CardTitle className="text-lg">
                    {currentQuestion.year} {currentQuestion.paper} Q{currentQuestion.questionNumber}
                  </CardTitle>
                  <CardDescription>
                    {currentQuestion.marks} marks | {currentQuestion.difficulty}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {currentQuestion.text}
              </div>
            </CardContent>
          </Card>

          {/* Answer Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Answer</CardTitle>
              <CardDescription>
                Write your answer below. Include all working and units.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter your answer here...&#10;&#10;Show all working and include units."
                className="min-h-[200px] font-mono text-sm"
                disabled={isMarking || !!result}
              />
              <div className="flex gap-2">
                {!result ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!answer.trim() || isMarking}
                    className="flex-1"
                  >
                    {isMarking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Marking...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit for Marking
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={resetQuestion}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                    <Button onClick={nextQuestion}>
                      Next Question
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Card */}
        {result && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Marking Result</CardTitle>
                  <CardDescription>
                    Score: {result.score}/{result.maxScore} marks
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {Math.round(scorePercentage)}%
                  </div>
                  <Progress value={scorePercentage} className="w-24 mt-2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Feedback */}
              <div>
                <h4 className="font-semibold mb-2">Overall Feedback</h4>
                <p className="text-sm text-muted-foreground">{result.feedback}</p>
              </div>

              {/* Breakdown */}
              {result.breakdown.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Mark Breakdown</h4>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {result.breakdown.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          {item.awarded ? (
                            <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <div className="text-sm">
                            <p className="font-medium">{item.point}</p>
                            <p className="text-muted-foreground">{item.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Mistake Tags */}
              {result.mistakeTags.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Areas to Improve</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.mistakeTags.map((tag, index) => (
                      <Badge key={index} variant="destructive">
                        {tag.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvements */}
              {result.improvements.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Suggestions for Improvement</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {result.improvements.map((improvement, index) => (
                      <li key={index}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mark Scheme Reveal */}
              <div>
                <h4 className="font-semibold mb-2">Official Mark Scheme</h4>
                <div className="p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap font-mono">
                  {currentQuestion.markScheme}
                </div>
                {currentQuestion.examinerRemarks && (
                  <div className="mt-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm">
                    <p className="font-medium text-yellow-800">Examiner's Remarks:</p>
                    <p className="text-yellow-700">{currentQuestion.examinerRemarks}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
