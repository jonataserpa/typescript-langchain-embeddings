import { ChatOpenAI } from '@langchain/openai';
import { Document } from 'langchain/document';

export interface PromptConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ContextualResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  contextUsed: string[];
  isRelevant: boolean;
  source: string;
}

export class PromptService {
  private chat: ChatOpenAI;
  private config: PromptConfig;
  private systemPrompt: string;

  constructor(config: PromptConfig) {
    this.config = config;
    this.chat = new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.systemPrompt = `Você é um assistente especializado em JavaScript baseado no livro "JavaScript: The Definitive Guide" de David Flanagan.

CONTEXTO DO LIVRO:
- Este é um guia definitivo e abrangente sobre JavaScript
- Cobre desde conceitos básicos até recursos avançados
- Inclui ECMAScript 5 e versões mais recentes
- Foca em programação web, DOM, Node.js e muito mais

INSTRUÇÕES IMPORTANTES:
1. Responda APENAS perguntas relacionadas a JavaScript e programação web
2. Use APENAS as informações fornecidas no contexto abaixo
3. Se a pergunta não for sobre JavaScript, responda: "Esta pergunta está fora do contexto do livro JavaScript: The Definitive Guide. Por favor, faça uma pergunta sobre JavaScript, programação web, DOM, ou conceitos relacionados."
4. Se não encontrar informação suficiente no contexto, diga: "Não encontrei informações suficientes sobre isso no contexto fornecido do livro JavaScript: The Definitive Guide."
5. Seja preciso, técnico e educativo
6. Cite exemplos de código quando apropriado
7. Mantenha o foco no JavaScript e tecnologias relacionadas
8. Responda de forma natural e conversacional, como um especialista explicando para um colega
9. Use formatação markdown quando apropriado para destacar código e conceitos importantes`;
  }

  async generateResponse(
    question: string,
    relevantDocuments: Document[],
    options: {
      maxContextLength?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<ContextualResponse> {
    const {
      maxContextLength = 4000,
      includeMetadata = true
    } = options;

    // Validar se a pergunta é relevante ao contexto JavaScript
    const isRelevant = this.isQuestionRelevant(question);
    
    if (!isRelevant) {
      return {
        answer: "Esta pergunta está fora do contexto do livro JavaScript: The Definitive Guide. Por favor, faça uma pergunta sobre JavaScript, programação web, DOM, ou conceitos relacionados.",
        confidence: 'high',
        contextUsed: [],
        isRelevant: false,
        source: 'context_validation'
      };
    }

    // Construir contexto a partir dos documentos relevantes
    const context = this.buildContext(relevantDocuments, maxContextLength, includeMetadata);
    
    if (context.length === 0) {
      return {
        answer: "Não encontrei informações suficientes sobre isso no contexto fornecido do livro JavaScript: The Definitive Guide.",
        confidence: 'low',
        contextUsed: [],
        isRelevant: true,
        source: 'no_context'
      };
    }

    try {
      // Usar o LLM real para gerar a resposta
      const prompt = `${this.systemPrompt}\n\nContexto do livro JavaScript: The Definitive Guide:\n\n${context}\n\nPergunta: ${question}\n\nResposta:`;
      
      const response = await this.chat.invoke(prompt);
      const answer = response.content.toString();
      
      return {
        answer,
        confidence: this.calculateConfidence(relevantDocuments, answer),
        contextUsed: relevantDocuments.map(doc => doc.metadata.source || 'unknown'),
        isRelevant: true,
        source: 'llm_generated'
      };
    } catch (error) {
      console.error('Erro ao gerar resposta com LLM:', error);
      return {
        answer: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        confidence: 'low',
        contextUsed: [],
        isRelevant: true,
        source: 'error'
      };
    }
  }

  private isQuestionRelevant(question: string): boolean {
    const questionLower = question.toLowerCase();
    
    // Palavras-chave relacionadas a JavaScript e programação web
    const relevantKeywords = [
      'javascript', 'js', 'ecmascript', 'es6', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020',
      'dom', 'bom', 'html', 'css', 'web', 'browser', 'navegador', 'frontend', 'backend', 'node', 'nodejs',
      'function', 'função', 'variable', 'variável', 'object', 'objeto', 'array', 'string', 'number', 'boolean',
      'class', 'classe', 'prototype', 'inheritance', 'herança', 'closure', 'callback', 'promise', 'async', 'await',
      'event', 'evento', 'listener', 'handler', 'ajax', 'fetch', 'api', 'json', 'xml', 'http', 'https',
      'programming', 'programação', 'coding', 'código', 'script', 'scripting', 'development', 'desenvolvimento',
      'debug', 'debugging', 'error', 'erro', 'exception', 'try', 'catch', 'finally', 'throw',
      'loop', 'for', 'while', 'if', 'else', 'switch', 'case', 'break', 'continue', 'return',
      'scope', 'escopo', 'hoisting', 'this', 'bind', 'call', 'apply', 'arrow', 'function',
      'module', 'import', 'export', 'require', 'package', 'npm', 'yarn', 'webpack', 'babel',
      'react', 'vue', 'angular', 'jquery', 'typescript', 'ts', 'jsx', 'template', 'literal'
    ];

    // Verificar se a pergunta contém palavras-chave relevantes
    const hasRelevantKeywords = relevantKeywords.some(keyword => 
      questionLower.includes(keyword)
    );

    // Verificar se a pergunta não é sobre outros tópicos não relacionados
    const unrelatedKeywords = [
      'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
      'database', 'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'devops', 'ci', 'cd',
      'machine learning', 'ai', 'artificial intelligence', 'data science', 'analytics',
      'mobile', 'ios', 'android', 'flutter', 'react native', 'xamarin',
      'game', 'jogo', 'unity', 'unreal', 'opengl', 'directx',
      'cooking', 'cozinha', 'recipe', 'receita', 'food', 'comida',
      'sports', 'esporte', 'futebol', 'football', 'basketball', 'tennis',
      'politics', 'política', 'election', 'eleição', 'government', 'governo',
      'health', 'saúde', 'medical', 'médico', 'doctor', 'doutor',
      'travel', 'viagem', 'trip', 'vacation', 'férias', 'hotel', 'flight', 'voo'
    ];

    const hasUnrelatedKeywords = unrelatedKeywords.some(keyword => 
      questionLower.includes(keyword)
    );

    return hasRelevantKeywords && !hasUnrelatedKeywords;
  }

  private buildContext(
    documents: Document[], 
    maxLength: number, 
    includeMetadata: boolean
  ): string {
    let context = '';
    let currentLength = 0;

    for (const doc of documents) {
      const docContent = includeMetadata 
        ? `[Fonte: ${doc.metadata.source || 'Desconhecida'}]\n${doc.pageContent}\n\n`
        : `${doc.pageContent}\n\n`;

      if (currentLength + docContent.length > maxLength) {
        break;
      }

      context += docContent;
      currentLength += docContent.length;
    }

    return context.trim();
  }


  private calculateConfidence(documents: Document[], answer: string): 'high' | 'medium' | 'low' {
    if (documents.length === 0) return 'low';
    if (documents.length >= 3) return 'high';
    if (documents.length >= 2) return 'medium';
    return 'low';
  }

}
