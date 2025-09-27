import { config, validateConfig } from './config/config';
import { EmbeddingService } from './services/embeddingService';
import { RedisVectorStoreService } from './services/redisVectorStore';
import { SemanticSearchService } from './services/semanticSearchService';
import readline from 'readline';

async function interactiveSearch() {
  try {
    console.log('🔍 Iniciando busca semântica interativa...');
    
    // Validar configurações
    validateConfig();
    
    // Inicializar serviços
    const embeddingService = new EmbeddingService({
      apiKey: config.openai.apiKey,
      model: config.openai.embeddingModel,
    });
    
    const vectorStoreService = new RedisVectorStoreService({
      redisUrl: config.redis.url,
      indexName: config.vectorStore.indexName,
      keyPrefix: config.vectorStore.keyPrefix,
      embeddingModel: config.openai.embeddingModel,
      apiKey: config.openai.apiKey,
    });
    
    const semanticSearchService = new SemanticSearchService(
      vectorStoreService,
      embeddingService
    );
    
    // Verificar saúde dos serviços
    const healthCheck = await semanticSearchService.healthCheck();
    if (!healthCheck.vectorStore || !healthCheck.embedding || !healthCheck.redis) {
      console.error('❌ Serviços não estão funcionando corretamente:', healthCheck);
      process.exit(1);
    }
    
    console.log('✅ Todos os serviços estão funcionando!');
    
    // Obter estatísticas
    const stats = await semanticSearchService.getSearchStatistics();
    console.log(`📊 Sistema carregado com ${stats.totalDocuments} documentos`);
    
    // Interface de linha de comando
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const askQuestion = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, resolve);
      });
    };
    
    console.log('\n🎯 Digite suas perguntas sobre JavaScript (digite "exit" para sair):');
    
    while (true) {
      const query = await askQuestion('\n🔍 Sua pergunta: ');
      
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'sair') {
        break;
      }
      
      if (query.trim() === '') {
        continue;
      }
      
      try {
        console.log('\n⏳ Buscando...');
        
        const results = await semanticSearchService.search(query, {
          maxResults: 5,
          scoreThreshold: 0.8,
          includeScore: true,
        });
        
        if (results.length === 0) {
          console.log('❌ Nenhum resultado encontrado. Tente reformular sua pergunta.');
          continue;
        }
        
        console.log(`\n✅ Encontrados ${results.length} resultados:`);
        
        results.forEach((result, index) => {
          console.log(`\n📄 Resultado ${index + 1} (Score: ${result.score.toFixed(3)}, Relevance: ${result.relevance}):`);
          console.log(`📁 Fonte: ${result.document.metadata.fileName || 'Desconhecido'}`);
          console.log(`📝 Conteúdo:`);
          console.log(`   ${result.document.pageContent.substring(0, 300)}${result.document.pageContent.length > 300 ? '...' : ''}`);
          
          if (result.document.metadata.chunkIndex) {
            console.log(`   [Chunk ${result.document.metadata.chunkIndex}]`);
          }
        });
        
      } catch (error) {
        console.error('❌ Erro na busca:', error);
      }
    }
    
    // Fechar conexões
    await vectorStoreService.closeConnection();
    rl.close();
    
    console.log('\n👋 Obrigado por usar o sistema de busca semântica!');
    
  } catch (error) {
    console.error('❌ Erro no sistema de busca:', error);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  interactiveSearch();
}

export { interactiveSearch };
