'use client'

import { useState } from 'react'
import Image from 'next/image'
import { parseMathText } from '@/components/ui/math'
import {
  NumericalInput,
  TextInput,
  LongTextInput,
  MCQInlineInput,
} from './input-components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Send } from 'lucide-react'

interface QuestionImage {
  url: string
  caption?: string
}

interface SubPart {
  id: string
  subPartLabel: string
  subPartText: string
  marks: number
  inputType: 'NUMERICAL' | 'TEXT' | 'LONG_TEXT' | 'MCQ_INLINE'
  images?: QuestionImage[]
  markScheme?: any
}

interface Part {
  id: string
  partLabel: string
  partText: string
  marks: number
  inputType: 'NUMERICAL' | 'TEXT' | 'LONG_TEXT' | 'MCQ_INLINE'
  images?: QuestionImage[]
  subParts?: SubPart[]
  markScheme?: any
}

interface StructuredQuestionProps {
  question: {
    id: string
    year: number
    paper: number
    questionNumber: number
    totalMarks: number
    topic: string
    difficulty?: string
    images?: QuestionImage[]
    parts: Part[]
  }
  onSubmit: (answers: Record<string, any>) => void
  isSubmitting?: boolean
}

export function StructuredQuestion({
  question,
  onSubmit,
  isSubmitting = false,
}: StructuredQuestionProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({})

  const handleAnswerChange = (id: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = () => {
    onSubmit(answers)
  }

  // Check if all required fields are filled
  const allPartIds = question.parts.flatMap((part) => {
    const ids = [part.id]
    if (part.subParts) {
      ids.push(...part.subParts.map((sp) => sp.id))
    }
    return ids
  })

  const isComplete = allPartIds.every(id => {
    const answer = answers[id]
    if (!answer) return false
    if (typeof answer === 'object' && 'number' in answer) {
      return answer.number?.trim() !== ''
    }
    return typeof answer === 'string' && answer.trim() !== ''
  })

  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Question {question.questionNumber}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                Paper {question.paper} · {question.year}
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
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{question.totalMarks} marks</p>
          </div>
        </div>
      </div>

      {/* Question Stem Images */}
      {question.images && question.images.length > 0 && (
        <div className="space-y-4">
          {question.images.map((img, i) => (
            <div key={i} className="flex flex-col items-center">
              <Image
                src={img.url}
                alt={img.caption || `Diagram ${i + 1}`}
                width={600}
                height={400}
                className="rounded-lg border"
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

      {/* Parts */}
      <div className="space-y-6">
        {question.parts.map((part) => (
          <div
            key={part.id}
            className="border-l-4 border-primary pl-4 space-y-4"
          >
            {/* Part Header */}
            <div className="flex items-start gap-2">
              <span className="font-bold text-lg">({part.partLabel})</span>
              <div className="flex-1">
                <div className="text-base leading-relaxed">
                  {parseMathText(part.partText)}
                </div>
                <span className="text-sm text-muted-foreground">
                  [{part.marks} {part.marks === 1 ? 'mark' : 'marks'}]
                </span>
              </div>
            </div>

            {/* Part Images */}
            {part.images && part.images.length > 0 && (
              <div className="ml-6 space-y-2">
                {part.images.map((img, i) => (
                  <div key={i} className="flex flex-col items-start">
                    <Image
                      src={img.url}
                      alt={img.caption || 'Diagram'}
                      width={500}
                      height={300}
                      className="rounded border"
                    />
                    {img.caption && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {img.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Input Field for Part (if no subparts) */}
            {!part.subParts && (
              <div>
                {renderInput(
                  part.id,
                  part.inputType,
                  part.marks,
                  answers[part.id],
                  (val) => handleAnswerChange(part.id, val),
                  isSubmitting,
                  part.markScheme
                )}
              </div>
            )}

            {/* Sub-parts */}
            {part.subParts && part.subParts.length > 0 && (
              <div className="ml-8 space-y-4">
                {part.subParts.map((subPart) => (
                  <div key={subPart.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">
                        ({subPart.subPartLabel})
                      </span>
                      <div className="flex-1">
                        <div className="text-sm leading-relaxed">
                          {parseMathText(subPart.subPartText)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          [{subPart.marks}{' '}
                          {subPart.marks === 1 ? 'mark' : 'marks'}]
                        </span>
                      </div>
                    </div>

                    {/* Subpart Images */}
                    {subPart.images && subPart.images.length > 0 && (
                      <div className="ml-6">
                        {subPart.images.map((img, i) => (
                          <div key={i}>
                            <Image
                              src={img.url}
                              alt={img.caption || 'Diagram'}
                              width={400}
                              height={250}
                              className="rounded border"
                            />
                            {img.caption && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {img.caption}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Subpart Input */}
                    {renderInput(
                      subPart.id,
                      subPart.inputType,
                      subPart.marks,
                      answers[subPart.id],
                      (val) => handleAnswerChange(subPart.id, val),
                      isSubmitting,
                      subPart.markScheme
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur pt-4 pb-2 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!isComplete || isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Marking...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Answers
            </>
          )}
        </Button>
        {!isComplete && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Please answer all parts before submitting
          </p>
        )}
      </div>
    </div>
  )
}

// Helper function to render appropriate input based on type
function renderInput(
  id: string,
  inputType: string,
  marks: number,
  value: any,
  onChange: (val: any) => void,
  disabled: boolean,
  markScheme?: any
) {
  switch (inputType) {
    case 'NUMERICAL':
      return (
        <NumericalInput
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'LONG_TEXT':
      return (
        <LongTextInput
          id={id}
          value={value}
          onChange={onChange}
          marks={marks}
          disabled={disabled}
        />
      )
    case 'MCQ_INLINE':
      return (
        <MCQInlineInput
          id={id}
          options={markScheme?.options || []}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'TEXT':
    default:
      return (
        <TextInput
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )
  }
}
