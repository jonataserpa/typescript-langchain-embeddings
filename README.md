# Sistema de Busca Semântica com LangChain e Redis

Este projeto implementa um sistema completo de busca semântica usando LangChain, OpenAI Embeddings e Redis Vector Store. O sistema processa PDFs, converte em chunks, cria embeddings e permite busca semântica inteligente.

## 🚀 Funcionalidades

- **Processamento de PDF**: Extração de texto e divisão em chunks otimizados
- **LangChain Pipeline**: Load → Transform → Embed → Store → Retrieve
- **OpenAI Embeddings**: Criação de representações semânticas usando GPT
- **Redis Vector Store**: Armazenamento e busca vetorial de alta performance
- **Busca Semântica**: Interface interativa para consultas inteligentes

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
│   ├── config/           # Configurações do sistema
│   ├── services/         # Serviços principais (LangChain, Redis, etc.)
│   ├── utils/           # Utilitários (processamento de PDF)
│   ├── index.ts         # Pipeline completo
│   ├── processPdf.ts    # Processamento de PDF
│   └── search.ts        # Interface de busca interativa
├── tmp/                 # PDFs para processar
├── chunks/             # Chunks gerados (criado automaticamente)
├── docker-compose.yml   # Redis Stack
└── package.json
```

## 🎯 Como Usar

### 1. Processar PDF

```bash
# Processar apenas o PDF em chunks
npm run process-pdf
```

### 2. Executar Pipeline Completo

```bash
# Executar todo o pipeline: Load → Transform → Embed → Store → Retrieve
npm run dev
```

### 3. Busca Interativa

```bash
# Interface de busca semântica
npm run search
```

## 🔧 Scripts Disponíveis

```bash
npm run build      # Compilar TypeScript
npm run start      # Executar versão compilada
npm run dev        # Executar pipeline completo
npm run process-pdf # Processar apenas PDF
npm run search     # Interface de busca interativa
npm run clean      # Limpar arquivos compilados
```

## 📊 Pipeline LangChain

O sistema segue todas as etapas do pipeline LangChain:

1. **Load**: Carrega documentos usando `DirectoryLoader`
2. **Transform**: Divide texto em chunks com `TokenTextSplitter` (600 tokens)
3. **Embed**: Cria embeddings usando `OpenAIEmbeddings`
4. **Store**: Armazena no `RedisVectorStore`
5. **Retrieve**: Busca semântica inteligente

## 🔍 Exemplos de Busca

O sistema pode responder perguntas como:
- "What is JavaScript?"
- "How to define functions in JavaScript?"
- "JavaScript objects and properties"
- "DOM manipulation techniques"
- "Async programming in JavaScript"

## ⚙️ Configurações

### Variáveis de Ambiente (.env)

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
```

### Redis Vector Store

- **Index**: `javascript_guide_vectors`
- **Key Prefix**: `js_guide:`
- **Porta**: 6379 (Redis), 8001 (RedisInsight)

## 🏥 Health Check

O sistema inclui verificações de saúde para:
- Conexão OpenAI Embeddings
- Conexão Redis
- Vector Store funcionando
- Documentos indexados

## 📈 Performance

- **Chunks**: 600 caracteres com overlap de 100
- **Batch Size**: 50 documentos por lote (embeddings)
- **Busca**: Top 5 resultados com threshold de 0.8
- **Redis**: Persistência automática configurada

## 🐳 Docker

```bash
# Iniciar Redis Stack
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

## 🔧 Troubleshooting

### Erro de Conexão OpenAI
- Verifique se `OPENAI_API_KEY` está configurada
- Confirme se tem créditos disponíveis na conta

### Erro de Conexão Redis
- Verifique se Docker está rodando
- Confirme se Redis Stack está ativo: `docker-compose ps`

### PDF não encontrado
- Verifique se o PDF está em `/tmp/`
- Confirme o nome exato do arquivo

## 📝 Logs

O sistema gera logs detalhados para cada etapa:
- ✅ Sucesso
- ❌ Erro
- 📊 Estatísticas
- 🔍 Resultados de busca

## 🎯 Próximos Passos

- [ ] Interface web para busca
- [ ] Suporte a múltiplos PDFs
- [ ] Cache de embeddings
- [ ] Métricas de performance
- [ ] Filtros avançados por metadados
