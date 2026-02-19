'use client'

import { useState } from 'react'
import Image from 'next/image'
import { parseMathText } from '@/components/ui/math'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Send } from 'lucide-react'

interface QuestionImage {
  url: string
  caption?: string
}

interface MCQQuestionProps {
  question: {
    id: string
    year: number
    paper: number
    questionNumber: number
    topic: string
    difficulty?: string
    questionText: string
    optionA: string
    optionB: string
    optionC: string
    optionD: string
    images?: QuestionImage[]
  }
  onSubmit: (selected: string) => void
  isSubmitting?: boolean
}

export function MCQQuestion({
  question,
  onSubmit,
  isSubmitting = false,
}: MCQQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const options = [
    { label: 'A', text: question.optionA },
    { label: 'B', text: question.optionB },
    { label: 'C', text: question.optionC },
    { label: 'D', text: question.optionD },
  ]

  const handleSubmit = () => {
    if (selected) {
      onSubmit(selected)
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* Question Header */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Question {question.questionNumber}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                Paper {question.paper} · {question.year} · Multiple Choice
              </span>
              <Badge variant="outline">{question.topic}</Badge>
              {question.difficulty && (
                <Badge
                  variant={
                    question.difficulty === 'easy'
                      ? 'success'
                      : question.difficulty === 'hard'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {question.difficulty}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Marks</p>
            <p className="text-2xl font-bold">1</p>
          </div>
        </div>
      </div>

      {/* Question Text */}
      <div className="text-lg leading-relaxed">
        {parseMathText(question.questionText)}
      </div>

      {/* Images */}
      {question.images && question.images.length > 0 && (
        <div className="space-y-4">
          {question.images.map((img, i) => (
            <div key={i} className="flex flex-col items-center">
              <Image
                src={img.url}
                alt={img.caption || 'Diagram'}
                width={500}
                height={300}
                className="rounded border"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              {img.caption && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {img.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <label
            key={option.label}
            className={`
              flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer
              transition-all duration-200
              ${
                selected === option.label
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
              ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="mcq-option"
              value={option.label}
              checked={selected === option.label}
              onChange={() => setSelected(option.label)}
              disabled={isSubmitting}
              className="mt-1 w-4 h-4"
            />
            <div className="flex-1">
              <span className="font-semibold mr-2">{option.label}.</span>
              <span className="leading-relaxed">
                {parseMathText(option.text)}
              </span>
            </div>
          </label>
        ))}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur pt-4 pb-2 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!selected || isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Checking...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Answer
            </>
          )}
        </Button>
        {!selected && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Please select an option before submitting
          </p>
        )}
      </div>
    </div>
  )
}
