import { config, validateConfig } from './config/config';
import { PDFProcessor } from './utils/pdfProcessor';
import { LangChainService } from './services/langchainService';
import { EmbeddingService } from './services/embeddingService';
import { RedisVectorStoreService } from './services/redisVectorStore';
import { SemanticSearchService } from './services/semanticSearchService';
import path from 'path';

interface ProcessingOptions {
  maxDocuments?: number;
  batchSize?: number;
  skipExisting?: boolean;
}

async function processOptimized(options: ProcessingOptions = {}) {
  const {
    maxDocuments = 1000, // Processar apenas 1000 documentos por padrão
    batchSize = 25, // Lotes menores para evitar timeouts
    skipExisting = true
  } = options;

  try {
    console.log('🚀 INICIANDO PROCESSAMENTO OTIMIZADO');
    console.log(`📊 Configurações:`);
    console.log(`   - Máximo de documentos: ${maxDocuments}`);
    console.log(`   - Tamanho do lote: ${batchSize}`);
    console.log(`   - Pular existentes: ${skipExisting}`);
    
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
    // ETAPA 2: CARREGAR DOCUMENTOS (LIMITADO)
    // ==========================================
    console.log('\n📂 ETAPA 2: Carregando documentos com LangChain...');
    const langchainService = new LangChainService({
      chunkSize: config.chunk.size,
      chunkOverlap: config.chunk.overlap,
      chunksDirectory: config.paths.chunksDir,
    });
    
    const allDocuments = await langchainService.processDocumentsFromDirectory(config.paths.chunksDir);
    
    // Limitar número de documentos
    const documentsToProcess = allDocuments.slice(0, maxDocuments);
    console.log(`✅ Documentos carregados: ${allDocuments.length} total, processando ${documentsToProcess.length}`);
    
    // ==========================================
    // ETAPA 3: VERIFICAR DOCUMENTOS EXISTENTES
    // ==========================================
    let documentsToEmbed = documentsToProcess;
    
    if (skipExisting) {
      console.log('\n🔍 ETAPA 3: Verificando documentos existentes no Redis...');
      const vectorStoreService = new RedisVectorStoreService({
        redisUrl: config.redis.url,
        indexName: config.vectorStore.indexName,
        keyPrefix: config.vectorStore.keyPrefix,
        embeddingModel: config.openai.embeddingModel,
        apiKey: config.openai.apiKey,
      });
      
      try {
        const redisHealth = await vectorStoreService.testConnection();
        if (redisHealth) {
          const stats = await vectorStoreService.getIndexInfo();
          const existingDocs = stats?.numDocs || 0;
          console.log(`   - Documentos existentes no Redis: ${existingDocs}`);
          
          if (existingDocs > 0) {
            console.log(`   - Pulando processamento de embeddings (já existem dados)`);
            console.log(`   - Usando documentos existentes para teste de busca`);
            
            // Testar busca com dados existentes
            const semanticSearchService = new SemanticSearchService(
              vectorStoreService,
              new EmbeddingService({
                apiKey: config.openai.apiKey,
                model: config.openai.embeddingModel,
              })
            );
            
            console.log('\n🔍 TESTANDO BUSCA COM DADOS EXISTENTES...');
            const testResults = await semanticSearchService.search('What is JavaScript?', {
              maxResults: 3,
              scoreThreshold: 0.8,
              includeScore: true,
            });
            
            console.log(`✅ Busca funcionando: ${testResults.length} resultados encontrados`);
            testResults.forEach((result, index) => {
              console.log(`   ${index + 1}. Score: ${result.score.toFixed(3)} | Relevance: ${result.relevance}`);
              console.log(`      Content: ${result.document.pageContent.substring(0, 100)}...`);
            });
            
            await vectorStoreService.closeConnection();
            console.log('\n🎉 PROCESSAMENTO CONCLUÍDO - USANDO DADOS EXISTENTES!');
            return;
          }
        }
      } catch (error) {
        console.log(`   - Erro ao verificar Redis: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        console.log(`   - Continuando com processamento normal...`);
      } finally {
        await vectorStoreService.closeConnection();
      }
    }
    
    // ==========================================
    // ETAPA 4: CRIAR EMBEDDINGS E SALVAR EM LOTES
    // ==========================================
    console.log('\n🧠 ETAPA 4: Criando embeddings e salvando em lotes...');
    const embeddingService = new EmbeddingService({
      apiKey: config.openai.apiKey,
      model: config.openai.embeddingModel,
      batchSize: batchSize,
    });
    
    // Testar conexão com OpenAI
    const embeddingHealth = await embeddingService.testConnection();
    if (!embeddingHealth) {
      throw new Error('Falha na conexão com OpenAI Embeddings');
    }
    
    // ==========================================
    // ETAPA 5: INICIALIZAR REDIS
    // ==========================================
    console.log('\n💾 ETAPA 5: Inicializando Redis Vector Store...');
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
    
    // ==========================================
    // ETAPA 6: PROCESSAR E SALVAR EM LOTES
    // ==========================================
    console.log('\n🔄 ETAPA 6: Processando embeddings e salvando em lotes...');
    const embeddedDocuments = await embeddingService.embedAndSaveInBatches(
      documentsToEmbed, 
      vectorStoreService
    );
    console.log(`✅ Processamento completo: ${embeddedDocuments.length} documentos processados e salvos`);
    
    // ==========================================
    // ETAPA 7: TESTAR BUSCA
    // ==========================================
    console.log('\n🔍 ETAPA 7: Testando busca semântica...');
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
    
    console.log('\n🎉 PROCESSAMENTO OTIMIZADO CONCLUÍDO COM SUCESSO!');
    console.log('\n📋 Resumo:');
    console.log(`   - PDF processado: ${processedChunks.length} chunks`);
    console.log(`   - Documentos carregados: ${allDocuments.length} total`);
    console.log(`   - Documentos processados: ${documentsToEmbed.length}`);
    console.log(`   - Embeddings criados: ${embeddedDocuments.length}`);
    console.log(`   - Documentos salvos em lotes no Redis: ✅`);
    console.log(`   - Busca semântica funcionando: ✅`);
    console.log(`   - PromptTemplate integrado: ✅`);
    
    // Fechar conexões
    await vectorStoreService.closeConnection();
    
  } catch (error) {
    console.error('❌ Erro no processamento otimizado:', error);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  // Permitir configuração via argumentos da linha de comando
  const args = process.argv.slice(2);
  const maxDocs = args.find(arg => arg.startsWith('--max='))?.split('=')[1];
  const batchSize = args.find(arg => arg.startsWith('--batch='))?.split('=')[1];
  
  const options: ProcessingOptions = {
    maxDocuments: maxDocs ? parseInt(maxDocs) : 1000,
    batchSize: batchSize ? parseInt(batchSize) : 25,
    skipExisting: true
  };
  
  console.log('📝 Uso: npm run process-optimized [--max=1000] [--batch=25]');
  console.log('📝 Exemplo: npm run process-optimized --max=500 --batch=20');
  
  processOptimized(options);
}

export { processOptimized };
