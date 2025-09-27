import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

export interface ProcessedChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    totalChunks: number;
  };
}

export class PDFProcessor {
  private chunksDir: string;

  constructor(chunksDir: string) {
    this.chunksDir = chunksDir;
    this.ensureChunksDirectory();
  }

  private ensureChunksDirectory(): void {
    if (!fs.existsSync(this.chunksDir)) {
      fs.mkdirSync(this.chunksDir, { recursive: true });
    }
  }

  async extractTextFromPDF(pdfPath: string): Promise<string> {
    try {
      console.log(`Extraindo texto do PDF: ${pdfPath}`);
      
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      
      console.log(`Texto extraído com sucesso. Total de páginas: ${pdfData.numpages}`);
      return pdfData.text;
    } catch (error) {
      console.error('Erro ao extrair texto do PDF:', error);
      throw error;
    }
  }

  splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    console.log(`Dividindo texto em chunks de ${chunkSize} caracteres com overlap de ${overlap}`);
    
    const chunks: string[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);

      // Tentar quebrar em uma palavra completa
      if (end < text.length) {
        const lastSpaceIndex = chunk.lastIndexOf(' ');
        if (lastSpaceIndex > chunkSize * 0.8) { // Se encontrar espaço em 80% do chunk
          chunk = chunk.slice(0, lastSpaceIndex);
        }
      }

      chunks.push(chunk.trim());
      
      // Mover para próximo chunk com overlap
      start = start + chunk.length - overlap;
      chunkIndex++;
    }

    console.log(`Texto dividido em ${chunks.length} chunks`);
    return chunks;
  }

  async saveChunksToFiles(
    chunks: string[], 
    sourceFileName: string, 
    format: 'json' | 'txt' = 'json'
  ): Promise<ProcessedChunk[]> {
    const processedChunks: ProcessedChunk[] = [];
    const baseFileName = path.basename(sourceFileName, '.pdf');

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${baseFileName}_chunk_${i + 1}`;
      
      const processedChunk: ProcessedChunk = {
        id: chunkId,
        content: chunk,
        metadata: {
          source: sourceFileName,
          chunkIndex: i + 1,
          totalChunks: chunks.length,
        },
      };

      if (format === 'json') {
        const filePath = path.join(this.chunksDir, `${chunkId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(processedChunk, null, 2));
      } else {
        const filePath = path.join(this.chunksDir, `${chunkId}.txt`);
        fs.writeFileSync(filePath, chunk);
      }

      processedChunks.push(processedChunk);
    }

    console.log(`${processedChunks.length} chunks salvos em ${this.chunksDir}`);
    return processedChunks;
  }

  async processPDFToChunks(
    pdfPath: string, 
    chunkSize: number = 600, 
    overlap: number = 100,
    format: 'json' | 'txt' = 'json'
  ): Promise<ProcessedChunk[]> {
    try {
      // 1. Extrair texto do PDF
      const text = await this.extractTextFromPDF(pdfPath);
      
      // 2. Dividir em chunks
      const chunks = this.splitTextIntoChunks(text, chunkSize, overlap);
      
      // 3. Salvar chunks em arquivos
      const processedChunks = await this.saveChunksToFiles(chunks, pdfPath, format);
      
      return processedChunks;
    } catch (error) {
      console.error('Erro no processamento do PDF:', error);
      throw error;
    }
  }

  getChunksDirectory(): string {
    return this.chunksDir;
  }
}
