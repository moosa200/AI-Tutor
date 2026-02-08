# API Integration Status

## Currently Integrated: Google Gemini (FREE Tier)

All AI functionality uses Google Gemini free tier through the `@google/generative-ai` npm package.

### Models in Use

| Model | Purpose | Files | Cost |
|-------|---------|-------|------|
| `gemini-2.0-flash` | Chat streaming | `lib/gemini.ts` | Free |
| `gemini-2.0-flash` | Answer marking (JSON mode) | `lib/gemini-marking.ts` | Free |
| `gemini-2.0-flash` | PDF question extraction (multimodal) | `lib/gemini-parser.ts` | Free |
| `gemini-2.0-flash` | PDF mark scheme extraction | `lib/gemini-parser-markscheme.ts` | Free |
| `gemini-embedding-001` | Text embeddings (3072 dims) | `lib/rag/gemini-embeddings.ts` | Free |

### API Key
- Single key from https://aistudio.google.com/app/apikey
- Environment variable: `GEMINI_API_KEY`
- No billing setup required

### Rate Limits (Free Tier)
As of 2025, Gemini free tier limits:
- **gemini-2.0-flash**: 15 RPM (requests per minute), 1M TPM (tokens per minute), 1500 RPD (requests per day)
- **gemini-embedding-001**: 1500 RPM, 100 RPD for batch operations
- These limits are sufficient for development and small-scale use
- For production with many users, may need to upgrade to paid tier or add request queuing

### How Gemini is Used

#### Chat (`lib/gemini.ts`)
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  systemInstruction: PHYSICS_TUTOR_SYSTEM_PROMPT  // + optional RAG context
})
const chat = model.startChat({ history })
const result = await chat.sendMessageStream(lastMessage)
// yields text chunks via async generator
```

#### Marking (`lib/gemini-marking.ts`)
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  systemInstruction: MARKING_SYSTEM_PROMPT,
  generationConfig: {
    responseMimeType: 'application/json'  // Forces JSON output
  }
})
const result = await model.generateContent(prompt)
// Returns MarkingResult JSON
```

#### PDF Parsing (`lib/gemini-parser.ts`)
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
const result = await model.generateContent([
  {
    inlineData: {
      mimeType: 'application/pdf',
      data: pdfBase64  // Full PDF as base64
    }
  },
  { text: EXTRACTION_PROMPT }
])
// Returns JSON array of extracted questions
```

#### Embeddings (`lib/rag/gemini-embeddings.ts`)
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
const result = await model.embedContent(text)
// Returns 3072-dimensional float vector
```

---

## What Was Tried But Didn't Work

### 1. AWS Bedrock (Claude)
- **Why tried**: Initially planned to use Anthropic Claude via AWS Bedrock
- **What happened**: AWS Bedrock requires specific model access grants, and the setup was complex. The free tier constraints and regional availability made it impractical.
- **Files removed**: `lib/claude.ts`, `lib/marking.ts`, `lib/rag/embeddings.ts`, `lib/rag/parser.ts`, `lib/rag/ingest.ts`
- **Remnants**: `next.config.js` still lists AWS SDK packages in `serverComponentsExternalPackages` (should be cleaned up)

### 2. Anthropic API (Direct)
- **Why tried**: Direct Claude API access
- **What happened**: No API credits available. Anthropic requires a paid account.
- **Outcome**: Abandoned in favour of Google Gemini free tier

### 3. PDF-parse library
- **Why tried**: Local PDF text extraction without AI
- **What happened**: Couldn't properly extract physics equations, diagrams, or formatted question structures from Cambridge papers
- **Outcome**: Replaced with Gemini multimodal (sends entire PDF as base64, Gemini reads and extracts)
- **Remnant**: `pdf-parse` is no longer in package.json dependencies but is still referenced in `next.config.js`

---

## Other Services Integrated

### Pinecone (Vector Database)
- **Package**: `@pinecone-database/pinecone`
- **Tier**: Free (starter)
- **Index**: `physics-questions-gemini`
- **Dimensions**: 3072 (matching Gemini embedding-001)
- **Metric**: Cosine similarity
- **Free limits**: 1 index, 100K vectors, 2M read units/month
- **Usage**: Stores question embeddings for semantic search (RAG)
- **Files**: `lib/rag/pinecone.ts`

### Clerk (Authentication)
- **Package**: `@clerk/nextjs` v5
- **Tier**: Free (up to 10K monthly active users)
- **Features used**: Email/password auth, middleware protection, UserButton component
- **Files**: `middleware.ts`, `app/layout.tsx`, `app/sign-in/`, `app/sign-up/`
- **Notes**: User records auto-created in our DB on first interaction

### Supabase (PostgreSQL Database)
- **Connection**: Via Prisma ORM with connection pooling (pgbouncer)
- **Tier**: Free (500MB database, 2 projects)
- **Used for**: Users, Questions, Attempts, Topics, ChatMessages
- **Files**: `lib/db.ts`, `prisma/schema.prisma`

---

## Alternative Options If Needed

### If Gemini free tier hits limits:
1. **Upgrade to Gemini paid** - Pay-as-you-go pricing, same API
2. **Switch to OpenAI GPT-4o-mini** - Cheap, good quality, would need to rewrite `lib/gemini*.ts`
3. **Switch to Anthropic Claude** - Higher quality marking, requires paid API access
4. **Use Groq (Llama 3)** - Very fast, free tier available, good for chat but less accurate for marking

### If Pinecone free tier limits:
1. **Upgrade Pinecone** - Standard tier ($70/month)
2. **Switch to Supabase pgvector** - Free, use existing database, slightly slower
3. **Switch to Chroma** - Self-hosted, free, Python-based

### If Clerk limits reached:
1. **Upgrade Clerk** - Pro tier ($25/month)
2. **Switch to NextAuth.js** - Free, self-hosted, more setup work
3. **Switch to Supabase Auth** - Free tier, already have Supabase

---

## API Key Locations in Code

All API keys are loaded from environment variables. No hardcoded keys in source code.

```
GEMINI_API_KEY    → lib/gemini.ts, lib/gemini-marking.ts, lib/gemini-parser.ts,
                    lib/gemini-parser-markscheme.ts, lib/rag/gemini-embeddings.ts

PINECONE_API_KEY  → lib/rag/pinecone.ts
PINECONE_INDEX    → lib/rag/pinecone.ts
PINECONE_HOST     → lib/rag/pinecone.ts

DATABASE_URL      → prisma/schema.prisma (via Prisma)

CLERK_SECRET_KEY  → middleware.ts (via @clerk/nextjs)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY → app/layout.tsx (via ClerkProvider)
```

## Cost Summary (Current)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Google Gemini | $0 | Free tier (15 RPM limit) |
| Pinecone | $0 | Free starter (1 index, 100K vectors) |
| Clerk | $0 | Free (up to 10K MAU) |
| Supabase | $0 | Free (500MB) |
| Vercel | $0 | Free hobby tier |
| **Total** | **$0** | Suitable for development and small-scale use |
