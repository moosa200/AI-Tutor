# Setup Guide

## Prerequisites

- Node.js 18+ and npm
- A PostgreSQL database (Supabase free tier recommended)
- Google Cloud account (for Gemini API key)
- Clerk account (for authentication)
- Pinecone account (for vector database)

## 1. Clone and Install

```bash
git clone https://github.com/moosa200/AI-Tutor.git
cd AI-Tutor
npm install
```

## 2. Environment Variables

Create a `.env` file in the project root with the following:

```env
# ── Database (PostgreSQL) ──────────────────────────────────
# Supabase connection string with pgbouncer for serverless
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# ── Clerk Authentication ───────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ── Google Gemini (FREE tier) ──────────────────────────────
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key

# ── Pinecone Vector Database ──────────────────────────────
# Get from: https://app.pinecone.io/
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=physics-questions-gemini
PINECONE_HOST=your-index-host.svc.pinecone.io
PINECONE_ENVIRONMENT=us-east-1
```

## 3. API Keys Setup

### Google Gemini (Free)
1. Go to https://aistudio.google.com/app/apikey
2. Create an API key
3. No billing required - uses free tier
4. Models used: `gemini-2.0-flash` (chat/marking/parsing), `gemini-embedding-001` (embeddings)

### Clerk Authentication
1. Go to https://clerk.com and create an application
2. Enable email/password and/or OAuth providers
3. Copy the publishable key and secret key
4. Set redirect URLs in Clerk dashboard to match the env vars above

### Pinecone Vector Database
1. Go to https://app.pinecone.io and create a free account
2. Create an index with these settings:
   - **Name**: `physics-questions-gemini`
   - **Dimensions**: `3072` (required for Gemini embedding-001)
   - **Metric**: `cosine`
   - **Cloud/Region**: Any (AWS us-east-1 recommended)
3. Copy the API key and host URL from the index dashboard

### Supabase PostgreSQL
1. Go to https://supabase.com and create a new project
2. Go to Settings > Database > Connection string
3. Copy the "Connection pooling" URI (with pgbouncer)
4. Replace `[YOUR-PASSWORD]` with your database password
5. URL-encode special characters in the password (e.g., `#` becomes `%23`)

## 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# (Optional) View database in browser
npx prisma studio
```

### Database Models Created
- `User` - Clerk user records
- `Topic` - Physics syllabus topics (AS/A2)
- `Question` - Past paper questions with mark schemes
- `Attempt` - Student answer submissions with scores
- `ChatMessage` - Chat history (schema exists, not yet used for persistence)

## 5. Ingest Past Papers (Optional)

If you have Cambridge 9702 past paper PDFs:

```bash
# Place PDFs in the expected structure:
# data/past-papers/
#   2024/
#     9702_s24_qp_12.pdf    (question paper)
#     9702_s24_ms_12.pdf    (mark scheme)
#   2023/
#     9702_s23_qp_42.pdf
#     9702_s23_ms_42.pdf

# File naming: 9702_[session][year]_[qp|ms]_[paper-number].pdf
# Sessions: s = summer, w = winter, m = March

# Run ingestion (processes all papers found)
npm run ingest

# Or test with first paper only
npm run ingest:test
```

The pipeline will:
1. Extract questions from QP PDFs using Gemini multimodal
2. Extract mark schemes from MS PDFs
3. Merge questions with their mark schemes
4. Save to PostgreSQL
5. Generate 3072-dim embeddings via Gemini
6. Upload vectors to Pinecone

After ingestion, populate topic relationships:
```bash
npx tsx scripts/populate-topics.ts
```

## 6. Run Locally

```bash
npm run dev
```

Open http://localhost:3000. You'll see the landing page. Sign up via Clerk to access the dashboard.

## 7. Deploy to Vercel

### First-time Setup
1. Push code to GitHub
2. Go to https://vercel.com and import the repository
3. Add all environment variables from `.env` to Vercel project settings
4. Deploy

### Build Configuration
- **Build Command**: `prisma generate && next build` (already set in package.json)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)
- **Node.js Version**: 18.x

### Subsequent Deployments
Push to the `master` branch. Vercel auto-deploys.

```bash
git push origin main && git push origin main:master
```

### Important Vercel Notes
- `prisma generate` must run before `next build` (already configured in build script)
- All env vars must be set in Vercel project settings (they're not read from `.env`)
- The app uses serverless functions for API routes

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production (prisma generate + next build)
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio (DB browser)
npm run ingest       # Run full paper ingestion
npm run ingest:test  # Ingest first paper only (for testing)
```

## Troubleshooting

### "API key not valid" during ingestion
- Scripts need `import 'dotenv/config'` at the top to load `.env`
- The ingest script already has this, but custom scripts may not

### Prisma generate EPERM error on Windows
- Another process has the DLL locked
- Close VS Code or other Node processes, then retry
- Or run `npx next build` separately (Prisma client may already be generated)

### Pinecone dimension mismatch
- The index MUST be 3072 dimensions for Gemini embedding-001
- If you created it with 768, delete and recreate with 3072
- Use `scripts/recreate-pinecone-index.ts` to automate this

### Build fails on Vercel with Prisma error
- Ensure build script is `"prisma generate && next build"` in package.json
- Ensure all env vars are set in Vercel project settings
