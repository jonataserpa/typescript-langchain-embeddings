import { config, validateConfig } from './config/config';
import { PDFProcessor } from './utils/pdfProcessor';
import { LangChainService } from './services/langchainService';
import { EmbeddingService } from './services/embeddingService';
import { RedisVectorStoreService } from './services/redisVectorStore';
import { SemanticSearchService } from './services/semanticSearchService';
import path from 'path';

async function main() {
  try {
    console.log('🚀 Iniciando pipeline completo de processamento e busca semântica...');
    
    // Validar configurações
    validateConfig();
    
    // ==========================================
    // ETAPA 1: PROCESSAR PDF
    // ==========================================
    console.log('\n📄 ETAPA 1: Processando PDF...');
    const pdfPath = path.join(config.paths.tmpDir, 'JavaScript The Definitive Guide (David Flanagan).pdf');
    const pdfProcessor = new PDFProcessor(config.paths.chunksDir);
    
    const processedChunks = await pdfProcessor.processPDFToChunks(
      pdfPath,
      config.chunk.size,
      config.chunk.overlap,
      'json'
    );
    
    console.log(`✅ PDF processado: ${processedChunks.length} chunks criados`);
    
    // ==========================================
    // ETAPA 2: LOAD - CARREGAR DOCUMENTOS
    // ==========================================
    console.log('\n📂 ETAPA 2: Carregando documentos com LangChain...');
    const langchainService = new LangChainService({
      chunkSize: config.chunk.size,
      chunkOverlap: config.chunk.overlap,
      chunksDirectory: config.paths.chunksDir,
    });
    
    const documents = await langchainService.processDocumentsFromDirectory(config.paths.chunksDir);
    console.log(`✅ Documentos carregados: ${documents.length} documentos`);
    
    // ==========================================
    // ETAPA 3: EMBED - CRIAR EMBEDDINGS
    // ==========================================
    console.log('\n🧠 ETAPA 3: Criando embeddings com OpenAI...');
    const embeddingService = new EmbeddingService({
      apiKey: config.openai.apiKey,
      model: config.openai.embeddingModel,
      batchSize: 50, // Processar em lotes menores para evitar rate limits
    });
    
    // Testar conexão com OpenAI
    const embeddingHealth = await embeddingService.testConnection();
    if (!embeddingHealth) {
      throw new Error('Falha na conexão com OpenAI Embeddings');
    }
    
    const embeddedDocuments = await embeddingService.embedDocuments(documents);
    console.log(`✅ Embeddings criados: ${embeddedDocuments.length} documentos com embeddings`);
    
    // ==========================================
    // ETAPA 4: STORE - ARMAZENAR NO REDIS
    // ==========================================
    console.log('\n💾 ETAPA 4: Armazenando no Redis Vector Store...');
    const vectorStoreService = new RedisVectorStoreService({
      redisUrl: config.redis.url,
      indexName: config.vectorStore.indexName,
      keyPrefix: config.vectorStore.keyPrefix,
      embeddingModel: config.openai.embeddingModel,
      apiKey: config.openai.apiKey,
    });
    
    // Testar conexão com Redis
    const redisHealth = await vectorStoreService.testConnection();
    if (!redisHealth) {
      throw new Error('Falha na conexão com Redis');
    }
    
    await vectorStoreService.storeDocuments(embeddedDocuments);
    console.log(`✅ Documentos armazenados no Redis Vector Store`);
    
    // ==========================================
    // ETAPA 5: RETRIEVE - BUSCA SEMÂNTICA
    // ==========================================
    console.log('\n🔍 ETAPA 5: Testando busca semântica...');
    const semanticSearchService = new SemanticSearchService(
      vectorStoreService,
      embeddingService
    );
    
    // Health check completo
    const healthCheck = await semanticSearchService.healthCheck();
    console.log('🏥 Health Check:', healthCheck);
    
    // Estatísticas do sistema
    const stats = await semanticSearchService.getSearchStatistics();
    console.log('📊 Estatísticas do sistema:', stats);
    
    // Testar algumas buscas
    const testQueries = [
      'What is JavaScript?',
      'How to define functions in JavaScript?',
      'JavaScript objects and properties',
      'DOM manipulation',
      'async programming',
    ];
    
    console.log('\n🧪 Testando buscas semânticas:');
    for (const query of testQueries) {
      console.log(`\n🔍 Buscando: "${query}"`);
      const results = await semanticSearchService.search(query, {
        maxResults: 3,
        scoreThreshold: 0.8,
        includeScore: true,
      });
      
      console.log(`   Resultados encontrados: ${results.length}`);
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. Score: ${result.score.toFixed(3)} | Relevance: ${result.relevance}`);
        console.log(`      Preview: ${result.document.pageContent.substring(0, 100)}...`);
      });
    }
    
    console.log('\n🎉 Pipeline completo executado com sucesso!');
    console.log('\n📋 Resumo:');
    console.log(`   - PDF processado: ${processedChunks.length} chunks`);
    console.log(`   - Documentos carregados: ${documents.length}`);
    console.log(`   - Embeddings criados: ${embeddedDocuments.length}`);
    console.log(`   - Documentos armazenados no Redis: ✅`);
    console.log(`   - Busca semântica funcionando: ✅`);
    
    // Fechar conexões
    await vectorStoreService.closeConnection();
    
  } catch (error) {
    console.error('❌ Erro no pipeline:', error);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  main();
}

export { main };
