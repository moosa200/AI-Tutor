import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'

config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

console.log('🔍 Fetching available models...\n')

try {
  const models = await genAI.listModels()

  console.log('📋 Available models:\n')

  const chatModels = []
  const embeddingModels = []

  for (const model of models) {
    const supportedMethods = model.supportedGenerationMethods || []

    if (supportedMethods.includes('generateContent')) {
      chatModels.push(model.name.replace('models/', ''))
    }
    if (supportedMethods.includes('embedContent')) {
      embeddingModels.push(model.name.replace('models/', ''))
    }
  }

  console.log('💬 Chat/Generation models:')
  chatModels.forEach(m => console.log(`   - ${m}`))

  console.log('\n🧠 Embedding models:')
  embeddingModels.forEach(m => console.log(`   - ${m}`))

} catch (error) {
  console.error('❌ Error:', error.message)
}
