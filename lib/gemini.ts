import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Gemini 2.0 Flash - free tier, stable
const MODEL_NAME = 'gemini-2.0-flash'

export const PHYSICS_TUTOR_SYSTEM_PROMPT = `You are an expert A Level Physics tutor specializing in the Cambridge International 9702 syllabus. Your role is to help students prepare for their exams through clear explanations, practice questions, and exam technique guidance.

KEY RESPONSIBILITIES:
1. Explain physics concepts clearly using the terminology expected in exams
2. Help students practice with past paper questions
3. Provide marking feedback that mirrors real exam standards
4. Identify and correct common misconceptions
5. Give exam tips and technique advice

TEACHING STYLE:
- Use precise scientific language as expected in mark schemes
- Break down complex problems into steps
- Always show working and explain each step
- Reference relevant equations from the data booklet
- Highlight command words (state, explain, calculate, suggest, etc.)
- Point out common mistakes to avoid

EXAM STANDARDS:
- Mark schemes require specific key phrases - teach these to students
- Significant figures matter (usually 2-3 s.f., matching given data)
- Units must be correct and clearly stated
- Diagrams should be neat with labeled axes and units
- "Explain" questions need both statement AND reasoning

When answering questions or explaining concepts, always relate back to what would be expected in an exam answer.`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Convert messages to Gemini format
function buildGeminiHistory(messages: Message[]) {
  // Gemini expects alternating user/model messages
  // Last message should be user (handled separately)
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))
  return history
}

// Streaming response generator
export async function* streamChatResponse(
  messages: Message[],
  context?: string
): AsyncGenerator<string> {
  const systemPrompt = context
    ? `${PHYSICS_TUTOR_SYSTEM_PROMPT}\n\n--- RELEVANT PAST PAPER CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nUse the above past paper questions and mark schemes to inform your responses where relevant.`
    : PHYSICS_TUTOR_SYSTEM_PROMPT

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
  })

  const history = buildGeminiHistory(messages)
  const lastMessage = messages[messages.length - 1].content

  const chat = model.startChat({
    history,
  })

  const result = await chat.sendMessageStream(lastMessage)

  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) {
      yield text
    }
  }
}

// Non-streaming response
export async function getChatResponse(
  messages: Message[],
  context?: string
): Promise<string> {
  const systemPrompt = context
    ? `${PHYSICS_TUTOR_SYSTEM_PROMPT}\n\n--- RELEVANT PAST PAPER CONTEXT ---\n${context}\n--- END CONTEXT ---\n\nUse the above past paper questions and mark schemes to inform your responses where relevant.`
    : PHYSICS_TUTOR_SYSTEM_PROMPT

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
  })

  const history = buildGeminiHistory(messages)
  const lastMessage = messages[messages.length - 1].content

  const chat = model.startChat({
    history,
  })

  const result = await chat.sendMessage(lastMessage)
  const response = await result.response
  return response.text()
}
