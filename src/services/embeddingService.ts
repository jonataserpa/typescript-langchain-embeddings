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

  constructor(embeddingConfig: EmbeddingConfig) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: embeddingConfig.apiKey,
      modelName: embeddingConfig.model,
      batchSize: embeddingConfig.batchSize || 100,
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
    console.log(`Criando embeddings para ${documents.length} documentos...`);
    
    try {
      // Extrair textos dos documentos
      const texts = documents.map(doc => doc.pageContent);
      
      // Criar embeddings
      const embeddings = await this.createEmbeddings(texts);
      
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

      console.log('Embeddings adicionados aos documentos com sucesso!');
      return embeddedDocuments;
    } catch (error) {
      console.error('Erro ao criar embeddings para documentos:', error);
      throw error;
    }
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
