# Sistema de Busca Semântica com LangChain, Redis e PromptTemplate

Este projeto implementa um sistema completo de busca semântica usando LangChain, OpenAI Embeddings, Redis Vector Store e PromptTemplate para respostas contextualizadas. O sistema processa PDFs, converte em chunks, cria embeddings e permite busca semântica inteligente com respostas geradas por IA.

## 🚀 Funcionalidades

- **Processamento de PDF**: Extração de texto e divisão em chunks otimizados
- **LangChain Pipeline**: Load → Transform → Embed → Store → Retrieve
- **OpenAI Embeddings**: Criação de representações semânticas usando GPT
- **Redis Vector Store**: Armazenamento e busca vetorial de alta performance
- **PromptTemplate**: Respostas contextualizadas com LLM
- **API REST**: Endpoints para busca semântica e perguntas
- **Processamento em Lotes**: Otimizado para grandes volumes de dados
- **RedisInsight**: Interface visual para visualizar dados no Redis

## 📋 Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Chave API do OpenAI
- Redis Stack (via Docker)

## 🛠️ Instalação

1. **Clone e instale dependências:**
```bash
cd /home/jonata/Documentos/typescript-langchain
npm install
```

2. **Configure as variáveis de ambiente:**
```bash
cp env.example .env
# Edite o arquivo .env com suas configurações
```

3. **Configure sua chave OpenAI:**
```bash
# No arquivo .env
OPENAI_API_KEY=sua_chave_openai_aqui
```

4. **Inicie o Redis Stack:**
```bash
docker-compose up -d
```

## 📁 Estrutura do Projeto

```
typescript-langchain/
├── src/
│   ├── config/                    # Configurações do sistema
│   ├── services/                  # Serviços principais
│   │   ├── embeddingService.ts    # Criação de embeddings com OpenAI
│   │   ├── langchainService.ts    # Serviços do LangChain
│   │   ├── promptService.ts       # PromptTemplate com LLM
│   │   ├── redisVectorStore.ts    # Armazenamento no Redis
│   │   └── semanticSearchService.ts # Busca semântica
│   ├── utils/
│   │   └── pdfProcessor.ts        # Processamento de PDF
│   ├── api/
│   │   └── server.ts              # API REST
│   ├── index.ts                   # Pipeline completo
│   ├── processPdf.ts              # Processamento de PDF
│   ├── process-all-chunks.ts      # Processamento completo otimizado
│   ├── process-optimized.ts       # Processamento otimizado
│   ├── test-pipeline.ts           # Teste do pipeline
│   └── search.ts                  # Interface de busca interativa
├── tmp/                           # PDFs para processar
├── chunks/                        # Chunks gerados (criado automaticamente)
├── docker-compose.yml             # Redis Stack + RedisInsight
└── package.json
```

## 🎯 Ordem Exata de Execução

### 1. **Preparação do Ambiente**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp env.example .env
# Editar .env com OPENAI_API_KEY

# 3. Iniciar Redis Stack
docker-compose up -d
```

### 2. **Processamento do PDF**

```bash
# Opção A: Processamento completo (recomendado)
npm run process-all

# Opção B: Processamento otimizado (para testes)
npm run process-optimized -- --max=100 --batch=10

# Opção C: Processamento básico
npm run process-pdf
```

### 3. **Iniciar API REST**

```bash
# Iniciar servidor da API
npm run api

# A API estará disponível em http://localhost:3000
```

### 4. **Fazer Perguntas**

```bash
# Via API REST
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Como funciona o hoisting em JavaScript?", "maxResults": 3}'

# Via interface interativa
npm run search
```

## 🔧 Scripts Disponíveis

```bash
# Processamento
npm run process-pdf        # Processar apenas PDF em chunks
npm run process-all        # Processar todos os chunks (10.000+)
npm run process-optimized  # Processamento otimizado com parâmetros
npm run test-pipeline      # Testar pipeline com 1 documento

# API e Busca
npm run api                # Iniciar API REST
npm run search             # Interface de busca interativa

# Desenvolvimento
npm run build              # Compilar TypeScript
npm run start              # Executar versão compilada
npm run clean              # Limpar arquivos compilados
```

## 📊 Pipeline Detalhado

### **Etapa 1: Processamento do PDF**
- **Ferramenta**: `PDFProcessor` (src/utils/pdfProcessor.ts)
- **Entrada**: PDF em `/tmp/JavaScript The Definitive Guide (David Flanagan).pdf`
- **Processo**: 
  - Extração de texto usando `pdf-parse`
  - Divisão em chunks de 600 caracteres com overlap de 100
  - Criação de metadados (página, chunk, fonte)
- **Saída**: Arquivos JSON em `/chunks/` (10.000+ chunks)

### **Etapa 2: Criação de Embeddings**
- **Ferramenta**: `EmbeddingService` (src/services/embeddingService.ts)
- **Modelo**: `text-embedding-ada-002` (OpenAI)
- **Processo**:
  - Processamento em lotes de 50 documentos
  - Rate limiting e retry automático
  - Logs detalhados de progresso
- **Saída**: Vetores de 1536 dimensões para cada chunk

### **Etapa 3: Armazenamento no Redis**
- **Ferramenta**: `RedisVectorStoreService` (src/services/redisVectorStore.ts)
- **Banco**: Redis Stack (porta 6379)
- **Índice**: `javascript_guide_vectors`
- **Chaves**: `js_guide:0`, `js_guide:1`, ..., `js_guide:9999`
- **Processo**:
  - Salvamento em lotes para otimização
  - Verificação de integridade
  - Logs detalhados de cada operação

### **Etapa 4: Busca Semântica**
- **Ferramenta**: `SemanticSearchService` (src/services/semanticSearchService.ts)
- **Processo**:
  - Conversão da pergunta em embedding
  - Busca por similaridade no Redis
  - Filtragem por score de relevância
  - Retorno dos documentos mais relevantes

### **Etapa 5: Geração de Respostas**
- **Ferramenta**: `PromptService` (src/services/promptService.ts)
- **Modelo**: `gpt-3.5-turbo` (OpenAI)
- **Processo**:
  - Validação de contexto JavaScript
  - Construção de prompt com contexto
  - Geração de resposta contextualizada
  - Avaliação de confiança e relevância

## 🗄️ Onde os Dados são Salvos

### **Redis Stack**
- **Porta**: 6379
- **Índice**: `javascript_guide_vectors`
- **Estrutura**:
  ```
  js_guide:0    -> {content: "texto do chunk", metadata: {...}, embedding: [...]}
  js_guide:1    -> {content: "texto do chunk", metadata: {...}, embedding: [...]}
  ...
  js_guide:9999 -> {content: "texto do chunk", metadata: {...}, embedding: [...]}
  ```

### **RedisInsight (Visualização)**
- **URL**: http://localhost:8002
- **Funcionalidade**: Interface web para visualizar dados do Redis
- **Acesso**: Abrir no navegador após `docker-compose up -d`

### **Arquivos Locais**
- **Chunks**: `/chunks/*.json` (10.000+ arquivos)
- **Logs**: Console com informações detalhadas

## 🔍 Como Fazer Perguntas

### **Via API REST**

```bash
# Pergunta simples
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "O que é JavaScript?", "maxResults": 3}'

# Pergunta com parâmetros
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Como funciona o hoisting em JavaScript?",
    "maxResults": 5,
    "scoreThreshold": 0.8
  }'

# Resposta contextualizada
curl -X POST http://localhost:3000/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "Explique closures em JavaScript"}'
```

### **Via Interface Interativa**

```bash
npm run search
# Digite sua pergunta quando solicitado
```

### **Exemplos de Perguntas Válidas**

- "O que é JavaScript e para que serve?"
- "Como funciona o hoisting em JavaScript?"
- "Explique closures em JavaScript"
- "Como manipular o DOM com JavaScript?"
- "O que são promises em JavaScript?"
- "Como funciona o sistema de herança em JavaScript?"
- "Explique async/await em JavaScript"

## 📊 Endpoints da API

### **GET /health**
- Verifica status do sistema
- Retorna: conexão Redis, OpenAI, documentos indexados

### **GET /stats**
- Estatísticas do sistema
- Retorna: número de documentos, tamanho do índice

### **POST /search**
- Busca semântica básica
- Parâmetros: `query`, `maxResults`, `scoreThreshold`

### **POST /ask**
- Pergunta com resposta contextualizada
- Parâmetros: `question`, `maxResults`, `scoreThreshold`
- Retorna: resposta gerada por IA + fontes

### **POST /answer**
- Resposta contextualizada avançada
- Parâmetros: `question`, `maxResults`, `scoreThreshold`
- Retorna: resposta + metadados de confiança

### **GET /api-docs**
- Documentação completa da API
- Lista todos os endpoints disponíveis

## ⚙️ Configurações

### **Variáveis de Ambiente (.env)**

```bash
# OpenAI
OPENAI_API_KEY=sua_chave_aqui
EMBEDDING_MODEL=text-embedding-ada-002

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Chunks
CHUNK_SIZE=600
CHUNK_OVERLAP=100

# API
API_PORT=3000
```

### **Configurações do Sistema**

```typescript
// src/config/config.ts
export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: 'text-embedding-ada-002',
    chatModel: 'gpt-3.5-turbo'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    indexName: 'javascript_guide_vectors',
    keyPrefix: 'js_guide:'
  },
  chunks: {
    size: 600,
    overlap: 100
  }
};
```

## 🏥 Health Check

O sistema inclui verificações de saúde para:
- ✅ Conexão OpenAI Embeddings
- ✅ Conexão Redis
- ✅ Vector Store funcionando
- ✅ Documentos indexados (10.000+)
- ✅ PromptService funcionando

## 📈 Performance

- **Chunks**: 600 caracteres com overlap de 100
- **Batch Size**: 50 documentos por lote (embeddings)
- **Busca**: Top 5 resultados com threshold de 0.8
- **Redis**: Persistência automática configurada
- **Processamento**: ~10.000 chunks em ~5-10 minutos
- **Resposta**: < 2 segundos para perguntas

## 🐳 Docker

```bash
# Iniciar Redis Stack + RedisInsight
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Verificar status
docker-compose ps
```

## 🔧 Troubleshooting

### **Erro de Conexão OpenAI**
- Verifique se `OPENAI_API_KEY` está configurada
- Confirme se tem créditos disponíveis na conta
- Teste: `npm run test-pipeline`

### **Erro de Conexão Redis**
- Verifique se Docker está rodando
- Confirme se Redis Stack está ativo: `docker-compose ps`
- Teste: `redis-cli ping`

### **PDF não encontrado**
- Verifique se o PDF está em `/tmp/`
- Confirme o nome exato do arquivo
- Execute: `ls -la tmp/`

### **Chunks não salvos**
- Verifique logs do processamento
- Confirme se Redis está funcionando
- Execute: `npm run process-all`

### **Resposta não contextualizada**
- Verifique se PromptService está funcionando
- Confirme se há documentos no Redis
- Teste: `curl http://localhost:3000/health`

## 📝 Logs Detalhados

O sistema gera logs detalhados para cada etapa:

```
🚀 INICIANDO PROCESSAMENTO COMPLETO
📄 PDF encontrado: JavaScript The Definitive Guide (David Flanagan).pdf
📊 Total de chunks: 10000
🧠 Criando embeddings para 10000 textos...
⏳ Processando lote 1/200 (50 documentos)...
✅ Lote 1 processado e salvo no Redis
💾 Documentos salvos no Redis: 50/10000
...
🎉 PROCESSAMENTO CONCLUÍDO: 10000 chunks salvos
```

## 🎯 Próximos Passos

- [x] Processamento completo de 10.000+ chunks
- [x] API REST com endpoints completos
- [x] PromptTemplate com respostas contextualizadas
- [x] RedisInsight para visualização
- [x] Processamento em lotes otimizado
- [ ] Interface web para busca
- [ ] Suporte a múltiplos PDFs
- [ ] Cache de embeddings
- [ ] Métricas de performance avançadas
- [ ] Filtros por metadados

## 📚 Tecnologias Utilizadas

- **LangChain**: Pipeline de processamento de documentos
- **OpenAI**: Embeddings (text-embedding-ada-002) e Chat (gpt-3.5-turbo)
- **Redis Stack**: Vector Store para busca semântica
- **RedisInsight**: Interface visual para Redis
- **TypeScript**: Desenvolvimento type-safe
- **Express.js**: API REST
- **Docker**: Containerização do Redis
- **pdf-parse**: Processamento de PDFs