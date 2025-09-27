import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
  },
  chunk: {
    size: parseInt(process.env.CHUNK_SIZE || '600'),
    overlap: parseInt(process.env.CHUNK_OVERLAP || '100'),
  },
  paths: {
    tmpDir: '/home/jonata/Documentos/typescript-langchain/tmp',
    chunksDir: '/home/jonata/Documentos/typescript-langchain/chunks',
  },
  vectorStore: {
    indexName: 'javascript_guide_vectors',
    keyPrefix: 'js_guide:',
  },
};

// Validação das configurações obrigatórias
export function validateConfig() {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY é obrigatório. Configure no arquivo .env');
  }
  
  if (!config.redis.url) {
    throw new Error('REDIS_URL é obrigatório. Configure no arquivo .env');
  }
}
