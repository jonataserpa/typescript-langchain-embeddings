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

    this.systemPrompt = `Você é um assistente especializado EXCLUSIVAMENTE no livro "JavaScript: The Definitive Guide" de David Flanagan.

LIMITAÇÕES IMPORTANTES:
- Você SÓ pode responder perguntas sobre JavaScript e tecnologias web relacionadas
- Você SÓ pode usar informações que estão no contexto fornecido do livro
- Você NÃO foi treinado em outras linguagens de programação, frameworks, ou tópicos não relacionados
- Você NÃO pode responder perguntas sobre Python, Java, C++, PHP, Ruby, Go, Rust, etc.
- Você NÃO pode responder perguntas sobre banco de dados, DevOps, IA, mobile, jogos, culinária, esportes, política, saúde, viagens, etc.

CONTEXTO DO LIVRO:
- Este é um guia definitivo e abrangente sobre JavaScript
- Cobre desde conceitos básicos até recursos avançados
- Inclui ECMAScript 5 e versões mais recentes
- Foca em programação web, DOM, Node.js e tecnologias relacionadas

INSTRUÇÕES RIGOROSAS:
1. Se a pergunta NÃO for sobre JavaScript ou tecnologias web relacionadas, responda EXATAMENTE:
   "Desculpe, mas não posso responder essa pergunta. Eu sou um assistente especializado apenas no livro 'JavaScript: The Definitive Guide' de David Flanagan. Só posso responder perguntas sobre JavaScript, programação web, DOM, e tecnologias relacionadas abordadas no livro. Por favor, faça uma pergunta sobre JavaScript."

2. Se não encontrar informação suficiente no contexto fornecido, responda EXATAMENTE:
   "Não encontrei informações suficientes sobre isso no contexto fornecido do livro 'JavaScript: The Definitive Guide'. O livro pode não cobrir esse tópico específico ou pode estar em uma seção que não foi incluída no contexto atual."

3. Use APENAS as informações fornecidas no contexto abaixo
4. Seja preciso, técnico e educativo
5. Cite exemplos de código quando apropriado
6. Mantenha o foco EXCLUSIVAMENTE no JavaScript e tecnologias relacionadas
7. Responda de forma natural e conversacional, como um especialista explicando para um colega
8. Use formatação markdown quando apropriado para destacar código e conceitos importantes`;
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
        answer: "Desculpe, mas não posso responder essa pergunta. Eu sou um assistente especializado apenas no livro 'JavaScript: The Definitive Guide' de David Flanagan. Só posso responder perguntas sobre JavaScript, programação web, DOM, e tecnologias relacionadas abordadas no livro. Por favor, faça uma pergunta sobre JavaScript.",
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
        answer: "Não encontrei informações suficientes sobre isso no contexto fornecido do livro 'JavaScript: The Definitive Guide'. O livro pode não cobrir esse tópico específico ou pode estar em uma seção que não foi incluída no contexto atual.",
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
      'react', 'vue', 'angular', 'jquery', 'typescript', 'ts', 'jsx', 'template', 'literal',
      'var', 'let', 'const', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
      'continue', 'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
      'instanceof', 'in', 'of', 'void', 'with', 'eval', 'settimeout', 'setinterval',
      'console', 'alert', 'confirm', 'prompt', 'window', 'document', 'navigator', 'location',
      'history', 'screen', 'localstorage', 'sessionstorage', 'cookies', 'cors', 'xhr',
      // Métodos de Array
      'filter', 'map', 'reduce', 'forEach', 'find', 'findindex', 'some', 'every', 'includes',
      'indexof', 'lastindexof', 'slice', 'splice', 'push', 'pop', 'shift', 'unshift', 'concat',
      'join', 'split', 'reverse', 'sort', 'fill', 'copywithin', 'entries', 'keys', 'values',
      // Métodos de String
      'charat', 'charcodeat', 'concat', 'indexof', 'lastindexof', 'localecompare', 'match',
      'replace', 'search', 'slice', 'split', 'substr', 'substring', 'tolowercase', 'touppercase',
      'trim', 'valueof', 'tostring', 'padstart', 'padend', 'repeat', 'startsWith', 'endsWith',
      // Métodos de Object
      'keys', 'values', 'entries', 'assign', 'create', 'defineproperty', 'defineproperties',
      'freeze', 'seal', 'preventextensions', 'is', 'isfrozen', 'issealed', 'isextensible',
      // Conceitos JavaScript
      'sintaxe', 'syntax', 'método', 'method', 'propriedade', 'property', 'atributo', 'attribute',
      'parâmetro', 'parameter', 'argumento', 'argument', 'retorno', 'return', 'valor', 'value',
      'tipo', 'type', 'dados', 'data', 'estrutura', 'structure', 'algoritmo', 'algorithm',
      'lógica', 'logic', 'condição', 'condition', 'expressão', 'expression', 'operador', 'operator',
      'comparação', 'comparison', 'igualdade', 'equality', 'desigualdade', 'inequality',
      'maior', 'greater', 'menor', 'less', 'maiorigual', 'greaterthan', 'menorigual', 'lessthan',
      'incremento', 'increment', 'decremento', 'decrement', 'soma', 'sum', 'subtração', 'subtraction',
      'multiplicação', 'multiplication', 'divisão', 'division', 'módulo', 'modulo', 'resto', 'remainder',
      'potência', 'power', 'exponenciação', 'exponentiation', 'raiz', 'root', 'quadrado', 'square',
      'cubo', 'cube', 'absoluto', 'absolute', 'arredondamento', 'round', 'teto', 'ceil', 'piso', 'floor',
      'aleatório', 'random', 'máximo', 'max', 'mínimo', 'min', 'média', 'average', 'soma', 'sum',
      'contagem', 'count', 'tamanho', 'size', 'comprimento', 'length', 'largura', 'width', 'altura', 'height'
    ];

    // Verificar se a pergunta contém palavras-chave relevantes
    const hasRelevantKeywords = relevantKeywords.some(keyword => 
      questionLower.includes(keyword)
    );

    // Verificar se a pergunta não é sobre outros tópicos não relacionados
    // Removendo palavras que podem aparecer em contexto JavaScript
    const unrelatedKeywords = [
      'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
      'database', 'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'devops', 'ci', 'cd', 'jenkins', 'gitlab',
      'machine learning', 'ai', 'artificial intelligence', 'data science', 'analytics', 'tensorflow',
      'mobile', 'ios', 'android', 'flutter', 'react native', 'xamarin', 'cordova', 'phonegap',
      'game', 'jogo', 'unity', 'unreal', 'opengl', 'directx', 'opencv', 'pytorch',
      'cooking', 'cozinha', 'recipe', 'receita', 'food', 'comida', 'chef', 'restaurant',
      'sports', 'esporte', 'futebol', 'football', 'basketball', 'tennis', 'soccer', 'baseball',
      'politics', 'política', 'election', 'eleição', 'government', 'governo', 'president',
      'health', 'saúde', 'medical', 'médico', 'doctor', 'doutor', 'hospital', 'medicine',
      'travel', 'viagem', 'trip', 'vacation', 'férias', 'hotel', 'flight', 'voo', 'tourism',
      'finance', 'finanças', 'bank', 'banco', 'money', 'dinheiro', 'investment', 'investimento',
      'education', 'educação', 'school', 'escola', 'university', 'universidade', 'college',
      'art', 'arte', 'music', 'música', 'painting', 'pintura', 'drawing', 'desenho',
      'history', 'história', 'war', 'guerra', 'ancient', 'antigo', 'medieval', 'medieval',
      'science', 'ciência', 'physics', 'física', 'chemistry', 'química', 'biology', 'biologia',
      'math', 'matemática', 'algebra', 'álgebra', 'geometry', 'geometria', 'calculus', 'cálculo'
    ].filter(keyword => 
      // Remover palavras que podem aparecer em contexto JavaScript
      !['do', 'in', 'of', 'to', 'for', 'with', 'by', 'at', 'on', 'up', 'down', 'out', 'off', 'over', 'under'].includes(keyword)
    );

    const hasUnrelatedKeywords = unrelatedKeywords.some(keyword => {
      // Escapar caracteres especiais na regex
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      return regex.test(questionLower);
    });
    
    // Se tem palavras não relacionadas, é irrelevante
    if (hasUnrelatedKeywords) {
      return false;
    }

    // Se não tem palavras relevantes, é irrelevante
    if (!hasRelevantKeywords) {
      return false;
    }

    // Verificar se a pergunta é muito genérica ou vaga
    const genericQuestions = [
      'o que é', 'what is', 'como funciona', 'how does', 'explique', 'explain',
      'me ajude', 'help me', 'me ensine', 'teach me', 'me fale', 'tell me'
    ];

    const isGeneric = genericQuestions.some(phrase => 
      questionLower.includes(phrase)
    );

    // Se é genérica mas não tem contexto JavaScript, é irrelevante
    if (isGeneric && !hasRelevantKeywords) {
      return false;
    }

    return true;
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
