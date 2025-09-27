import { PDFProcessor } from './utils/pdfProcessor';
import { config, validateConfig } from './config/config';
import path from 'path';

async function processPDF() {
  try {
    console.log('🚀 Iniciando processamento do PDF...');
    
    // Validar configurações
    validateConfig();
    
    // Caminho do PDF
    const pdfPath = path.join(config.paths.tmpDir, 'JavaScript The Definitive Guide (David Flanagan).pdf');
    
    // Criar processador de PDF
    const pdfProcessor = new PDFProcessor(config.paths.chunksDir);
    
    console.log('📄 Processando PDF para chunks...');
    
    // Processar PDF em chunks
    const processedChunks = await pdfProcessor.processPDFToChunks(
      pdfPath,
      config.chunk.size,
      config.chunk.overlap,
      'json' // Salvar como JSON para melhor estruturação
    );
    
    console.log(`✅ PDF processado com sucesso!`);
    console.log(`📊 Estatísticas:`);
    console.log(`   - Total de chunks: ${processedChunks.length}`);
    console.log(`   - Tamanho do chunk: ${config.chunk.size} caracteres`);
    console.log(`   - Overlap: ${config.chunk.overlap} caracteres`);
    console.log(`   - Diretório dos chunks: ${config.paths.chunksDir}`);
    
    // Mostrar alguns exemplos de chunks
    console.log('\n📝 Exemplos de chunks criados:');
    processedChunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(`   ID: ${chunk.id}`);
      console.log(`   Tamanho: ${chunk.content.length} caracteres`);
      console.log(`   Preview: ${chunk.content.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Erro no processamento do PDF:', error);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  processPDF();
}

export { processPDF };
