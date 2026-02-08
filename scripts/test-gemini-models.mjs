import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'

config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const chatModelsToTest = [
  'gemini-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash-exp',
]

const embeddingModelsToTest = [
  'embedding-001',
  'text-embedding-004',
  'models/embedding-001',
  'models/text-embedding-004',
]

console.log('🧪 Testing chat models...\n')

for (const modelName of chatModelsToTest) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.generateContent('Hi')
    const text = (await result.response).text()
    console.log(`✅ ${modelName} - WORKS`)
  } catch (error) {
    console.log(`❌ ${modelName} - ${error.message.split('\n')[0]}`)
  }
}

console.log('\n🧠 Testing embedding models...\n')

for (const modelName of embeddingModelsToTest) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.embedContent('test')
    console.log(`✅ ${modelName} - WORKS (${result.embedding.values.length} dims)`)
  } catch (error) {
    console.log(`❌ ${modelName} - ${error.message.split('\n')[0]}`)
  }
}
