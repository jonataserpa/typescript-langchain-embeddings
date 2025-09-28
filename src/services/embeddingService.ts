import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { config } from '../config/config';

export interface EmbeddingConfig {
  apiKey: string;
  model: string;
  batchSize?: number;
}

export class EmbeddingService {
  private embeddings: OpenAIEmbeddings;
  private batchSize: number;

  constructor(embeddingConfig: EmbeddingConfig) {
    this.batchSize = embeddingConfig.batchSize || 50;
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: embeddingConfig.apiKey,
      modelName: embeddingConfig.model,
      batchSize: this.batchSize,
    });
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`Criando embeddings para ${texts.length} textos...`);
    
    try {
      const embeddings = await this.embeddings.embedDocuments(texts);
      console.log(`Embeddings criados com sucesso. Dimensão: ${embeddings[0]?.length || 0}`);
      return embeddings;
    } catch (error) {
      console.error('Erro ao criar embeddings:', error);
      throw error;
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    console.log('Criando embedding para texto...');
    
    try {
      const embedding = await this.embeddings.embedQuery(text);
      console.log(`Embedding criado com sucesso. Dimensão: ${embedding.length}`);
      return embedding;
    } catch (error) {
      console.error('Erro ao criar embedding:', error);
      throw error;
    }
  }

  async embedDocuments(documents: Document[]): Promise<Document[]> {
    console.log(`\n🧠 CRIANDO EMBEDDINGS (VERSÃO OTIMIZADA):`);
    console.log(`   - Documentos para processar: ${documents.length}`);
    console.log(`   - Modelo: ${this.embeddings.modelName}`);
    console.log(`   - Batch size: ${this.batchSize}`);
    console.log(`   - Processamento em lotes para evitar timeouts`);
    
    try {
      // Extrair textos dos documentos
      const texts = documents.map(doc => doc.pageContent);
      console.log(`   - Textos extraídos: ${texts.length}`);
      
      // Log do primeiro texto como exemplo
      if (texts.length > 0) {
        console.log(`   - Exemplo de texto (100 chars): ${texts[0].substring(0, 100)}...`);
      }
      
      console.log(`\n⏳ Processando embeddings em lotes...`);
      
      // Processar em lotes com retry e rate limiting
      const embeddings = await this.createEmbeddingsInBatches(texts);
      
      console.log(`\n✅ EMBEDDINGS CRIADOS:`);
      console.log(`   - Total de embeddings: ${embeddings.length}`);
      console.log(`   - Dimensão de cada embedding: ${embeddings[0]?.length || 'N/A'}`);
      console.log(`   - Exemplo do primeiro embedding (5 primeiros valores): [${embeddings[0]?.slice(0, 5).join(', ')}...]`);
      
      // Adicionar embeddings aos metadados dos documentos
      const embeddedDocuments = documents.map((doc, index) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            embedding: embeddings[index],
            embeddingModel: config.openai.embeddingModel,
            embeddingCreatedAt: new Date().toISOString(),
          },
        });
      });

      console.log(`\n✅ EMBEDDINGS ADICIONADOS AOS DOCUMENTOS:`);
      console.log(`   - Documentos processados: ${embeddedDocuments.length}`);
      console.log(`   - Primeiro documento tem embedding?: ${embeddedDocuments[0]?.metadata.embedding ? 'SIM' : 'NÃO'}`);
      
      return embeddedDocuments;
    } catch (error) {
      console.error('❌ Erro ao criar embeddings para documentos:', error);
      throw error;
    }
  }

  async embedAndSaveInBatches(
    documents: Document[], 
    vectorStoreService: any
  ): Promise<Document[]> {
    console.log(`\n🧠 CRIANDO EMBEDDINGS E SALVANDO EM LOTES:`);
    console.log(`   - Documentos para processar: ${documents.length}`);
    console.log(`   - Modelo: ${this.embeddings.modelName}`);
    console.log(`   - Batch size: ${this.batchSize}`);
    console.log(`   - Salvando no Redis a cada lote processado`);
    
    try {
      const allEmbeddedDocuments: Document[] = [];
      const totalBatches = Math.ceil(documents.length / this.batchSize);
      
      console.log(`   - Total de lotes: ${totalBatches}`);
      console.log(`   - Documentos por lote: ${this.batchSize}`);
      
      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batchNumber = Math.floor(i / this.batchSize) + 1;
        const batch = documents.slice(i, i + this.batchSize);
        
        console.log(`\n📦 Processando lote ${batchNumber}/${totalBatches} (${batch.length} documentos)...`);
        
        try {
          // Rate limiting: aguardar entre lotes
          if (batchNumber > 1) {
            const delay = this.calculateDelay(batchNumber);
            console.log(`   - Aguardando ${delay}ms para rate limiting...`);
            await this.sleep(delay);
          }
          
          // Processar lote com retry
          const batchEmbeddings = await this.processBatchWithRetry(batch.map(doc => doc.pageContent), batchNumber);
          
          // Adicionar embeddings aos metadados dos documentos do lote
          const embeddedBatch = batch.map((doc, index) => {
            return new Document({
              pageContent: doc.pageContent,
              metadata: {
                ...doc.metadata,
                embedding: batchEmbeddings[index],
                embeddingModel: config.openai.embeddingModel,
                embeddingCreatedAt: new Date().toISOString(),
              },
            });
          });
          
          console.log(`   ✅ Lote ${batchNumber} processado com sucesso!`);
          console.log(`   📊 Progresso: ${Math.min(i + this.batchSize, documents.length)}/${documents.length} (${Math.round(((i + this.batchSize) / documents.length) * 100)}%)`);
          
          // Salvar lote no Redis imediatamente
          console.log(`   💾 Salvando lote ${batchNumber} no Redis...`);
          await vectorStoreService.storeDocuments(embeddedBatch);
          console.log(`   ✅ Lote ${batchNumber} salvo no Redis!`);
          
          // Adicionar ao array total
          allEmbeddedDocuments.push(...embeddedBatch);
          
        } catch (error) {
          console.error(`   ❌ Erro no lote ${batchNumber}:`, error);
          
          // Se for erro de rate limit, aguardar mais tempo
          if (this.isRateLimitError(error)) {
            console.log(`   ⏳ Rate limit detectado, aguardando 60 segundos...`);
            await this.sleep(60000);
            
            // Tentar novamente o mesmo lote
            try {
              const batchEmbeddings = await this.processBatchWithRetry(batch.map(doc => doc.pageContent), batchNumber);
              
              const embeddedBatch = batch.map((doc, index) => {
                return new Document({
                  pageContent: doc.pageContent,
                  metadata: {
                    ...doc.metadata,
                    embedding: batchEmbeddings[index],
                    embeddingModel: config.openai.embeddingModel,
                    embeddingCreatedAt: new Date().toISOString(),
                  },
                });
              });
              
              console.log(`   💾 Salvando lote ${batchNumber} no Redis (após retry)...`);
              await vectorStoreService.storeDocuments(embeddedBatch);
              console.log(`   ✅ Lote ${batchNumber} salvo no Redis após retry!`);
              
              allEmbeddedDocuments.push(...embeddedBatch);
            } catch (retryError) {
              console.error(`   ❌ Falha definitiva no lote ${batchNumber}:`, retryError);
              throw retryError;
            }
          } else {
            throw error;
          }
        }
      }
      
      console.log(`\n✅ TODOS OS LOTES PROCESSADOS E SALVOS:`);
      console.log(`   - Total de documentos processados: ${allEmbeddedDocuments.length}`);
      console.log(`   - Todos os lotes salvos no Redis: ✅`);
      
      return allEmbeddedDocuments;
    } catch (error) {
      console.error('❌ Erro ao processar e salvar documentos em lotes:', error);
      throw error;
    }
  }

  private async createEmbeddingsInBatches(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];
    const totalBatches = Math.ceil(texts.length / this.batchSize);
    
    console.log(`   - Total de lotes: ${totalBatches}`);
    console.log(`   - Documentos por lote: ${this.batchSize}`);
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const batch = texts.slice(i, i + this.batchSize);
      
      console.log(`\n📦 Processando lote ${batchNumber}/${totalBatches} (${batch.length} documentos)...`);
      
      try {
        // Rate limiting: aguardar entre lotes
        if (batchNumber > 1) {
          const delay = this.calculateDelay(batchNumber);
          console.log(`   - Aguardando ${delay}ms para rate limiting...`);
          await this.sleep(delay);
        }
        
        // Processar lote com retry
        const batchEmbeddings = await this.processBatchWithRetry(batch, batchNumber);
        allEmbeddings.push(...batchEmbeddings);
        
        console.log(`   ✅ Lote ${batchNumber} processado com sucesso!`);
        console.log(`   📊 Progresso: ${Math.min(i + this.batchSize, texts.length)}/${texts.length} (${Math.round(((i + this.batchSize) / texts.length) * 100)}%)`);
        
      } catch (error) {
        console.error(`   ❌ Erro no lote ${batchNumber}:`, error);
        
        // Se for erro de rate limit, aguardar mais tempo
        if (this.isRateLimitError(error)) {
          console.log(`   ⏳ Rate limit detectado, aguardando 60 segundos...`);
          await this.sleep(60000);
          
          // Tentar novamente o mesmo lote
          try {
            const batchEmbeddings = await this.processBatchWithRetry(batch, batchNumber);
            allEmbeddings.push(...batchEmbeddings);
            console.log(`   ✅ Lote ${batchNumber} processado após retry!`);
          } catch (retryError) {
            console.error(`   ❌ Falha definitiva no lote ${batchNumber}:`, retryError);
            throw retryError;
          }
        } else {
          throw error;
        }
      }
    }
    
    return allEmbeddings;
  }

  private async processBatchWithRetry(batch: string[], batchNumber: number, maxRetries: number = 3): Promise<number[][]> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   - Tentativa ${attempt}/${maxRetries} para lote ${batchNumber}`);
        return await this.createEmbeddings(batch);
      } catch (error) {
        lastError = error;
        console.log(`   - Tentativa ${attempt} falhou:`, error instanceof Error ? error.message : 'Erro desconhecido');
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`   - Aguardando ${delay}ms antes da próxima tentativa...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  private calculateDelay(batchNumber: number): number {
    // Delay progressivo: 1s, 2s, 3s, etc.
    return Math.min(batchNumber * 1000, 10000); // Máximo 10 segundos
  }

  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('429');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getEmbeddingModel(): string {
    return config.openai.embeddingModel;
  }

  getEmbeddingDimensions(): Promise<number> {
    return this.embeddings.embedQuery('test').then(embedding => embedding.length);
  }

  // Método para verificar se a API está funcionando
  async testConnection(): Promise<boolean> {
    try {
      await this.createEmbedding('teste de conexão');
      console.log('✅ Conexão com OpenAI Embeddings funcionando!');
      return true;
    } catch (error) {
      console.error('❌ Erro na conexão com OpenAI Embeddings:', error);
      return false;
    }
  }
}
