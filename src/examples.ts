import { config, validateConfig } from './config/config';
import { SemanticSearchService } from './services/semanticSearchService';
import { EmbeddingService } from './services/embeddingService';
import { RedisVectorStoreService } from './services/redisVectorStore';

/**
 * Exemplos de uso do sistema de busca semântica
 */
export class Examples {
  private semanticSearchService: SemanticSearchService;

  constructor() {
    validateConfig();
    
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
    
    this.semanticSearchService = new SemanticSearchService(
      vectorStoreService,
      embeddingService
    );
  }

  /**
   * Exemplo 1: Busca básica
   */
  async basicSearch() {
    console.log('🔍 Exemplo 1: Busca básica');
    
    const results = await this.semanticSearchService.search(
      'What is JavaScript?',
      {
        maxResults: 3,
        includeScore: true,
      }
    );
    
    console.log(`Resultados encontrados: ${results.length}`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
      console.log(`   ${result.document.pageContent.substring(0, 150)}...`);
    });
  }

  /**
   * Exemplo 2: Busca com contexto
   */
  async contextualSearch() {
    console.log('\n🔍 Exemplo 2: Busca com contexto');
    
    const results = await this.semanticSearchService.searchWithContext(
      'functions',
      'programming concepts definitions',
      {
        maxResults: 2,
        includeScore: true,
      }
    );
    
    console.log(`Resultados encontrados: ${results.length}`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)} | Relevance: ${result.relevance}`);
      console.log(`   ${result.document.pageContent.substring(0, 150)}...`);
    });
  }

  /**
   * Exemplo 3: Busca de conceitos similares
   */
  async similarConceptsSearch() {
    console.log('\n🔍 Exemplo 3: Busca de conceitos similares');
    
    const results = await this.semanticSearchService.searchSimilarConcepts(
      'closures',
      {
        maxResults: 3,
        includeScore: true,
      }
    );
    
    console.log(`Resultados encontrados: ${results.length}`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)} | Relevance: ${result.relevance}`);
      console.log(`   ${result.document.pageContent.substring(0, 150)}...`);
    });
  }

  /**
   * Exemplo 4: Busca com filtros de metadados
   */
  async filteredSearch() {
    console.log('\n🔍 Exemplo 4: Busca com filtros');
    
    const results = await this.semanticSearchService.search(
      'DOM manipulation',
      {
        maxResults: 5,
        includeScore: true,
        filterByMetadata: {
          fileExtension: '.json',
        },
      }
    );
    
    console.log(`Resultados encontrados: ${results.length}`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)}`);
      console.log(`   Fonte: ${result.document.metadata.fileName}`);
      console.log(`   ${result.document.pageContent.substring(0, 150)}...`);
    });
  }

  /**
   * Exemplo 5: Estatísticas do sistema
   */
  async systemStats() {
    console.log('\n📊 Exemplo 5: Estatísticas do sistema');
    
    const stats = await this.semanticSearchService.getSearchStatistics();
    console.log('Estatísticas:', stats);
    
    const healthCheck = await this.semanticSearchService.healthCheck();
    console.log('Health Check:', healthCheck);
  }

  /**
   * Exemplo 6: Múltiplas consultas
   */
  async multipleQueries() {
    console.log('\n🔍 Exemplo 6: Múltiplas consultas');
    
    const queries = [
      'What are JavaScript objects?',
      'How to handle errors in JavaScript?',
      'JavaScript array methods',
      'Event handling in JavaScript',
      'Async and await in JavaScript',
    ];
    
    for (const query of queries) {
      console.log(`\n🔍 Buscando: "${query}"`);
      
      const results = await this.semanticSearchService.search(query, {
        maxResults: 2,
        includeScore: true,
      });
      
      console.log(`   Resultados: ${results.length}`);
      if (results.length > 0) {
        console.log(`   Melhor score: ${results[0].score.toFixed(3)}`);
        console.log(`   Relevance: ${results[0].relevance}`);
      }
    }
  }

  /**
   * Executar todos os exemplos
   */
  async runAllExamples() {
    try {
      console.log('🚀 Executando todos os exemplos...\n');
      
      await this.basicSearch();
      await this.contextualSearch();
      await this.similarConceptsSearch();
      await this.filteredSearch();
      await this.systemStats();
      await this.multipleQueries();
      
      console.log('\n✅ Todos os exemplos executados com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao executar exemplos:', error);
    }
  }
}

// Executar exemplos se chamado diretamente
if (require.main === module) {
  const examples = new Examples();
  examples.runAllExamples().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}
