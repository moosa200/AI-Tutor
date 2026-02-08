'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  Filter,
  Shuffle,
  ImageOff,
} from 'lucide-react'

interface Question {
  id: string
  year: number
  paper: string
  questionNumber: string
  topic: string
  text: string
  markScheme: string
  examinerRemarks: string | null
  marks: number
  difficulty: string
  imageUrl: string | null
}

interface TopicInfo {
  name: string
  count: number
}

interface MarkingResult {
  score: number
  maxScore: number
  feedback: string
  breakdown: { point: string; awarded: boolean; comment: string }[]
  mistakeTags: string[]
  improvements: string[]
}

export default function PracticePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [topics, setTopics] = useState<TopicInfo[]>([])
  const [selectedTopic, setSelectedTopic] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [selectedPaperType, setSelectedPaperType] = useState('all')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [isMarking, setIsMarking] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<MarkingResult | null>(null)

  // Fetch questions when filters change
  useEffect(() => {
    fetchQuestions()
  }, [selectedTopic, selectedDifficulty, selectedPaperType])

  const fetchQuestions = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTopic !== 'all') params.set('topic', selectedTopic)
      if (selectedDifficulty !== 'all') params.set('difficulty', selectedDifficulty)
      if (selectedPaperType !== 'all') params.set('paperType', selectedPaperType)

      const response = await fetch(`/api/practice/questions?${params}`)
      const data = await response.json()

      setQuestions(data.questions || [])
      if (data.topics) setTopics(data.topics)
      setCurrentQuestionIndex(0)
      setAnswer('')
      setResult(null)
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]

  const handleSubmit = async () => {
    if (!answer.trim() || !currentQuestion) return

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
    setCurrentQuestionIndex((prev) => (prev + 1) % questions.length)
    setAnswer('')
    setResult(null)
  }

  const randomQuestion = () => {
    if (questions.length <= 1) return
    let newIndex
    do {
      newIndex = Math.floor(Math.random() * questions.length)
    } while (newIndex === currentQuestionIndex)
    setCurrentQuestionIndex(newIndex)
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
          {questions.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Question {currentQuestionIndex + 1}/{questions.length}
              </Badge>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Topic and Difficulty Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-base">Filter Questions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">Topic</label>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic.name} value={topic.name}>
                        {topic.name} ({topic.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">Paper Type</label>
                <Select value={selectedPaperType} onValueChange={setSelectedPaperType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="theory">Theory / Structured</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={randomQuestion} disabled={questions.length <= 1}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Random
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading questions...</span>
          </div>
        )}

        {/* No Questions State */}
        {!isLoading && questions.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Questions Found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                No questions match your filters. Try selecting a different topic or difficulty.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Question and Answer */}
        {!isLoading && currentQuestion && (
          <>
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
                  {currentQuestion.imageUrl ? (
                    <div className="mb-6 flex justify-center overflow-hidden rounded-lg border bg-white p-2">
                      <img
                        src={currentQuestion.imageUrl}
                        alt={`Figure for Q${currentQuestion.questionNumber}`}
                        className="h-auto max-h-[500px] max-w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  ) : currentQuestion.text.includes('[Figure:') && (
                    <div className="mb-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-muted-foreground">
                      <ImageOff className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm font-medium">Diagram not available</p>
                    </div>
                  )}
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
                        <p className="font-medium text-yellow-800">Examiner&apos;s Remarks:</p>
                        <p className="text-yellow-700">{currentQuestion.examinerRemarks}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
