import { RedisVectorStore } from '@langchain/redis';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { createClient } from 'redis';
import path from 'path';

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
    console.log(`\n💾 INICIANDO ARMAZENAMENTO NO REDIS (VERSÃO OTIMIZADA):`);
    console.log(`   - Documentos para armazenar: ${documents.length}`);
    console.log(`   - Índice: ${this.config.indexName}`);
    console.log(`   - Prefixo: ${this.config.keyPrefix}`);
    console.log(`   - Modelo de embedding: ${this.config.embeddingModel}`);
    
    try {
      // Verificar se o índice existe, se não, criar
      await this.ensureIndexExists();
      
      // Log de exemplo do primeiro documento
      if (documents.length > 0) {
        const firstDoc = documents[0];
        console.log(`\n📄 EXEMPLO DO PRIMEIRO DOCUMENTO:`);
        console.log(`   - Conteúdo (100 chars): ${firstDoc.pageContent.substring(0, 100)}...`);
        console.log(`   - Metadados:`, JSON.stringify(firstDoc.metadata, null, 2));
        console.log(`   - Tem embedding?: ${firstDoc.metadata.embedding ? 'SIM' : 'NÃO'}`);
        if (firstDoc.metadata.embedding) {
          console.log(`   - Dimensão do embedding: ${firstDoc.metadata.embedding.length}`);
        }
      }
      
      console.log(`\n⏳ Armazenando documentos em lotes no Redis...`);
      
      // Armazenar em lotes para evitar problemas de memória
      const batchSize = 50; // Lotes ainda menores para Redis
      const totalBatches = Math.ceil(documents.length / batchSize);
      
      console.log(`   - Total de lotes: ${totalBatches}`);
      console.log(`   - Documentos por lote: ${batchSize}`);
      
      let totalStored = 0;
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batchNumber = Math.floor(i / batchSize) + 1;
        const batch = documents.slice(i, i + batchSize);
        
        console.log(`\n📦 Armazenando lote ${batchNumber}/${totalBatches} (${batch.length} documentos)...`);
        
        try {
          // Log detalhado de cada documento no lote
          console.log(`   - Documentos no lote:`);
          batch.forEach((doc, index) => {
            const chunkIndex = doc.metadata.chunkIndex || 'N/A';
            const source = doc.metadata.source || 'N/A';
            const fileName = path.basename(source);
            console.log(`     ${index + 1}. Chunk ${chunkIndex} - ${fileName}`);
          });
          
          await this.vectorStore.addDocuments(batch);
          totalStored += batch.length;
          
          console.log(`   ✅ Lote ${batchNumber} armazenado com sucesso!`);
          console.log(`   📊 Progresso: ${totalStored}/${documents.length} (${Math.round((totalStored / documents.length) * 100)}%)`);
          
          // Verificar status do Redis após cada lote
          const currentIndexInfo = await this.getIndexInfo();
          if (currentIndexInfo) {
            console.log(`   📈 Documentos no Redis: ${currentIndexInfo.numDocs}`);
          }
          
          // Pequena pausa entre lotes para não sobrecarregar o Redis
          if (batchNumber < totalBatches) {
            await this.sleep(200); // 200ms entre lotes
          }
          
        } catch (error) {
          console.error(`   ❌ Erro no lote ${batchNumber}:`, error);
          console.error(`   - Documentos que falharam:`, batch.map(doc => doc.metadata.chunkIndex || 'N/A'));
          throw error;
        }
      }
      
      console.log(`\n✅ TODOS OS DOCUMENTOS ARMAZENADOS COM SUCESSO!`);
      console.log(`   - Total armazenado: ${totalStored} documentos`);
      
      // Verificação final detalhada
      const indexInfo = await this.getIndexInfo();
      if (indexInfo) {
        console.log(`   - Documentos no índice: ${indexInfo.numDocs}`);
        console.log(`   - Tamanho do índice: ${indexInfo.indexing} bytes`);
        console.log(`   - Status: ${indexInfo.status}`);
        
        // Verificar se o número de documentos está correto
        if (indexInfo.numDocs < totalStored) {
          console.log(`   ⚠️ ATENÇÃO: Esperado ${totalStored} documentos, mas apenas ${indexInfo.numDocs} estão no Redis`);
        } else {
          console.log(`   ✅ CONFIRMADO: ${indexInfo.numDocs} documentos salvos no Redis`);
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao armazenar documentos:', error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.quit();
        console.log('✅ Conexão Redis fechada com sucesso!');
      }
    } catch (error) {
      // Ignorar erros de fechamento se a conexão já estiver fechada
      if (error instanceof Error && error.message.includes('closed')) {
        console.log('ℹ️ Conexão Redis já estava fechada');
      } else {
        console.error('❌ Erro ao fechar conexão Redis:', error);
      }
    }
  }

  getVectorStore(): RedisVectorStore {
    return this.vectorStore;
  }

  getRedisClient(): any {
    return this.redisClient;
  }
}
