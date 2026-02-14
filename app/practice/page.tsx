'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  Filter,
  Shuffle,
} from 'lucide-react'
import { MCQQuestion } from '@/components/practice/mcq-question'
import { StructuredQuestion } from '@/components/practice/structured-question'

interface QuestionPart {
  id: string
  partLabel: string
  partText: string
  marks: number
  inputType: string
  images: any
  markScheme: any
  options?: string[]
  subParts?: QuestionSubPart[]
}

interface QuestionSubPart {
  id: string
  subPartLabel: string
  subPartText: string
  marks: number
  inputType: string
  images: any
  markScheme: any
  options?: string[]
}

interface Question {
  id: string
  year: number
  paper: number
  questionNumber: number
  type: 'MCQ' | 'STRUCTURED'
  totalMarks: number
  topic: string
  difficulty?: string
  // MCQ fields
  questionText?: string
  optionA?: string
  optionB?: string
  optionC?: string
  optionD?: string
  correctOption?: string
  explanation?: string
  // Structured fields
  parts?: QuestionPart[]
  images?: any
}

interface TopicInfo {
  name: string
  count: number
}

export default function PracticePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [topics, setTopics] = useState<TopicInfo[]>([])
  const [selectedTopic, setSelectedTopic] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [selectedPaperType, setSelectedPaperType] = useState('all')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<any>(null)

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
      setResult(null)
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]

  const handleMCQSubmit = async (selectedOption: string) => {
    if (!currentQuestion) return

    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch('/api/practice/mark-mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedOption,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResult(data)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Marking error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStructuredSubmit = async (answers: Record<string, any>) => {
    if (!currentQuestion) return

    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch('/api/practice/mark-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answers,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResult(data)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Marking error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextQuestion = () => {
    setCurrentQuestionIndex((prev) => (prev + 1) % questions.length)
    setResult(null)
  }

  const randomQuestion = () => {
    if (questions.length <= 1) return
    let newIndex
    do {
      newIndex = Math.floor(Math.random() * questions.length)
    } while (newIndex === currentQuestionIndex)
    setCurrentQuestionIndex(newIndex)
    setResult(null)
  }

  const resetQuestion = () => {
    setResult(null)
    // Force re-render by updating key
    setCurrentQuestionIndex((prev) => prev)
  }

  const scorePercentage = result
    ? (result.totalScore / result.totalMarks) * 100
    : 0

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

        {/* Question Display */}
        {!isLoading && currentQuestion && !result && (
          <Card>
            <CardContent className="p-6">
              {currentQuestion.type === 'MCQ' ? (
                <MCQQuestion
                  question={currentQuestion}
                  onSubmit={handleMCQSubmit}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <StructuredQuestion
                  question={currentQuestion}
                  onSubmit={handleStructuredSubmit}
                  isSubmitting={isSubmitting}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Score Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Marking Result</CardTitle>
                    <CardDescription>
                      Score: {result.totalScore}/{result.totalMarks} marks
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
            </Card>

            {/* MCQ Result */}
            {currentQuestion.type === 'MCQ' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {result.isCorrect ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        Correct!
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-5 w-5" />
                        Incorrect
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Your answer: <strong>{result.selectedOption}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Correct answer: <strong>{result.correctOption}</strong>
                    </p>
                  </div>
                  {result.explanation && (
                    <div>
                      <h4 className="font-semibold mb-2">Explanation</h4>
                      <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Structured Result */}
            {currentQuestion.type === 'STRUCTURED' && result.partResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Part-by-Part Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {result.partResults.map((partResult: any, idx: number) => (
                        <div
                          key={idx}
                          className="border-l-4 border-primary pl-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">
                              Part ({partResult.partLabel})
                            </h4>
                            <Badge
                              variant={
                                partResult.score === partResult.maxScore
                                  ? 'default'
                                  : partResult.score > 0
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {partResult.score}/{partResult.maxScore} marks
                            </Badge>
                          </div>
                          {partResult.feedback && (
                            <p className="text-sm text-muted-foreground">
                              {partResult.feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetQuestion} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={nextQuestion} className="flex-1">
                Next Question
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
