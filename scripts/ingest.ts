import 'dotenv/config'
import { ingestAllPapers } from '../lib/rag/ingest-pipeline'

const testMode = process.argv.includes('--test')

ingestAllPapers(testMode).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
