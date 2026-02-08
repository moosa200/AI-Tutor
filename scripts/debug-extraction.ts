import 'dotenv/config'
import { extractQuestionsFromPDF } from '../lib/gemini-parser'
import { extractMarkSchemeFromPDF } from '../lib/gemini-parser-markscheme'

async function debugExtraction() {
  const paperPath = 'E:\\A level chatbot\\data\\past-papers\\2024\\9702_w24_qp_22.pdf'
  const msPath = 'E:\\A level chatbot\\data\\past-papers\\2024\\9702_w24_ms_22.pdf'

  console.log('🔍 Extracting questions from Paper 22...\n')
  const questions = await extractQuestionsFromPDF(paperPath)

  console.log('\n📋 Question numbers extracted:')
  questions.forEach((q, i) => {
    console.log(`  ${i + 1}. "${q.questionNumber}" (${q.marks} marks)`)
  })

  console.log('\n\n🔍 Extracting mark schemes from Paper 22...\n')
  const markSchemes = await extractMarkSchemeFromPDF(msPath)

  console.log('\n📋 Mark scheme question numbers extracted:')
  markSchemes.forEach((ms, i) => {
    console.log(`  ${i + 1}. "${ms.questionNumber}"`)
  })

  console.log('\n\n🔄 Comparing...')
  console.log(`Questions: ${questions.length}`)
  console.log(`Mark Schemes: ${markSchemes.length}`)

  const msSet = new Set(markSchemes.map(ms => ms.questionNumber))
  const unmatched = questions.filter(q => !msSet.has(q.questionNumber))

  console.log(`\n❌ Unmatched questions (${unmatched.length}):`)
  unmatched.forEach(q => console.log(`  - "${q.questionNumber}"`))
}

debugExtraction().catch(console.error)
