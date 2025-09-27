import { Document } from 'langchain/document';
import { RedisVectorStoreService } from './redisVectorStore';
import { EmbeddingService } from './embeddingService';

export interface SearchResult {
  document: Document;
  score: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface SearchOptions {
  maxResults?: number;
  scoreThreshold?: number;
  includeScore?: boolean;
  filterByMetadata?: Record<string, any>;
}

export class SemanticSearchService {
  private vectorStoreService: RedisVectorStoreService;
  private embeddingService: EmbeddingService;

  constructor(
    vectorStoreService: RedisVectorStoreService,
    embeddingService: EmbeddingService
  ) {
    this.vectorStoreService = vectorStoreService;
    this.embeddingService = embeddingService;
  }

  async search(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`🔍 Iniciando busca semântica para: "${query}"`);
    
    try {
      const {
        maxResults = 5,
        scoreThreshold = 0.8,
        includeScore = true,
        filterByMetadata
      } = options;

      // Buscar documentos similares
      let results: Array<[Document, number]> | Document[];
      
      if (includeScore) {
        results = await this.vectorStoreService.searchSimilarDocumentsWithScore(query, maxResults);
      } else {
        const docs = await this.vectorStoreService.searchSimilarDocuments(query, maxResults);
        results = docs.map(doc => [doc, 0] as [Document, number]);
      }

      // Processar resultados
      const searchResults: SearchResult[] = results.map(([document, score]) => {
        const relevance = this.calculateRelevance(score);
        
        return {
          document,
          score,
          relevance,
        };
      });

      // Filtrar por threshold
      const filteredResults = searchResults.filter(result => result.score <= scoreThreshold);

      // Aplicar filtros de metadados se especificado
      const finalResults = filterByMetadata 
        ? this.filterByMetadata(filteredResults, filterByMetadata)
        : filteredResults;

      console.log(`✅ Busca concluída: ${finalResults.length} resultados encontrados`);
      return finalResults;
    } catch (error) {
      console.error('❌ Erro na busca semântica:', error);
      throw error;
    }
  }

  async searchWithContext(
    query: string, 
    context: string = '', 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`🔍 Busca semântica com contexto para: "${query}"`);
    
    try {
      // Combinar query com contexto
      const enhancedQuery = context ? `${query} ${context}` : query;
      
      return await this.search(enhancedQuery, options);
    } catch (error) {
      console.error('❌ Erro na busca com contexto:', error);
      throw error;
    }
  }

  async searchSimilarConcepts(
    concept: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`🔍 Buscando conceitos similares a: "${concept}"`);
    
    try {
      // Expandir conceito para melhor busca
      const expandedQuery = `conceitos relacionados a ${concept} definições exemplos`;
      
      return await this.search(expandedQuery, {
        ...options,
        maxResults: options.maxResults || 10,
      });
    } catch (error) {
      console.error('❌ Erro na busca de conceitos similares:', error);
      throw error;
    }
  }

  async getDocumentById(documentId: string): Promise<Document | null> {
    try {
      // Implementar busca por ID específico se necessário
      console.log(`Buscando documento por ID: ${documentId}`);
      
      // Por enquanto, fazer uma busca ampla e filtrar por metadados
      const results = await this.search(documentId, {
        maxResults: 100,
        includeScore: false,
      });

      const document = results.find(result => 
        result.document.metadata.id === documentId ||
        result.document.metadata.fileName?.includes(documentId)
      );

      return document?.document || null;
    } catch (error) {
      console.error('❌ Erro ao buscar documento por ID:', error);
      return null;
    }
  }

  private calculateRelevance(score: number): 'high' | 'medium' | 'low' {
    if (score <= 0.3) return 'high';
    if (score <= 0.6) return 'medium';
    return 'low';
  }

  private filterByMetadata(
    results: SearchResult[], 
    filter: Record<string, any>
  ): SearchResult[] {
    return results.filter(result => {
      const metadata = result.document.metadata;
      
      return Object.entries(filter).every(([key, value]) => {
        return metadata[key] === value;
      });
    });
  }

  async getSearchStatistics(): Promise<{
    totalDocuments: number;
    indexName: string;
    embeddingModel: string;
  }> {
    try {
      const indexInfo = await this.vectorStoreService.getIndexInfo();
      const embeddingModel = this.embeddingService.getEmbeddingModel();
      
      return {
        totalDocuments: indexInfo?.numDocs || 0,
        indexName: indexInfo?.indexName || 'unknown',
        embeddingModel,
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return {
        totalDocuments: 0,
        indexName: 'unknown',
        embeddingModel: 'unknown',
      };
    }
  }

  async healthCheck(): Promise<{
    vectorStore: boolean;
    embedding: boolean;
    redis: boolean;
  }> {
    try {
      const vectorStoreHealth = await this.vectorStoreService.testConnection();
      const embeddingHealth = await this.embeddingService.testConnection();
      
      return {
        vectorStore: vectorStoreHealth,
        embedding: embeddingHealth,
        redis: vectorStoreHealth, // Redis está incluído no vectorStore
      };
    } catch (error) {
      console.error('❌ Erro no health check:', error);
      return {
        vectorStore: false,
        embedding: false,
        redis: false,
      };
    }
  }
}
