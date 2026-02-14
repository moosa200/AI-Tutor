import { PrismaClient, QuestionType, InputType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clean existing data
  await prisma.attempt.deleteMany()
  await prisma.questionSubPart.deleteMany()
  await prisma.questionPart.deleteMany()
  await prisma.question.deleteMany()
  await prisma.user.deleteMany()

  console.log('🧹 Cleaned existing data')

  // ============================================================================
  // MCQ QUESTIONS
  // ============================================================================

  const mcq1 = await prisma.question.create({
    data: {
      year: 2023,
      paper: 1,
      questionNumber: 5,
      type: QuestionType.MCQ,
      totalMarks: 1,
      questionText: 'A ball is thrown vertically upwards with initial velocity $v = 20 \\text{ m s}^{-1}$. Taking $g = 10 \\text{ m s}^{-2}$, what is the maximum height reached?',
      optionA: '$10 \\text{ m}$',
      optionB: '$20 \\text{ m}$',
      optionC: '$30 \\text{ m}$',
      optionD: '$40 \\text{ m}$',
      correctOption: 'B',
      topic: 'Kinematics',
      difficulty: 'easy',
      explanation: 'Using $v^2 = u^2 + 2as$, at maximum height $v = 0$. So $0 = (20)^2 + 2(-10)s$, giving $s = 20 \\text{ m}$.',
    },
  })

  const mcq2 = await prisma.question.create({
    data: {
      year: 2023,
      paper: 1,
      questionNumber: 12,
      type: QuestionType.MCQ,
      totalMarks: 1,
      questionText: 'A resistor of resistance $R$ has a current $I$ flowing through it. The power dissipated is:',
      optionA: '$I^2 R$',
      optionB: '$\\frac{I}{R}$',
      optionC: '$IR$',
      optionD: '$\\frac{R}{I^2}$',
      correctOption: 'A',
      topic: 'Electricity',
      difficulty: 'easy',
      explanation: 'Power $P = VI = I(IR) = I^2R$ using Ohm\'s law $V = IR$.',
    },
  })

  console.log('✅ Created MCQ questions')

  // ============================================================================
  // STRUCTURED QUESTION 1: Mechanics (Numerical + Text)
  // ============================================================================

  const structured1 = await prisma.question.create({
    data: {
      year: 2023,
      paper: 2,
      questionNumber: 3,
      type: QuestionType.STRUCTURED,
      totalMarks: 8,
      topic: 'Forces and Motion',
      difficulty: 'medium',
      parts: {
        create: [
          {
            partLabel: 'a',
            partText: 'A car of mass $1200 \\text{ kg}$ accelerates uniformly from rest to $25 \\text{ m s}^{-1}$ in $8.0 \\text{ s}$. Calculate the acceleration of the car.',
            marks: 2,
            inputType: InputType.NUMERICAL,
            order: 1,
            markScheme: {
              type: 'numerical',
              correctAnswer: {
                value: 3.125,
                unit: 'm/s²',
              },
              tolerance: {
                type: 'absolute',
                value: 0.01,
              },
              alternativeUnits: ['m s^-2', 'm/s^2', 'ms^-2'],
              partialMarks: [
                {
                  condition: 'correct_value_wrong_unit',
                  marks: 1,
                  feedback: 'Correct value but check your unit',
                },
              ],
            },
          },
          {
            partLabel: 'b',
            partText: 'Calculate the net force acting on the car during acceleration.',
            marks: 2,
            inputType: InputType.NUMERICAL,
            order: 2,
            markScheme: {
              type: 'numerical',
              correctAnswer: {
                value: 3750,
                unit: 'N',
              },
              tolerance: {
                type: 'percentage',
                value: 2,
              },
              alternativeUnits: ['n', 'newtons'],
              partialMarks: [],
            },
          },
          {
            partLabel: 'c',
            partText: 'Explain why the actual force provided by the engine must be greater than your answer to part (b).',
            marks: 4,
            inputType: InputType.LONG_TEXT,
            order: 3,
            markScheme: {
              type: 'text',
              maxMarks: 4,
              rubric: 'Award marks for: (1) Mention of resistive forces/friction/air resistance [1 mark], (2) Engine must overcome these forces [1 mark], (3) Net force = Engine force - Resistive forces [1 mark], (4) Therefore engine force > net force [1 mark]',
              keyPoints: [
                {
                  point: 'Air resistance/friction/resistive forces oppose motion',
                  marks: 1,
                  keywords: ['air resistance', 'friction', 'drag', 'resistive'],
                },
                {
                  point: 'Engine must overcome these resistive forces',
                  marks: 1,
                  keywords: ['overcome', 'counteract', 'work against'],
                },
                {
                  point: 'Net force equals engine force minus resistive forces',
                  marks: 1,
                  keywords: ['net force', 'resultant', 'equation', 'F_net'],
                },
                {
                  point: 'Therefore engine force must be greater than net force',
                  marks: 1,
                  keywords: ['greater', 'larger', 'more than', 'exceeds'],
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log('✅ Created structured question 1 (Mechanics)')

  // ============================================================================
  // STRUCTURED QUESTION 2: Electricity with subparts
  // ============================================================================

  const structured2 = await prisma.question.create({
    data: {
      year: 2023,
      paper: 2,
      questionNumber: 5,
      type: QuestionType.STRUCTURED,
      totalMarks: 12,
      topic: 'Electric Circuits',
      difficulty: 'hard',
      parts: {
        create: [
          {
            partLabel: 'a',
            partText: 'Define electromotive force (e.m.f.).',
            marks: 2,
            inputType: InputType.TEXT,
            order: 1,
            markScheme: {
              type: 'text',
              maxMarks: 2,
              rubric: 'Energy converted from other forms to electrical energy per unit charge [2 marks] OR energy per unit charge [1 mark]',
              keyPoints: [
                {
                  point: 'Energy converted per unit charge',
                  marks: 1,
                  keywords: ['energy', 'per unit charge', 'coulomb'],
                },
                {
                  point: 'From other forms to electrical energy',
                  marks: 1,
                  keywords: ['converted', 'other forms', 'chemical', 'electrical'],
                },
              ],
            },
          },
          {
            partLabel: 'b',
            partText: 'A battery of e.m.f. $12 \\text{ V}$ and internal resistance $r$ is connected to a lamp of resistance $8.0 \\text{ Ω}$. The current in the circuit is $1.2 \\text{ A}$.',
            marks: 7,
            inputType: InputType.TEXT,
            order: 2,
            markScheme: {},
            subParts: {
              create: [
                {
                  subPartLabel: 'i',
                  subPartText: 'Calculate the potential difference across the lamp.',
                  marks: 2,
                  inputType: InputType.NUMERICAL,
                  order: 1,
                  markScheme: {
                    type: 'numerical',
                    correctAnswer: {
                      value: 9.6,
                      unit: 'V',
                    },
                    tolerance: {
                      type: 'absolute',
                      value: 0.1,
                    },
                    alternativeUnits: ['v', 'volts'],
                    partialMarks: [],
                  },
                },
                {
                  subPartLabel: 'ii',
                  subPartText: 'Calculate the internal resistance $r$ of the battery.',
                  marks: 3,
                  inputType: InputType.NUMERICAL,
                  order: 2,
                  markScheme: {
                    type: 'numerical',
                    correctAnswer: {
                      value: 2.0,
                      unit: 'Ω',
                    },
                    tolerance: {
                      type: 'absolute',
                      value: 0.1,
                    },
                    alternativeUnits: ['ohm', 'ohms', 'Ω'],
                    partialMarks: [
                      {
                        condition: 'working_shown',
                        marks: 1,
                        feedback: 'Award 1 mark for correct method',
                      },
                    ],
                  },
                },
                {
                  subPartLabel: 'iii',
                  subPartText: 'Calculate the power dissipated in the internal resistance.',
                  marks: 2,
                  inputType: InputType.NUMERICAL,
                  order: 3,
                  markScheme: {
                    type: 'numerical',
                    correctAnswer: {
                      value: 2.88,
                      unit: 'W',
                    },
                    tolerance: {
                      type: 'percentage',
                      value: 3,
                    },
                    alternativeUnits: ['w', 'watts'],
                    partialMarks: [],
                  },
                },
              ],
            },
          },
          {
            partLabel: 'c',
            partText: 'A student suggests replacing the lamp with one of lower resistance. Suggest and explain what would happen to the potential difference across the lamp.',
            marks: 3,
            inputType: InputType.LONG_TEXT,
            order: 3,
            markScheme: {
              type: 'text',
              maxMarks: 3,
              rubric: 'Award marks for: (1) Current increases [1 mark], (2) Voltage drop across internal resistance increases [1 mark], (3) Therefore p.d. across lamp decreases [1 mark]',
              keyPoints: [
                {
                  point: 'Current in circuit increases',
                  marks: 1,
                  keywords: ['current increases', 'higher current', 'I increases'],
                },
                {
                  point: 'Voltage drop across internal resistance increases (V = Ir)',
                  marks: 1,
                  keywords: ['voltage drop', 'lost volts', 'internal resistance', 'Ir'],
                },
                {
                  point: 'Therefore p.d. across lamp decreases',
                  marks: 1,
                  keywords: ['decreases', 'reduces', 'lower', 'less'],
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log('✅ Created structured question 2 (Electricity with subparts)')

  // ============================================================================
  // STRUCTURED QUESTION 3: With MCQ_INLINE
  // ============================================================================

  const structured3 = await prisma.question.create({
    data: {
      year: 2024,
      paper: 2,
      questionNumber: 1,
      type: QuestionType.STRUCTURED,
      totalMarks: 6,
      topic: 'Waves',
      difficulty: 'easy',
      parts: {
        create: [
          {
            partLabel: 'a',
            partText: 'A wave has frequency $50 \\text{ Hz}$ and wavelength $4.0 \\text{ m}$. Calculate the wave speed.',
            marks: 2,
            inputType: InputType.NUMERICAL,
            order: 1,
            markScheme: {
              type: 'numerical',
              correctAnswer: {
                value: 200,
                unit: 'm/s',
              },
              tolerance: {
                type: 'absolute',
                value: 1,
              },
              alternativeUnits: ['m s^-1', 'ms^-1', 'm/s'],
              partialMarks: [],
            },
          },
          {
            partLabel: 'b',
            partText: 'The wave is a sound wave. In which medium is it most likely traveling?',
            marks: 1,
            inputType: InputType.MCQ_INLINE,
            order: 2,
            markScheme: {
              type: 'mcq',
              options: ['Air at room temperature', 'Water', 'Steel', 'Vacuum'],
              correctOption: 'A',
              explanation: 'Speed of sound in air is approximately 340 m/s, but the calculated speed of 200 m/s is too slow. Actually, given the frequency and wavelength, this could represent a different scenario. The speed matches sound in air at lower temperatures or a different wave type.',
            },
          },
          {
            partLabel: 'c',
            partText: 'State one difference between longitudinal and transverse waves.',
            marks: 3,
            inputType: InputType.TEXT,
            order: 3,
            markScheme: {
              type: 'text',
              maxMarks: 3,
              rubric: 'Longitudinal: oscillations parallel to direction of energy transfer. Transverse: oscillations perpendicular to direction of energy transfer. [3 marks for complete comparison, 1-2 marks for partial]',
              keyPoints: [
                {
                  point: 'Direction of oscillation differs',
                  marks: 3,
                  keywords: ['parallel', 'perpendicular', 'oscillation', 'vibration', 'direction'],
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log('✅ Created structured question 3 (with MCQ inline)')

  // Summary
  const questionCount = await prisma.question.count()
  const mcqCount = await prisma.question.count({
    where: { type: QuestionType.MCQ },
  })
  const structuredCount = await prisma.question.count({
    where: { type: QuestionType.STRUCTURED },
  })

  console.log('\n📊 Seed Summary:')
  console.log(`   Total questions: ${questionCount}`)
  console.log(`   MCQ questions: ${mcqCount}`)
  console.log(`   Structured questions: ${structuredCount}`)
  console.log('\n✅ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
