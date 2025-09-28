import { config, validateConfig } from './config/config';
import { PDFProcessor } from './utils/pdfProcessor';
import { LangChainService } from './services/langchainService';
import { EmbeddingService } from './services/embeddingService';
import { RedisVectorStoreService } from './services/redisVectorStore';
import { SemanticSearchService } from './services/semanticSearchService';
import path from 'path';

async function testPipeline() {
  try {
    console.log('🧪 TESTE DO PIPELINE - VERSÃO REDUZIDA');
    
    // Validar configurações
    validateConfig();
    
    // ==========================================
    // ETAPA 1: PROCESSAR APENAS 1 CHUNK
    // ==========================================
    console.log('\n📄 ETAPA 1: Processando PDF (apenas 1 chunk)...');
    const pdfPath = path.join(config.paths.tmpDir, 'JavaScript The Definitive Guide (David Flanagan).pdf');
    const pdfProcessor = new PDFProcessor(config.paths.chunksDir);
    
    // Processar apenas 1 chunk para teste
    const processedChunks = await pdfProcessor.processPDFToChunks(
      pdfPath,
      600, // chunk size
      100, // overlap
      'json'
    );
    
    // Pegar apenas o primeiro chunk
    const firstChunk = processedChunks[0];
    console.log(`✅ PDF processado: ${processedChunks.length} chunks criados`);
    console.log(`📄 Usando apenas o primeiro chunk para teste`);
    
    // ==========================================
    // ETAPA 2: CRIAR DOCUMENTO LANGCHAIN
    // ==========================================
    console.log('\n📂 ETAPA 2: Criando documento LangChain...');
    const langchainService = new LangChainService({
      chunkSize: 600,
      chunkOverlap: 100,
      chunksDirectory: config.paths.chunksDir,
    });
    
    // Criar um documento manualmente
    const testDocument = {
      pageContent: firstChunk.content,
      metadata: {
        source: firstChunk.metadata.source,
        page: firstChunk.metadata.page,
        chunkIndex: firstChunk.metadata.chunkIndex,
        totalChunks: firstChunk.metadata.totalChunks,
        id: firstChunk.id
      }
    };
    
    console.log(`✅ Documento criado:`, {
      content: testDocument.pageContent.substring(0, 100) + '...',
      metadata: testDocument.metadata
    });
    
    // ==========================================
    // ETAPA 3: CRIAR EMBEDDING
    // ==========================================
    console.log('\n🧠 ETAPA 3: Criando embedding...');
    const embeddingService = new EmbeddingService({
      apiKey: config.openai.apiKey,
      model: config.openai.embeddingModel,
    });
    
    // Testar conexão
    const embeddingHealth = await embeddingService.testConnection();
    if (!embeddingHealth) {
      throw new Error('Falha na conexão com OpenAI Embeddings');
    }
    
    // Criar embedding para o documento
    const embeddedDocument = await embeddingService.embedDocuments([testDocument]);
    console.log(`✅ Embedding criado: ${embeddedDocument.length} documento com embedding`);
    
    // ==========================================
    // ETAPA 4: SALVAR NO REDIS
    // ==========================================
    console.log('\n💾 ETAPA 4: Salvando no Redis...');
    const vectorStoreService = new RedisVectorStoreService({
      redisUrl: config.redis.url,
      indexName: config.vectorStore.indexName,
      keyPrefix: config.vectorStore.keyPrefix,
      embeddingModel: config.openai.embeddingModel,
      apiKey: config.openai.apiKey,
    });
    
    // Testar conexão Redis
    const redisHealth = await vectorStoreService.testConnection();
    if (!redisHealth) {
      throw new Error('Falha na conexão com Redis');
    }
    
    // Salvar documento
    await vectorStoreService.storeDocuments(embeddedDocument);
    console.log(`✅ Documento salvo no Redis!`);
    
    // ==========================================
    // ETAPA 5: TESTAR BUSCA
    // ==========================================
    console.log('\n🔍 ETAPA 5: Testando busca...');
    const semanticSearchService = new SemanticSearchService(
      vectorStoreService,
      embeddingService
    );
    
    // Testar busca
    const searchResults = await semanticSearchService.search('What is JavaScript?', {
      maxResults: 3,
      scoreThreshold: 0.8,
      includeScore: true,
    });
    
    console.log(`✅ Busca concluída: ${searchResults.length} resultados`);
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. Score: ${result.score.toFixed(3)} | Relevance: ${result.relevance}`);
      console.log(`      Content: ${result.document.pageContent.substring(0, 100)}...`);
    });
    
    // Fechar conexões
    await vectorStoreService.closeConnection();
    
    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executar teste
if (require.main === module) {
  testPipeline();
}

export { testPipeline };
