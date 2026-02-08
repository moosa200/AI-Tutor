# Architecture

## Folder Structure

```
.
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (ClerkProvider, fonts, global CSS)
│   ├── page.tsx                      # Landing page (public, redirects if authed)
│   ├── dashboard/page.tsx            # Dashboard (server component, authed)
│   ├── chat/page.tsx                 # AI chat interface (client component)
│   ├── practice/page.tsx             # Practice questions (client component)
│   ├── sign-in/[[...sign-in]]/      # Clerk sign-in page
│   ├── sign-up/[[...sign-up]]/      # Clerk sign-up page
│   └── api/
│       ├── chat/route.ts             # POST - streaming chat with RAG
│       ├── practice/
│       │   ├── questions/route.ts    # GET - fetch questions with filters
│       │   └── submit/route.ts       # POST - submit answer for AI marking
│       └── rag/
│           └── search/route.ts       # POST - vector similarity search
│
├── components/
│   ├── chat/
│   │   ├── chat-message.tsx          # Single message bubble (markdown support)
│   │   └── chat-input.tsx            # Auto-resizing textarea input
│   └── ui/                           # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── progress.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── tabs.tsx
│       └── textarea.tsx
│
├── lib/                              # Server-side utilities
│   ├── db.ts                         # Prisma client singleton
│   ├── gemini.ts                     # Chat streaming (system prompt + RAG context)
│   ├── gemini-marking.ts             # Answer marking engine (JSON mode)
│   ├── gemini-parser.ts              # Question extraction from PDFs
│   ├── gemini-parser-markscheme.ts   # Mark scheme extraction from PDFs
│   ├── utils.ts                      # cn() helper for Tailwind class merging
│   └── rag/
│       ├── gemini-embeddings.ts      # Text -> 3072-dim vectors
│       ├── pinecone.ts               # Pinecone client (upsert, search)
│       ├── search.ts                 # High-level RAG search orchestration
│       └── ingest-pipeline.ts        # 7-step PDF ingestion pipeline
│
├── scripts/                          # CLI utilities (excluded from build)
│   ├── ingest.ts                     # Entry point: npm run ingest
│   ├── populate-topics.ts            # Create Topic records, link questions
│   ├── show-topics.ts                # Display topic statistics
│   ├── clear-paper-questions.ts      # Delete questions for a specific paper
│   ├── clear-problematic-papers.ts   # Clean up bad data
│   ├── debug-extraction.ts           # Test PDF extraction on one paper
│   ├── recreate-pinecone-index.ts    # Reset Pinecone index
│   ├── check-pinecone.mjs            # Verify Pinecone connection
│   ├── create-pinecone-index.mjs     # Create index with correct dims
│   ├── list-gemini-models.mjs        # List available Gemini models
│   └── test-gemini-models.mjs        # Test Gemini API connectivity
│
├── prisma/
│   └── schema.prisma                 # Database schema definition
│
├── data/
│   └── past-papers/                  # PDF storage (gitignored)
│       └── 2024/
│           ├── 9702_s24_qp_12.pdf
│           ├── 9702_s24_ms_12.pdf
│           └── ...
│
├── middleware.ts                      # Clerk auth middleware
├── next.config.js                    # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript (strict, excludes scripts/)
├── components.json                   # shadcn/ui configuration
└── package.json                      # Dependencies and scripts
```

## Key Files and Their Purposes

### Authentication

**`middleware.ts`** - Clerk middleware that protects all routes except `/`, `/sign-in`, `/sign-up`, and `/api/webhook`. Unauthenticated requests to protected routes are redirected to `/sign-in` with a `redirect_url` parameter.

### Database

**`lib/db.ts`** - Prisma client singleton. Uses the global object pattern to prevent multiple PrismaClient instances in development (Next.js hot reloading). Exports `prisma` as a named export.

```typescript
// Usage:
import { prisma } from '@/lib/db'
```

### AI Integration

**`lib/gemini.ts`** - Chat system. Contains the `PHYSICS_TUTOR_SYSTEM_PROMPT` (physics expert persona). Exports `streamChatResponse()` (async generator yielding text chunks) and `getChatResponse()` (non-streaming). Accepts optional RAG context that gets injected into the system prompt.

**`lib/gemini-marking.ts`** - Marking engine. Contains `MARKING_SYSTEM_PROMPT` (strict examiner persona). Uses Gemini's `responseMimeType: 'application/json'` mode. Returns structured `MarkingResult` with score, feedback, breakdown, mistake tags, and improvements. Clamps score to [0, maxMarks].

**`lib/gemini-parser.ts`** - PDF question extraction. Sends PDFs as base64 to Gemini 2.0 Flash (multimodal). Extraction prompt enforces parentheses numbering format, figure descriptions, and MCQ options. Post-processes: deduplication, 0-mark parent filtering.

**`lib/gemini-parser-markscheme.ts`** - Mark scheme extraction. Same approach as question parser. Also exports `mergeQuestionsWithMarkSchemes()` which matches by questionNumber.

## Database Schema (Prisma Models)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    User      │     │   Question   │     │    Topic    │
├─────────────┤     ├──────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)      │     │ id (PK)     │
│ clerkId (UQ)│     │ year         │     │ name (UQ)   │
│ email (UQ)  │     │ paper        │     │ level       │
│ createdAt   │     │ questionNum  │     │ description │
│             │     │ topic        │     │ status      │
│             │     │ topicId (FK) │────>│             │
│             │     │ text         │     └─────────────┘
│             │     │ markScheme   │
│             │     │ examRemarks  │
│             │     │ marks        │
│             │     │ difficulty   │
│             │     │ createdAt    │
│             │     │ UQ(year,     │
│             │     │  paper,qNum) │
└──────┬──────┘     └──────┬───────┘
       │                   │
       │   ┌───────────────┘
       │   │
       ▼   ▼
┌──────────────┐
│   Attempt    │
├──────────────┤
│ id (PK)      │
│ userId (FK)  │──> User
│ questionId   │──> Question
│ studentAnswer│
│ score        │
│ maxScore     │
│ feedback     │
│ mistakeTags[]│
│ createdAt    │
└──────────────┘

┌──────────────┐
│ ChatMessage  │  (schema exists, not yet used for persistence)
├──────────────┤
│ id (PK)      │
│ userId       │
│ role         │
│ content      │
│ createdAt    │
└──────────────┘
```

### Key Constraints
- `Question`: unique on `(year, paper, questionNumber)`
- `User`: unique on `clerkId` and `email`
- `Topic`: unique on `name`
- `Attempt`: indexed on `userId` and `questionId`

### Field Notes
- `Question.paper`: String like `"Paper 12"`, `"Paper 22"`, `"Paper 31"`, etc.
- `Question.topic`: Broad category string (e.g., `"Mechanics"`, `"Waves"`)
- `Question.difficulty`: `"easy"`, `"medium"`, or `"hard"` (based on marks)
- `Attempt.mistakeTags`: PostgreSQL string array (e.g., `["unit_error", "sig_fig"]`)

## API Routes Breakdown

### `POST /api/chat`
```
Client sends messages[] + useRAG flag
  → Clerk auth check
  → If useRAG: search Pinecone for relevant past papers (top 3)
  → Format RAG context into system prompt
  → Stream Gemini response as ReadableStream
  → Client reads chunks and displays incrementally
```

### `GET /api/practice/questions`
```
Client sends ?topic=X&difficulty=Y&paperType=Z
  → Build Prisma where clause from params
  → paperType "mcq" = Papers 11,12,13; "theory" = all others
  → Query questions + group-by topic counts
  → Return { questions[], topics[], total }
```

### `POST /api/practice/submit`
```
Client sends { questionId, studentAnswer, question }
  → Clerk auth check
  → Find/create User record
  → Get question data (from request or DB lookup)
  → Call markAnswer() with Gemini (JSON mode)
  → Save Attempt record to DB
  → Return { success, result: MarkingResult }
```

### `POST /api/rag/search`
```
Client sends { query, topK, filters }
  → Clerk auth check
  → Generate embedding for query text (3072 dims)
  → Search Pinecone with optional filters
  → Return { results: SearchResult[] }
```

## How the RAG System Works

### Ingestion (Offline)

```
Past Paper PDFs
       │
       ▼
┌─────────────────┐    ┌─────────────────────┐
│ gemini-parser.ts │    │ gemini-parser-       │
│ (questions)      │    │ markscheme.ts (MS)   │
└────────┬────────┘    └─────────┬───────────┘
         │                       │
         ▼                       ▼
    ┌────────────────────────────────┐
    │  mergeQuestionsWithMarkSchemes │
    └───────────────┬────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   ┌──────────────┐   ┌──────────────────┐
   │ PostgreSQL   │   │ Gemini Embeddings │
   │ (Prisma)     │   │ (3072 dims)       │
   └──────────────┘   └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │    Pinecone      │
                      │ (vector upsert)  │
                      └──────────────────┘
```

### Search (Runtime)

```
User message ──> Embed with Gemini ──> Pinecone query (top K)
                                              │
                                              ▼
                                    Matching question metadata
                                              │
                                              ▼
                                    Format as prompt context
                                              │
                                              ▼
                                    Inject into system prompt
                                              │
                                              ▼
                                    Gemini generates response
                                    (with past paper references)
```

### Pinecone Index Details
- **Index name**: `physics-questions-gemini`
- **Dimensions**: 3072 (Gemini embedding-001)
- **Metric**: cosine similarity
- **Metadata stored per vector**: year, paper, questionNumber, topic, text, markScheme, examinerRemarks, marks, difficulty

## How the Marking System Works

```
Student Answer
       │
       ▼
┌────────────────────────────────┐
│  POST /api/practice/submit     │
│                                │
│  1. Authenticate (Clerk)       │
│  2. Find/create user           │
│  3. Get question + mark scheme │
│  4. Call markAnswer()          │
│     ├─ System: MARKING_PROMPT  │
│     ├─ Input: question text,   │
│     │   mark scheme, answer,   │
│     │   examiner remarks       │
│     ├─ Gemini JSON mode        │
│     └─ Returns MarkingResult   │
│  5. Save Attempt to DB         │
│  6. Return result to client    │
└────────────────────────────────┘

MarkingResult {
  score: 3,              // marks awarded
  maxScore: 5,           // total available
  feedback: "...",       // overall paragraph
  breakdown: [           // point-by-point
    { point: "Uses F=ma correctly",
      awarded: true,
      comment: "Correct substitution" },
    { point: "Final answer with units",
      awarded: false,
      comment: "Missing units (N)" }
  ],
  mistakeTags: ["unit_error"],
  improvements: ["Always include SI units"]
}
```

### Mistake Tag Categories
| Tag | Meaning |
|-----|---------|
| `unit_error` | Missing or incorrect units |
| `sig_fig` | Wrong significant figures |
| `concept_error` | Fundamental misunderstanding |
| `incomplete` | Answer lacks required detail |
| `calculation_error` | Mathematical mistake |
| `formula_error` | Wrong equation used |
| `direction_error` | Missing or wrong direction/sign |
| `definition_error` | Imprecise definition |

## How Chat Works

```
┌─────────────────────────────────────────┐
│  chat/page.tsx (Client Component)       │
│                                         │
│  State: messages[], isLoading           │
│                                         │
│  User types message ──> handleSend()    │
│    1. Add user message to state         │
│    2. POST /api/chat (fetch)            │
│    3. Read response stream              │
│    4. Update assistant message in state │
│    5. Auto-scroll to bottom             │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  api/chat/route.ts                      │
│                                         │
│  1. Auth check (Clerk)                  │
│  2. Get last user message               │
│  3. RAG search (if useRAG=true)         │
│     └─ searchQuestions() → top 3        │
│     └─ formatSearchResultsForPrompt()   │
│  4. streamChatResponse(messages, ctx)   │
│     └─ System prompt + RAG context      │
│     └─ Build Gemini chat history        │
│     └─ sendMessageStream()              │
│  5. Convert AsyncGenerator to Stream    │
│  6. Return ReadableStream response      │
└─────────────────────────────────────────┘
```

### System Prompt Structure (with RAG)
```
[PHYSICS_TUTOR_SYSTEM_PROMPT]
--- RELEVANT PAST PAPER CONTEXT ---
--- Question 1 (2024 Paper 22 Q1(a), Mechanics, 3 marks) ---
Question: ...
Mark Scheme: ...
Examiner Remarks: ...

--- Question 2 ...
--- END CONTEXT ---
Use the above past paper questions and mark schemes to inform your responses.
```

### Message Format
- Messages use `{ role: 'user' | 'assistant', content: string }`
- Converted to Gemini format: `assistant` → `model`
- Chat history passed to `model.startChat({ history })`
- Last user message sent via `chat.sendMessageStream()`
