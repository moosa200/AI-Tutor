# Project Overview: A Level Physics 9702 AI Tutor

## What This App Does

An AI-powered exam preparation platform for Cambridge International A Level Physics (9702). Students can:

1. **Practice Past Paper Questions** - Browse real Cambridge 9702 questions filtered by topic, paper type (MCQ/Theory), and difficulty. Answer in a text editor and get instant AI marking.
2. **Get AI Marking & Feedback** - Answers are marked against official mark schemes by Gemini AI. Students receive point-by-point breakdowns, mistake categorization, improvement suggestions, and the official mark scheme.
3. **Chat with an AI Tutor** - A streaming chat interface with a physics expert AI that can reference relevant past paper questions (RAG) to give contextual explanations.
4. **Track Progress** - Dashboard shows recent attempts, average scores, weak topics (below 60%), and the full 26-topic Cambridge 9702 syllabus.

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Framework** | Next.js 14 | App Router, Server Components, API Routes |
| **Language** | TypeScript | Strict mode |
| **Database** | PostgreSQL | Hosted on Supabase |
| **ORM** | Prisma 5.10 | Schema in `prisma/schema.prisma` |
| **Auth** | Clerk | OAuth, email/password, middleware-based protection |
| **AI Chat/Marking** | Google Gemini 2.0 Flash | Free tier, streaming, JSON mode for marking |
| **Embeddings** | Gemini Embedding-001 | 3072 dimensions, free tier |
| **Vector DB** | Pinecone | Cosine similarity search for RAG |
| **PDF Parsing** | Gemini Multimodal | Sends base64 PDFs to Gemini for extraction |
| **UI** | shadcn/ui + Radix UI | 12 components, Tailwind CSS |
| **Icons** | Lucide React | |
| **Markdown** | react-markdown | For chat message rendering |
| **Hosting** | Vercel | Auto-deploys from GitHub `master` branch |

## Current Working Features

- [x] **Landing page** with feature cards and sign-in/sign-up
- [x] **Clerk authentication** (sign-in, sign-up, protected routes)
- [x] **Dashboard** with quick actions, recent attempts, weak topics, syllabus overview
- [x] **Practice page** with topic/difficulty/paper-type filters, random question button
- [x] **AI marking** via Gemini with point-by-point breakdown, mistake tags, improvements
- [x] **Attempt tracking** saved to database (user, question, score, feedback, mistake tags)
- [x] **AI Chat** with streaming responses and markdown rendering
- [x] **RAG integration** - chat searches past papers for relevant context
- [x] **PDF ingestion pipeline** - extracts questions + mark schemes from Cambridge PDFs
- [x] **Vector search** - Pinecone with Gemini embeddings (3072 dims)
- [x] **Vercel deployment** - live at production URL
- [x] **87 questions ingested** from 2024 papers (Papers 12, 22, 31, 53)

## Features NOT Yet Implemented

- [ ] **Figures/diagrams** - Questions with figures only show text descriptions (no actual images). Extraction prompt was recently updated to describe figures but papers need re-ingestion.
- [ ] **MCQ options display** - MCQ questions (Paper 11-13) don't show A/B/C/D options yet. Prompt updated, needs re-ingestion.
- [ ] **Chat history persistence** - ChatMessage model exists in schema but messages aren't saved/loaded between sessions
- [ ] **Flashcard system** - Not built
- [ ] **Study plan generator** - Not built
- [ ] **Diagnostic assessment** - Not built
- [ ] **Teacher dashboard** - Not built
- [ ] **Analytics/reporting** - Basic topic stats exist but no detailed analytics
- [ ] **Spaced repetition** - Not built
- [ ] **Email/notification system** - Not built
- [ ] **User profile/settings page** - Not built
- [ ] **Question bookmarking/favourites** - Not built
- [ ] **More past papers** - Only 2024 S24 papers ingested; need more years

## Known Issues & Bugs

1. **`.env.example` contains real credentials** - Database URL, Clerk keys are real values. Must be replaced with placeholders and credentials rotated.
2. **`next.config.js` references old AWS packages** - `serverComponentsExternalPackages` still lists `@aws-sdk/*` and `pdf-parse` which are no longer dependencies. Should be cleaned up.
3. **Questions need re-ingestion** - The extraction prompt was updated to include figure descriptions and MCQ options, but existing 87 questions were extracted with the old prompt. A full re-ingestion is needed (clear DB + Pinecone, then `npm run ingest`).
4. **Pinecone comment in `.env.example` wrong** - Says "768 dimensions" but actual index uses 3072 dimensions.
5. **Topic mismatch** - Dashboard lists 26 official 9702 topics, but questions are categorized into 7 broad topics (Mechanics, Waves, Electricity, Magnetism, Modern Physics, Nuclear Physics, General Physics). These don't match.
6. **Badge variant `success` may not exist** - Dashboard uses `variant="success"` on Badge but shadcn/ui default Badge only has `default`, `secondary`, `destructive`, `outline`.
7. **User email placeholder** - New users get `{clerkId}@placeholder.com` email. Should fetch real email from Clerk.
8. **No error boundary** - No global error handling UI for failed API calls.

## Repository

- **GitHub**: `moosa200/AI-Tutor`
- **Branches**: `main` (primary), `master` (Vercel deploys from this)
- **Both branches are kept in sync** - push to both with `git push origin main && git push origin main:master`

## Live Deployment

- **Vercel**: Auto-deploys from `master` branch
- **Build command**: `prisma generate && next build`
