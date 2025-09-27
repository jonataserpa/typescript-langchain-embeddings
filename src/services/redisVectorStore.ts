import { RedisVectorStore } from '@langchain/redis';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { createClient } from 'redis';

export interface RedisVectorStoreConfig {
  redisUrl: string;
  indexName: string;
  keyPrefix: string;
  embeddingModel: string;
  apiKey: string;
}

export class RedisVectorStoreService {
  private vectorStore!: RedisVectorStore;
  private redisClient: any;
  private config: RedisVectorStoreConfig;

  constructor(vectorStoreConfig: RedisVectorStoreConfig) {
    this.config = vectorStoreConfig;
    this.initializeVectorStore();
  }

  private async initializeVectorStore(): Promise<void> {
    try {
      // Criar cliente Redis
      this.redisClient = createClient({
        url: this.config.redisUrl,
      });

      // Conectar ao Redis
      await this.redisClient.connect();
      console.log('✅ Conectado ao Redis com sucesso!');

      // Criar embeddings
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: this.config.apiKey,
        modelName: this.config.embeddingModel,
      });

      // Criar Redis Vector Store
      this.vectorStore = new RedisVectorStore(embeddings, {
        redisClient: this.redisClient,
        indexName: this.config.indexName,
        keyPrefix: this.config.keyPrefix,
      });

      console.log('✅ Redis Vector Store inicializado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar Redis Vector Store:', error);
      throw error;
    }
  }

  async storeDocuments(documents: Document[]): Promise<void> {
    console.log(`Armazenando ${documents.length} documentos no Redis Vector Store...`);
    
    try {
      // Verificar se o índice existe, se não, criar
      await this.ensureIndexExists();
      
      // Adicionar documentos ao vector store
      await this.vectorStore.addDocuments(documents);
      
      console.log('✅ Documentos armazenados no Redis Vector Store com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao armazenar documentos:', error);
      throw error;
    }
  }

  async searchSimilarDocuments(
    query: string, 
    k: number = 5, 
    scoreThreshold?: number
  ): Promise<Document[]> {
    console.log(`Buscando documentos similares para: "${query}"`);
    
    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, k);
      
      // Filtrar por threshold se especificado
      const filteredResults = scoreThreshold 
        ? results.filter(([_, score]) => score <= scoreThreshold)
        : results;
      
      const documents = filteredResults.map(([doc, _]) => doc);
      
      console.log(`✅ Encontrados ${documents.length} documentos similares`);
      return documents;
    } catch (error) {
      console.error('❌ Erro na busca semântica:', error);
      throw error;
    }
  }

  async searchSimilarDocumentsWithScore(
    query: string, 
    k: number = 5
  ): Promise<Array<[Document, number]>> {
    console.log(`Buscando documentos similares com scores para: "${query}"`);
    
    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, k);
      
      console.log(`✅ Encontrados ${results.length} documentos similares com scores`);
      return results;
    } catch (error) {
      console.error('❌ Erro na busca semântica com scores:', error);
      throw error;
    }
  }

  async deleteIndex(): Promise<void> {
    console.log('Deletando índice do Redis...');
    
    try {
      await this.vectorStore.delete({ deleteAll: true });
      console.log('✅ Índice deletado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao deletar índice:', error);
      throw error;
    }
  }

  async getIndexInfo(): Promise<any> {
    try {
      const info = await this.redisClient.ft.info(this.config.indexName);
      return info;
    } catch (error) {
      console.log('Índice ainda não existe ou erro ao obter informações:', error);
      return null;
    }
  }

  private async ensureIndexExists(): Promise<void> {
    try {
      const info = await this.getIndexInfo();
      if (!info) {
        console.log('Criando novo índice no Redis...');
        // O índice será criado automaticamente quando adicionarmos o primeiro documento
      } else {
        console.log(`Índice já existe: ${this.config.indexName}`);
      }
    } catch (error) {
      console.error('Erro ao verificar/criar índice:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.redisClient.ping();
      console.log('✅ Conexão com Redis funcionando!');
      return true;
    } catch (error) {
      console.error('❌ Erro na conexão com Redis:', error);
      return false;
    }
  }

  async closeConnection(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('✅ Conexão Redis fechada com sucesso!');
      }
    } catch (error) {
      console.error('❌ Erro ao fechar conexão Redis:', error);
      throw error;
    }
  }

  getVectorStore(): RedisVectorStore {
    return this.vectorStore;
  }

  getRedisClient(): any {
    return this.redisClient;
  }
}
