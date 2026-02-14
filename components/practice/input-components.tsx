'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface NumericalInputProps {
  id: string
  value?: { number: string; unit: string }
  onChange: (value: { number: string; unit: string }) => void
  disabled?: boolean
}

export function NumericalInput({
  id,
  value,
  onChange,
  disabled = false,
}: NumericalInputProps) {
  const handleNumberChange = (num: string) => {
    onChange({ number: num, unit: value?.unit || '' })
  }

  const handleUnitChange = (u: string) => {
    onChange({ number: value?.number || '', unit: u })
  }

  return (
    <div className="flex gap-2 items-center ml-6">
      <Input
        type="text"
        value={value?.number || ''}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder="Answer"
        disabled={disabled}
        className="flex-1"
      />
      <Input
        type="text"
        value={value?.unit || ''}
        onChange={(e) => handleUnitChange(e.target.value)}
        placeholder="Unit (e.g., m/s, N, J)"
        disabled={disabled}
        className="w-40"
      />
    </div>
  )
}

interface TextInputProps {
  id: string
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function TextInput({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Enter your answer...',
}: TextInputProps) {
  return (
    <Input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full ml-6"
    />
  )
}

interface LongTextInputProps {
  id: string
  value?: string
  onChange: (value: string) => void
  marks: number
  disabled?: boolean
}

export function LongTextInput({
  id,
  value,
  onChange,
  marks,
  disabled = false,
}: LongTextInputProps) {
  // Estimate rows based on marks (roughly 2-3 lines per mark)
  const rows = Math.max(3, Math.min(marks * 2, 12))

  return (
    <Textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder="Enter your explanation..."
      disabled={disabled}
      className="w-full ml-6 resize-y"
    />
  )
}

interface MCQInlineInputProps {
  id: string
  options: string[]
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function MCQInlineInput({
  id,
  options,
  value,
  onChange,
  disabled = false,
}: MCQInlineInputProps) {
  return (
    <div className="ml-6 space-y-2">
      {options.map((option, idx) => {
        const label = String.fromCharCode(65 + idx) // A, B, C, D
        return (
          <label
            key={idx}
            className={`
              flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer
              transition-colors
              ${
                value === label
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name={id}
              value={label}
              checked={value === label}
              onChange={() => onChange(label)}
              disabled={disabled}
              className="w-4 h-4"
            />
            <span>
              <strong>{label}.</strong> {option}
            </span>
          </label>
        )
      })}
    </div>
  )
}
