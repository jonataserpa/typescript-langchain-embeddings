import { Document } from 'langchain/document';
import { RedisVectorStoreService } from './redisVectorStore';
import { EmbeddingService } from './embeddingService';
import { PromptService, ContextualResponse } from './promptService';

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
  private promptService: PromptService;

  constructor(
    vectorStoreService: RedisVectorStoreService,
    embeddingService: EmbeddingService,
    promptService?: PromptService
  ) {
    this.vectorStoreService = vectorStoreService;
    this.embeddingService = embeddingService;
    this.promptService = promptService || new PromptService({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000
    });
  }

  async search(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`\n🔍 INICIANDO BUSCA SEMÂNTICA (RETRIEVAL):`);
    console.log(`   - Query: "${query}"`);
    console.log(`   - Opções:`, JSON.stringify(options, null, 2));
    
    try {
      const {
        maxResults = 5,
        scoreThreshold = 0.8,
        includeScore = true,
        filterByMetadata
      } = options;

      console.log(`\n📊 CONFIGURAÇÃO DA BUSCA:`);
      console.log(`   - Max resultados: ${maxResults}`);
      console.log(`   - Score threshold: ${scoreThreshold}`);
      console.log(`   - Incluir scores: ${includeScore}`);

      // Buscar documentos similares
      let results: Array<[Document, number]> | Document[];
      
      console.log(`\n🔎 EXECUTANDO RETRIEVAL NO REDIS...`);
      
      if (includeScore) {
        results = await this.vectorStoreService.searchSimilarDocumentsWithScore(query, maxResults);
      } else {
        const docs = await this.vectorStoreService.searchSimilarDocuments(query, maxResults);
        results = docs.map(doc => [doc, 0] as [Document, number]);
      }

      console.log(`\n📋 RESULTADOS BRUTOS DO RETRIEVAL:`);
      console.log(`   - Total encontrado: ${results.length}`);
      
      if (results.length > 0) {
        console.log(`   - Primeiro resultado:`);
        const [firstDoc, firstScore] = results[0] as [Document, number];
        console.log(`     * Score: ${firstScore}`);
        console.log(`     * Conteúdo (100 chars): ${firstDoc.pageContent.substring(0, 100)}...`);
        console.log(`     * Metadados:`, JSON.stringify(firstDoc.metadata, null, 2));
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

      console.log(`\n🎯 PROCESSANDO RESULTADOS:`);
      console.log(`   - Antes do filtro: ${searchResults.length} resultados`);

      // Filtrar por threshold
      const filteredResults = searchResults.filter(result => result.score <= scoreThreshold);
      console.log(`   - Após filtro de threshold (${scoreThreshold}): ${filteredResults.length} resultados`);

      // Aplicar filtros de metadados se especificado
      const finalResults = filterByMetadata 
        ? this.filterByMetadata(filteredResults, filterByMetadata)
        : filteredResults;

      console.log(`\n✅ BUSCA CONCLUÍDA:`);
      console.log(`   - Resultados finais: ${finalResults.length}`);
      console.log(`   - Scores: ${finalResults.map(r => r.score.toFixed(3)).join(', ')}`);
      console.log(`   - Relevâncias: ${finalResults.map(r => r.relevance).join(', ')}`);
      
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

  async generateContextualAnswer(
    question: string,
    options: SearchOptions = {}
  ): Promise<ContextualResponse> {
    console.log(`\n🤖 GERANDO RESPOSTA CONTEXTUALIZADA:`);
    console.log(`   - Pergunta: "${question}"`);
    console.log(`   - Opções:`, JSON.stringify(options, null, 2));
    
    try {
      // Buscar documentos relevantes
      const searchResults = await this.search(question, {
        maxResults: options.maxResults || 5,
        scoreThreshold: options.scoreThreshold || 0.8,
        includeScore: true,
        ...options
      });

      console.log(`   - Documentos encontrados: ${searchResults.length}`);

      // Extrair documentos para o contexto
      const relevantDocuments = searchResults.map(result => result.document);

      // Gerar resposta contextualizada
      const response = await this.promptService.generateResponse(
        question,
        relevantDocuments,
        {
          maxContextLength: 4000,
          includeMetadata: true
        }
      );

      console.log(`\n✅ RESPOSTA GERADA:`);
      console.log(`   - Relevante: ${response.isRelevant}`);
      console.log(`   - Confiança: ${response.confidence}`);
      console.log(`   - Fonte: ${response.source}`);
      console.log(`   - Contextos usados: ${response.contextUsed.length}`);

      return response;
    } catch (error) {
      console.error('❌ Erro ao gerar resposta contextualizada:', error);
      throw error;
    }
  }

  async askQuestion(
    question: string,
    options: SearchOptions = {}
  ): Promise<{
    question: string;
    answer: string;
    confidence: 'high' | 'medium' | 'low';
    isRelevant: boolean;
    sources: string[];
    searchResults: SearchResult[];
  }> {
    console.log(`\n❓ PERGUNTA: "${question}"`);
    
    try {
      // Gerar resposta contextualizada
      const contextualResponse = await this.generateContextualAnswer(question, options);
      
      // Buscar resultados da busca para referência
      const searchResults = await this.search(question, options);
      
      return {
        question,
        answer: contextualResponse.answer,
        confidence: contextualResponse.confidence,
        isRelevant: contextualResponse.isRelevant,
        sources: contextualResponse.contextUsed,
        searchResults
      };
    } catch (error) {
      console.error('❌ Erro ao processar pergunta:', error);
      throw error;
    }
  }
}
