# TODO - Development Roadmap

## Immediate Priorities (Blocking Issues)

### 1. Re-ingest questions with updated extraction prompt
The extraction prompt in `lib/gemini-parser.ts` was updated to:
- Describe figures/diagrams in `[Figure: ...]` format instead of just flagging `hasImage`
- Include MCQ options (A, B, C, D) for Papers 11-13

**Current 87 questions were extracted with the OLD prompt** (no figure descriptions, no MCQ options). Must re-ingest:

```bash
# 1. Clear all questions from database
# Run inline or create a script:
npx tsx -e "
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
await prisma.attempt.deleteMany({})
await prisma.question.deleteMany({})
console.log('Cleared')
await prisma.\$disconnect()
"

# 2. Clear Pinecone vectors (optional - ingest will overwrite)
# Or just delete and recreate the index

# 3. Re-run ingestion
npm run ingest

# 4. Re-link topics
npx tsx scripts/populate-topics.ts
```

### 2. Fix `.env.example` - leaked credentials
The `.env.example` file contains real database URLs and Clerk API keys. These need to be:
- Replaced with placeholder values (done in this PR)
- Original credentials should be **rotated** (new Supabase password, new Clerk keys)

### 3. Clean up `next.config.js`
Still references old AWS SDK packages in `serverComponentsExternalPackages` that are no longer dependencies:
```javascript
// Remove these - they're from the old AWS Bedrock integration:
'pdf-parse',
'@aws-sdk/client-bedrock-runtime',
'@aws-sdk/core',
'@smithy/core',
'@smithy/middleware-retry',
'@aws-sdk/middleware-logger',
```

### 4. Fix topic categorization mismatch
- **Dashboard**: Lists 26 official 9702 syllabus topics (e.g., "Kinematics", "D.C. Circuits")
- **Questions in DB**: Use 7 broad categories (Mechanics, Waves, Electricity, Magnetism, Modern Physics, Nuclear Physics, General Physics)
- **Topic table**: Has 7 records matching the broad categories

Options:
- a) Update extraction prompt to use the 26 official topic names
- b) Map the 7 broad categories to the 26 detailed topics
- c) Change dashboard to use the 7 broad categories

---

## Phase 1: Core Quality (Question Bank & Accuracy)

### Add more past papers
- [ ] Ingest 2023 papers (all variants)
- [ ] Ingest 2022 papers
- [ ] Ingest 2021 papers
- [ ] Ingest 2020 papers
- [ ] Target: 500+ questions across all topics
- [ ] Ensure all paper types covered: MCQ (11-13), AS Theory (21-23), A2 Theory (41-43), Practical (31-33, 51-53)

### Improve question extraction quality
- [ ] Verify figure descriptions are accurate and detailed enough to answer questions
- [ ] Test MCQ extraction - are all 4 options always captured?
- [ ] Handle questions that span multiple pages
- [ ] Handle questions with tables/data sheets
- [ ] Add validation: compare extracted mark count vs actual marks on paper

### Improve marking accuracy
- [ ] Test marking against known student answers with known scores
- [ ] Handle MCQ marking separately (just check A/B/C/D, not text analysis)
- [ ] Add partial credit logic for multi-part questions
- [ ] Calibrate against official examiner reports

### Chat improvements
- [ ] Persist chat history to database (ChatMessage model already exists)
- [ ] Load previous conversations on page load
- [ ] Add conversation topics/titles
- [ ] Add ability to share/export chat conversations

---

## Phase 2: Learning Features

### Flashcard system
- [ ] Create Flashcard model in Prisma schema
- [ ] Auto-generate flashcards from mark scheme key points
- [ ] Spaced repetition algorithm (SM-2 or similar)
- [ ] Flashcard review interface
- [ ] Track flashcard performance

### Study plan generator
- [ ] Analyze student's weak topics from attempt history
- [ ] Generate personalized study schedule
- [ ] Recommend specific questions to practice
- [ ] Adjust plan based on progress

### Diagnostic assessment
- [ ] Create a mixed-topic test (10-15 questions from different topics)
- [ ] Score and identify knowledge gaps
- [ ] Generate recommended study path
- [ ] Re-test to measure improvement

### Question bookmarking
- [ ] Allow users to bookmark/favourite questions
- [ ] Create a "Review Later" queue
- [ ] Filter practice by bookmarked questions

---

## Phase 3: Advanced Features

### Teacher dashboard
- [ ] Teacher role in User model
- [ ] Class management (invite students)
- [ ] View individual student performance
- [ ] Class-wide analytics (which topics are weakest)
- [ ] Assign specific questions/topics

### Analytics & reporting
- [ ] Detailed progress charts (score over time)
- [ ] Topic mastery heatmap
- [ ] Common mistake analysis (aggregate mistakeTags)
- [ ] Predicted grade based on performance
- [ ] Export reports as PDF

### Timed practice mode
- [ ] Set timer based on marks (1.5 min per mark, like real exams)
- [ ] Auto-submit when time expires
- [ ] Track time-per-question statistics
- [ ] Full paper simulation mode

### Collaborative features
- [ ] Discussion forum per question
- [ ] Share solutions with classmates
- [ ] Leaderboard (opt-in)

---

## Known Bugs to Fix

| # | Bug | File | Severity |
|---|-----|------|----------|
| 1 | `.env.example` has real credentials | `.env.example` | **Critical** |
| 2 | `next.config.js` references removed AWS packages | `next.config.js` | Low |
| 3 | Badge `variant="success"` may not exist in shadcn | `dashboard/page.tsx:293` | Low |
| 4 | User email is placeholder `{clerkId}@placeholder.com` | `dashboard/page.tsx:110`, `submit/route.ts:30` | Medium |
| 5 | Chat history not persisted between sessions | `chat/page.tsx` | Medium |
| 6 | No error UI for failed API calls | All pages | Medium |
| 7 | Topic names in questions don't match 26 syllabus topics | Extraction prompt | Medium |
| 8 | Pinecone dimensions comment says 768, actual is 3072 | `.env.example` | Low |
| 9 | Questions with figures show no visual representation | Practice page | Medium |
| 10 | MCQ questions missing A/B/C/D options | Extraction prompt | High |

---

## Technical Debt

- [ ] Remove `serverComponentsExternalPackages` for AWS/pdf-parse in next.config.js
- [ ] Add proper error boundaries for React components
- [ ] Add loading skeletons to dashboard (currently shows empty state briefly)
- [ ] Implement proper user email fetch from Clerk instead of placeholder
- [ ] Add input validation/sanitization on API routes
- [ ] Add rate limiting to API routes (prevent abuse of Gemini API)
- [ ] Add proper TypeScript types instead of `any` in Prisma where clauses
- [ ] Write unit tests for marking engine
- [ ] Write integration tests for API routes
- [ ] Add Sentry or similar for error monitoring
- [ ] Optimize Pinecone queries with metadata pre-filtering
