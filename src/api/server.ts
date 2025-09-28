import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, validateConfig } from '../config/config';
import { EmbeddingService } from '../services/embeddingService';
import { RedisVectorStoreService } from '../services/redisVectorStore';
import { SemanticSearchService } from '../services/semanticSearchService';
import { PromptService } from '../services/promptService';

export class APIServer {
  private app: express.Application;
  private semanticSearchService!: SemanticSearchService;
  private vectorStoreService!: RedisVectorStoreService;
  private embeddingService!: EmbeddingService;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    
    // Inicializar serviços
    this.initializeServices();
    
    // Configurar middleware
    this.setupMiddleware();
    
    // Configurar rotas
    this.setupRoutes();
  }

  private initializeServices(): void {
    // Validar configurações
    validateConfig();
    
    // Inicializar serviços
    this.embeddingService = new EmbeddingService({
      apiKey: config.openai.apiKey,
      model: config.openai.embeddingModel,
    });
    
    this.vectorStoreService = new RedisVectorStoreService({
      redisUrl: config.redis.url,
      indexName: config.vectorStore.indexName,
      keyPrefix: config.vectorStore.keyPrefix,
      embeddingModel: config.openai.embeddingModel,
      apiKey: config.openai.apiKey,
    });
    
    // Inicializar PromptService
    const promptService = new PromptService({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000
    });
    
    this.semanticSearchService = new SemanticSearchService(
      this.vectorStoreService,
      this.embeddingService,
      promptService
    );
  }

  private setupMiddleware(): void {
    // Segurança
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }));
    
    // Logging
    this.app.use(morgan('combined'));
    
    // Parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const healthCheck = await this.semanticSearchService.healthCheck();
        const isHealthy = healthCheck.vectorStore && healthCheck.embedding && healthCheck.redis;
        
        res.status(isHealthy ? 200 : 503).json({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          services: healthCheck
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Estatísticas do sistema
    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.semanticSearchService.getSearchStatistics();
        res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Busca semântica
    this.app.post('/search', async (req, res) => {
      try {
        const { query, maxResults = 5, scoreThreshold = 0.8, includeScore = true } = req.body;
        
        if (!query || typeof query !== 'string' || query.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Query é obrigatória e deve ser uma string não vazia',
            timestamp: new Date().toISOString()
          });
        }

        const results = await this.semanticSearchService.search(query, {
          maxResults: Math.min(maxResults, 20), // Limitar a 20 resultados
          scoreThreshold: Math.max(0, Math.min(scoreThreshold, 1)), // Entre 0 e 1
          includeScore
        });

        res.json({
          success: true,
          data: {
            query,
            results: results.map(result => ({
              content: result.document.pageContent,
              metadata: result.document.metadata,
              score: result.score,
              relevance: result.relevance
            })),
            totalResults: results.length,
            searchOptions: {
              maxResults,
              scoreThreshold,
              includeScore
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro na busca:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro interno do servidor',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Busca com filtros avançados
    this.app.post('/search/advanced', async (req, res) => {
      try {
        const { 
          query, 
          maxResults = 5, 
          scoreThreshold = 0.8, 
          includeScore = true,
          filters = {},
          sortBy = 'score'
        } = req.body;
        
        if (!query || typeof query !== 'string' || query.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Query é obrigatória e deve ser uma string não vazia',
            timestamp: new Date().toISOString()
          });
        }

        // Implementar filtros avançados se necessário
        const results = await this.semanticSearchService.search(query, {
          maxResults: Math.min(maxResults, 20),
          scoreThreshold: Math.max(0, Math.min(scoreThreshold, 1)),
          includeScore
        });

        // Aplicar filtros adicionais se necessário
        let filteredResults = results;
        if (filters.fileName) {
          filteredResults = filteredResults.filter(result => 
            result.document.metadata.fileName?.includes(filters.fileName)
          );
        }

        res.json({
          success: true,
          data: {
            query,
            results: filteredResults.map(result => ({
              content: result.document.pageContent,
              metadata: result.document.metadata,
              score: result.score,
              relevance: result.relevance
            })),
            totalResults: filteredResults.length,
            searchOptions: {
              maxResults,
              scoreThreshold,
              includeScore,
              filters,
              sortBy
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro na busca avançada:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro interno do servidor',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Pergunta contextualizada (usando PromptTemplate)
    this.app.post('/ask', async (req, res) => {
      try {
        const { question, maxResults = 5, scoreThreshold = 0.8 } = req.body;
        
        if (!question || typeof question !== 'string' || question.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Pergunta é obrigatória e deve ser uma string não vazia',
            timestamp: new Date().toISOString()
          });
        }

        const response = await this.semanticSearchService.askQuestion(question, {
          maxResults,
          scoreThreshold
        });

        res.json({
          success: true,
          data: {
            question: response.question,
            answer: response.answer,
            confidence: response.confidence,
            isRelevant: response.isRelevant,
            sources: response.sources,
            searchResults: response.searchResults.map(result => ({
              content: result.document.pageContent,
              metadata: result.document.metadata,
              score: result.score,
              relevance: result.relevance
            }))
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro na pergunta contextualizada:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro interno do servidor',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Resposta contextualizada (apenas resposta, sem detalhes da busca)
    this.app.post('/answer', async (req, res) => {
      try {
        const { question, maxResults = 5, scoreThreshold = 0.8 } = req.body;
        
        if (!question || typeof question !== 'string' || question.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Pergunta é obrigatória e deve ser uma string não vazia',
            timestamp: new Date().toISOString()
          });
        }

        const response = await this.semanticSearchService.generateContextualAnswer(question, {
          maxResults,
          scoreThreshold
        });

        res.json({
          success: true,
          data: {
            question,
            answer: response.answer,
            confidence: response.confidence,
            isRelevant: response.isRelevant,
            sources: response.contextUsed
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro na resposta contextualizada:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Erro interno do servidor',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Rota de documentação da API
    this.app.get('/api-docs', (req, res) => {
      res.json({
        name: 'TypeScript LangChain PDF Semantic Search API',
        version: '1.0.0',
        description: 'API para busca semântica em documentos PDF usando LangChain e Redis',
        endpoints: {
          'GET /health': 'Verificar status dos serviços',
          'GET /stats': 'Obter estatísticas do sistema',
          'POST /search': 'Busca semântica básica',
          'POST /search/advanced': 'Busca semântica com filtros avançados',
          'POST /ask': 'Pergunta contextualizada com PromptTemplate (resposta completa)',
          'POST /answer': 'Resposta contextualizada simples (apenas resposta)',
          'GET /api-docs': 'Documentação da API'
        },
        examples: {
          search: {
            method: 'POST',
            url: '/search',
            body: {
              query: 'What is JavaScript?',
              maxResults: 5,
              scoreThreshold: 0.8,
              includeScore: true
            }
          },
          ask: {
            method: 'POST',
            url: '/ask',
            body: {
              question: 'Como funciona o hoisting em JavaScript?',
              maxResults: 5,
              scoreThreshold: 0.8
            }
          },
          answer: {
            method: 'POST',
            url: '/answer',
            body: {
              question: 'O que são closures em JavaScript?',
              maxResults: 3,
              scoreThreshold: 0.8
            }
          }
        },
        context: {
          book: 'JavaScript: The Definitive Guide by David Flanagan',
          scope: 'Apenas perguntas sobre JavaScript, programação web, DOM e tecnologias relacionadas',
          restrictions: 'Não responde perguntas fora do contexto do livro JavaScript'
        }
      });
    });

    // Rota 404
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado',
        availableEndpoints: ['/health', '/stats', '/search', '/search/advanced', '/ask', '/answer', '/api-docs'],
        timestamp: new Date().toISOString()
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Verificar saúde dos serviços antes de iniciar
      const healthCheck = await this.semanticSearchService.healthCheck();
      if (!healthCheck.vectorStore || !healthCheck.embedding || !healthCheck.redis) {
        throw new Error('Serviços não estão funcionando corretamente');
      }

      this.app.listen(this.port, () => {
        console.log(`🚀 Servidor API iniciado na porta ${this.port}`);
        console.log(`📚 Documentação: http://localhost:${this.port}/api-docs`);
        console.log(`🏥 Health Check: http://localhost:${this.port}/health`);
        console.log(`📊 Estatísticas: http://localhost:${this.port}/stats`);
        console.log(`🔍 Busca: POST http://localhost:${this.port}/search`);
      });
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.vectorStoreService.closeConnection();
      console.log('🔌 Conexões fechadas');
    } catch (error) {
      console.error('❌ Erro ao fechar conexões:', error);
    }
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000');
  const server = new APIServer(port);
  
  server.start().catch((error) => {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Recebido SIGINT, encerrando servidor...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Recebido SIGTERM, encerrando servidor...');
    await server.stop();
    process.exit(0);
  });
}

// APIServer já exportado acima
