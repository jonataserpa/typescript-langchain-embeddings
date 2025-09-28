import { config, validateConfig } from './config/config';
import { PDFProcessor } from './utils/pdfProcessor';
import { LangChainService } from './services/langchainService';
import { EmbeddingService } from './services/embeddingService';
import { RedisVectorStoreService } from './services/redisVectorStore';
import { SemanticSearchService } from './services/semanticSearchService';
import { PromptService } from './services/promptService';
import { Document } from 'langchain/document';
import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

interface ProcessedChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page: number;
    chunkIndex: number;
    totalChunks: number;
    fileName: string;
  };
}

async function processAllChunks() {
  try {
    console.log('🚀 INICIANDO PROCESSAMENTO COMPLETO DE TODOS OS CHUNKS');
    console.log('=' .repeat(80));
    
    // Validar configurações
    validateConfig();
    
    // ==========================================
    // ETAPA 1: VERIFICAR CHUNKS EXISTENTES
    // ==========================================
    console.log('\n📁 ETAPA 1: Verificando chunks existentes...');
    const chunksDir = config.paths.chunksDir;
    const chunkFiles = fs.readdirSync(chunksDir).filter(file => file.endsWith('.json'));
    console.log(`   - Total de arquivos de chunks encontrados: ${chunkFiles.length}`);
    
    if (chunkFiles.length === 0) {
      throw new Error('Nenhum chunk encontrado. Execute primeiro o processamento do PDF.');
    }
    
    // ==========================================
    // ETAPA 2: INICIALIZAR SERVIÇOS
    // ==========================================
    console.log('\n🔧 ETAPA 2: Inicializando serviços...');
    
    const embeddingService = new EmbeddingService({
      apiKey: config.openai.apiKey,
      model: config.openai.embeddingModel,
      batchSize: 50, // Lotes menores para evitar timeouts
    });
    
    const vectorStoreService = new RedisVectorStoreService({
      redisUrl: config.redis.url,
      indexName: config.vectorStore.indexName,
      keyPrefix: config.vectorStore.keyPrefix,
      embeddingModel: config.openai.embeddingModel,
      apiKey: config.openai.apiKey,
    });
    
    const promptService = new PromptService({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000
    });
    
    const semanticSearchService = new SemanticSearchService(
      vectorStoreService,
      embeddingService,
      promptService
    );
    
    // Testar conexões
    console.log('   - Testando conexão com Redis...');
    const redisHealth = await vectorStoreService.testConnection();
    if (!redisHealth) {
      throw new Error('Falha na conexão com Redis');
    }
    console.log('   ✅ Redis conectado');
    
    console.log('   - Testando conexão com OpenAI...');
    const embeddingHealth = await embeddingService.testConnection();
    if (!embeddingHealth) {
      throw new Error('Falha na conexão com OpenAI');
    }
    console.log('   ✅ OpenAI conectado');
    
    // ==========================================
    // ETAPA 3: VERIFICAR STATUS ATUAL DO REDIS
    // ==========================================
    console.log('\n🔍 ETAPA 3: Verificando status atual do Redis...');
    const indexInfo = await vectorStoreService.getIndexInfo();
    const currentDocs = indexInfo?.numDocs || 0;
    console.log(`   - Documentos atualmente no Redis: ${currentDocs}`);
    console.log(`   - Chunks para processar: ${chunkFiles.length}`);
    
    if (currentDocs >= chunkFiles.length) {
      console.log('   ℹ️ Todos os chunks já estão processados no Redis!');
      console.log('   - Testando busca semântica...');
      
      const testQuery = "JavaScript programming language";
      const results = await semanticSearchService.search(testQuery, { maxResults: 3 });
      console.log(`   ✅ Busca funcionando: ${results.length} resultados encontrados`);
      
      await vectorStoreService.closeConnection();
      return;
    }
    
    // ==========================================
    // ETAPA 4: PROCESSAR CHUNKS COM STREAMS
    // ==========================================
    console.log('\n📦 ETAPA 4: Processando chunks com streams...');
    
    const batchSize = 100; // Processar 100 chunks por vez
    const totalBatches = Math.ceil(chunkFiles.length / batchSize);
    let processedCount = 0;
    let savedCount = 0;
    
    console.log(`   - Total de lotes: ${totalBatches}`);
    console.log(`   - Chunks por lote: ${batchSize}`);
    console.log(`   - Processamento sob demanda com logs detalhados`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchNumber = batchIndex + 1;
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, chunkFiles.length);
      const batchFiles = chunkFiles.slice(startIndex, endIndex);
      
      console.log(`\n📦 PROCESSANDO LOTE ${batchNumber}/${totalBatches}`);
      console.log(`   - Chunks: ${startIndex + 1} a ${endIndex} (${batchFiles.length} chunks)`);
      console.log(`   - Arquivos: ${batchFiles.slice(0, 3).join(', ')}${batchFiles.length > 3 ? '...' : ''}`);
      
      try {
        // Carregar chunks do lote
        const batchChunks: ProcessedChunk[] = [];
        for (const file of batchFiles) {
          const filePath = path.join(chunksDir, file);
          const chunkData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          batchChunks.push(chunkData);
        }
        
        console.log(`   - Chunks carregados: ${batchChunks.length}`);
        
        // Converter para documentos LangChain
        const documents: Document[] = batchChunks.map(chunk => {
          return new Document({
            pageContent: chunk.content,
            metadata: {
              source: chunk.metadata.source,
              page: chunk.metadata.page,
              chunkIndex: chunk.metadata.chunkIndex,
              totalChunks: chunk.metadata.totalChunks,
              fileName: chunk.metadata.fileName,
              id: chunk.id
            }
          });
        });
        
        console.log(`   - Documentos LangChain criados: ${documents.length}`);
        
        // Criar embeddings e salvar em lotes menores
        const embeddingBatchSize = 25; // Lotes ainda menores para embeddings
        const embeddingBatches = Math.ceil(documents.length / embeddingBatchSize);
        
        console.log(`   - Criando embeddings em ${embeddingBatches} sub-lotes de ${embeddingBatchSize}...`);
        
        for (let embIndex = 0; embIndex < embeddingBatches; embIndex++) {
          const embStart = embIndex * embeddingBatchSize;
          const embEnd = Math.min(embStart + embeddingBatchSize, documents.length);
          const embBatch = documents.slice(embStart, embEnd);
          
          console.log(`     📦 Sub-lote de embedding ${embIndex + 1}/${embeddingBatches} (${embBatch.length} docs)...`);
          
          try {
            // Criar embeddings
            const embeddedDocs = await embeddingService.embedDocuments(embBatch);
            console.log(`     ✅ Embeddings criados: ${embeddedDocs.length}`);
            
            // Salvar no Redis
            console.log(`     💾 Salvando no Redis...`);
            await vectorStoreService.storeDocuments(embeddedDocs);
            console.log(`     ✅ Salvos no Redis: ${embeddedDocs.length} documentos`);
            
            savedCount += embeddedDocs.length;
            
          } catch (error) {
            console.error(`     ❌ Erro no sub-lote de embedding ${embIndex + 1}:`, error);
            throw error;
          }
        }
        
        processedCount += documents.length;
        
        console.log(`   ✅ LOTE ${batchNumber} CONCLUÍDO:`);
        console.log(`     - Chunks processados: ${documents.length}`);
        console.log(`     - Total processado: ${processedCount}/${chunkFiles.length} (${Math.round((processedCount / chunkFiles.length) * 100)}%)`);
        console.log(`     - Total salvos no Redis: ${savedCount}`);
        
        // Verificar status do Redis a cada lote
        const currentIndexInfo = await vectorStoreService.getIndexInfo();
        const currentRedisDocs = currentIndexInfo?.numDocs || 0;
        console.log(`     - Documentos no Redis: ${currentRedisDocs}`);
        
        // Pequena pausa entre lotes
        if (batchNumber < totalBatches) {
          console.log(`     ⏳ Aguardando 2 segundos antes do próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`   ❌ Erro no lote ${batchNumber}:`, error);
        throw error;
      }
    }
    
    // ==========================================
    // ETAPA 5: VERIFICAÇÃO FINAL
    // ==========================================
    console.log('\n🔍 ETAPA 5: Verificação final...');
    
    const finalIndexInfo = await vectorStoreService.getIndexInfo();
    const finalDocs = finalIndexInfo?.numDocs || 0;
    
    console.log(`   - Chunks processados: ${processedCount}`);
    console.log(`   - Documentos salvos no Redis: ${savedCount}`);
    console.log(`   - Documentos no índice Redis: ${finalDocs}`);
    
    if (finalDocs < chunkFiles.length) {
      console.log(`   ⚠️ ATENÇÃO: Esperado ${chunkFiles.length} documentos, mas apenas ${finalDocs} estão no Redis`);
    } else {
      console.log(`   ✅ SUCESSO: Todos os ${chunkFiles.length} chunks foram processados e salvos!`);
    }
    
    // ==========================================
    // ETAPA 6: TESTE DE BUSCA
    // ==========================================
    console.log('\n🔍 ETAPA 6: Testando busca semântica...');
    
    const testQueries = [
      'JavaScript programming language',
      'functions and variables',
      'DOM manipulation',
      'async programming',
      'objects and arrays'
    ];
    
    for (const query of testQueries) {
      console.log(`\n   🔍 Testando: "${query}"`);
      const results = await semanticSearchService.search(query, { 
        maxResults: 3, 
        scoreThreshold: 0.8 
      });
      console.log(`     - Resultados: ${results.length}`);
      if (results.length > 0) {
        console.log(`     - Melhor score: ${results[0].score.toFixed(3)}`);
        console.log(`     - Preview: ${results[0].document.pageContent.substring(0, 100)}...`);
      }
    }
    
    // ==========================================
    // ETAPA 7: TESTE COM PROMPT TEMPLATE
    // ==========================================
    console.log('\n🤖 ETAPA 7: Testando PromptTemplate...');
    
    const testQuestion = "O que é JavaScript e para que serve?";
    console.log(`   ❓ Pergunta: "${testQuestion}"`);
    
    const answer = await semanticSearchService.askQuestion(testQuestion, {
      maxResults: 5,
      scoreThreshold: 0.8
    });
    
    console.log(`   ✅ Resposta gerada:`);
    console.log(`     - Relevante: ${answer.isRelevant}`);
    console.log(`     - Confiança: ${answer.confidence}`);
    console.log(`     - Fontes: ${answer.sources.length}`);
    console.log(`     - Resposta: ${answer.answer.substring(0, 200)}...`);
    
    console.log('\n🎉 PROCESSAMENTO COMPLETO FINALIZADO COM SUCESSO!');
    console.log('=' .repeat(80));
    console.log(`📊 RESUMO FINAL:`);
    console.log(`   - Chunks processados: ${processedCount}`);
    console.log(`   - Documentos salvos no Redis: ${savedCount}`);
    console.log(`   - Documentos no índice: ${finalDocs}`);
    console.log(`   - Busca semântica: ✅`);
    console.log(`   - PromptTemplate: ✅`);
    
    await vectorStoreService.closeConnection();
    
  } catch (error) {
    console.error('❌ Erro no processamento completo:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  processAllChunks();
}
