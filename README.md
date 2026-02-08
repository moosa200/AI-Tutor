# A Level Physics 9702 Exam Prep Platform

AI-powered exam preparation platform for Cambridge A Level Physics (9702) with past paper practice, AI tutoring, and personalized feedback.

## Features

- **AI Tutor**: Chat with an AI tutor specialized in A Level Physics 9702 syllabus
- **Practice Questions**: Access past paper questions organized by topic
- **AI Marking**: Get instant marking with detailed feedback using real mark schemes
- **Progress Tracking**: Identify weak areas and track improvement

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma ORM + PostgreSQL
- Clerk (authentication)
- Pinecone (vector database for RAG)
- Anthropic Claude API (tutoring + marking)
- OpenAI API (embeddings)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `CLERK_SECRET_KEY`: Clerk secret key
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude
- `OPENAI_API_KEY`: OpenAI API key for embeddings
- `PINECONE_API_KEY`: Pinecone API key
- `PINECONE_INDEX`: Pinecone index name (default: physics-questions)

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio
npm run db:studio
```

### 4. Ingest Questions (RAG)

Add your question data to:
- `data/questions/*.json` - JSON files with question data
- `data/pdfs/*.pdf` - PDF past papers (optional)

See `data/questions/sample.json` for the expected format.

Then run the ingestion script:

```bash
npm run ingest
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/           # Chat API (Claude streaming)
│   │   ├── practice/       # Marking API
│   │   └── rag/            # RAG search API
│   ├── chat/               # Chat interface
│   ├── dashboard/          # Student dashboard
│   ├── practice/           # Practice questions interface
│   ├── sign-in/            # Clerk sign-in
│   └── sign-up/            # Clerk sign-up
├── components/
│   ├── chat/               # Chat components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── rag/                # RAG pipeline
│   │   ├── embeddings.ts   # OpenAI embeddings
│   │   ├── ingest.ts       # Ingestion script
│   │   ├── parser.ts       # PDF parsing
│   │   ├── pinecone.ts     # Pinecone client
│   │   └── search.ts       # Vector search
│   ├── claude.ts           # Claude API client
│   ├── db.ts               # Prisma client
│   ├── marking.ts          # Marking logic
│   └── utils.ts            # Utilities
├── prisma/
│   └── schema.prisma       # Database schema
└── data/
    └── questions/          # Question data files
```

## API Endpoints

- `POST /api/chat` - Chat with AI tutor (streaming)
- `POST /api/practice/submit` - Submit answer for marking
- `POST /api/rag/search` - Search similar questions

## Adding Questions

Questions can be added via:

1. **JSON files**: Add to `data/questions/` directory
2. **PDF parsing**: Add PDFs to `data/pdfs/` directory
3. **Database**: Insert directly into the `Question` table

JSON format:
```json
{
  "year": 2023,
  "paper": "Paper 2",
  "questionNumber": "1a",
  "topic": "Mechanics",
  "text": "Question text here...",
  "markScheme": "Mark scheme points...",
  "examinerRemarks": "Optional examiner tips",
  "marks": 4,
  "difficulty": "medium"
}
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Make sure to set all environment variables in your Vercel project settings.

## License

MIT
