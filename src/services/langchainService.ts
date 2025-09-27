import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { JSONLoader } from 'langchain/document_loaders/fs/json';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import fs from 'fs';
import path from 'path';

export interface LangChainConfig {
  chunkSize: number;
  chunkOverlap: number;
  chunksDirectory: string;
}

export class LangChainService {
  private config: LangChainConfig;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(config: LangChainConfig) {
    this.config = config;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  async loadDocumentsFromDirectory(directoryPath: string): Promise<Document[]> {
    console.log(`Carregando documentos do diretório: ${directoryPath}`);
    
    try {
      // Verificar se o diretório existe
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Diretório não encontrado: ${directoryPath}`);
      }

      // Criar DirectoryLoader com suporte para JSON e TXT
      const loader = new DirectoryLoader(
        directoryPath,
        {
          '.json': (path: string) => new JSONLoader(path),
          '.txt': (path: string) => new TextLoader(path),
        },
        true // recursivo
      );

      const documents = await loader.load();
      
      console.log(`Carregados ${documents.length} documentos`);
      
      // Adicionar metadados extras se necessário
      const enrichedDocuments = documents.map(doc => {
        const fileName = path.basename(doc.metadata.source);
        const fileExt = path.extname(fileName);
        
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            fileName,
            fileExtension: fileExt,
            processedAt: new Date().toISOString(),
          },
        });
      });

      return enrichedDocuments;
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      throw error;
    }
  }

  async splitDocumentsIntoChunks(documents: Document[]): Promise<Document[]> {
    console.log(`Dividindo ${documents.length} documentos em chunks usando TokenTextSplitter`);
    
    try {
      const chunks = await this.textSplitter.splitDocuments(documents);
      
      console.log(`Documentos divididos em ${chunks.length} chunks`);
      
      // Adicionar informações de chunk aos metadados
      const enrichedChunks = chunks.map((chunk, index) => {
        return new Document({
          pageContent: chunk.pageContent,
          metadata: {
            ...chunk.metadata,
            chunkIndex: index,
            chunkSize: chunk.pageContent.length,
            splitter: 'RecursiveCharacterTextSplitter',
          },
        });
      });

      return enrichedChunks;
    } catch (error) {
      console.error('Erro ao dividir documentos em chunks:', error);
      throw error;
    }
  }

  async processDocumentsFromDirectory(directoryPath: string): Promise<Document[]> {
    console.log('Iniciando processamento completo dos documentos...');
    
    try {
      // 1. Load - Carregar documentos
      console.log('1. Load - Carregando documentos...');
      const documents = await this.loadDocumentsFromDirectory(directoryPath);
      
      // 2. Transform - Dividir em chunks
      console.log('2. Transform - Dividindo em chunks...');
      const chunks = await this.splitDocumentsIntoChunks(documents);
      
      console.log('Processamento de documentos concluído com sucesso!');
      return chunks;
    } catch (error) {
      console.error('Erro no processamento de documentos:', error);
      throw error;
    }
  }

  getTextSplitterConfig(): { chunkSize: number; chunkOverlap: number } {
    return {
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    };
  }

  // Método para criar chunks customizados se necessário
  createCustomChunks(text: string, customChunkSize?: number): string[] {
    const chunkSize = customChunkSize || this.config.chunkSize;
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);

      // Tentar quebrar em uma palavra completa
      if (end < text.length) {
        const lastSpaceIndex = chunk.lastIndexOf(' ');
        if (lastSpaceIndex > chunkSize * 0.8) {
          chunk = chunk.slice(0, lastSpaceIndex);
        }
      }

      chunks.push(chunk.trim());
      start = start + chunk.length - this.config.chunkOverlap;
    }

    return chunks;
  }
}
