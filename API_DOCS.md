# API Documentation - TypeScript LangChain PDF Semantic Search

## 🚀 Início Rápido

### 1. Iniciar o servidor API:
```bash
# Desenvolvimento
npm run api

# Produção (após build)
npm run build
npm run api:prod
```

### 2. Acessar documentação interativa:
- **URL Base**: http://localhost:3000
- **Documentação**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

## 📋 Endpoints Disponíveis

### 1. **GET /health** - Status dos Serviços
Verifica se todos os serviços estão funcionando.

**Resposta de Sucesso (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "vectorStore": true,
    "embedding": true,
    "redis": true
  }
}
```

**Resposta de Erro (503):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "vectorStore": false,
    "embedding": true,
    "redis": false
  }
}
```

### 2. **GET /stats** - Estatísticas do Sistema
Retorna informações sobre o sistema e dados armazenados.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totalDocuments": 30000,
    "indexName": "javascript_guide_vectors",
    "keyPrefix": "js_guide:",
    "embeddingModel": "text-embedding-ada-002",
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. **POST /search** - Busca Semântica Básica
Realiza busca semântica nos documentos PDF.

**Request Body:**
```json
{
  "query": "What is JavaScript?",
  "maxResults": 5,
  "scoreThreshold": 0.8,
  "includeScore": true
}
```

**Parâmetros:**
- `query` (string, obrigatório): Texto da consulta
- `maxResults` (number, opcional): Máximo de resultados (padrão: 5, máximo: 20)
- `scoreThreshold` (number, opcional): Limite de relevância 0-1 (padrão: 0.8)
- `includeScore` (boolean, opcional): Incluir pontuação (padrão: true)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "query": "What is JavaScript?",
    "results": [
      {
        "content": "JavaScript is a high-level, interpreted programming language...",
        "metadata": {
          "fileName": "JavaScript The Definitive Guide (David Flanagan).pdf",
          "chunkIndex": 1,
          "pageNumber": 1
        },
        "score": 0.95,
        "relevance": "high"
      }
    ],
    "totalResults": 1,
    "searchOptions": {
      "maxResults": 5,
      "scoreThreshold": 0.8,
      "includeScore": true
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. **POST /search/advanced** - Busca Avançada
Busca semântica com filtros adicionais.

**Request Body:**
```json
{
  "query": "JavaScript functions",
  "maxResults": 10,
  "scoreThreshold": 0.7,
  "includeScore": true,
  "filters": {
    "fileName": "JavaScript"
  },
  "sortBy": "score"
}
```

**Parâmetros Adicionais:**
- `filters` (object, opcional): Filtros adicionais
  - `fileName` (string): Filtrar por nome do arquivo
- `sortBy` (string, opcional): Ordenar por "score" ou "relevance"

### 5. **GET /api-docs** - Documentação da API
Retorna informações sobre todos os endpoints disponíveis.

## 🔧 Exemplos de Uso

### cURL

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Busca Simples:**
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What is JavaScript?", "maxResults": 3}'
```

**Busca Avançada:**
```bash
curl -X POST http://localhost:3000/search/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "query": "JavaScript functions",
    "maxResults": 5,
    "scoreThreshold": 0.8,
    "filters": {"fileName": "JavaScript"}
  }'
```

### JavaScript/Fetch

```javascript
// Busca simples
const response = await fetch('http://localhost:3000/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'What is JavaScript?',
    maxResults: 5,
    scoreThreshold: 0.8
  })
});

const data = await response.json();
console.log(data);
```

### Python/Requests

```python
import requests

# Busca simples
response = requests.post('http://localhost:3000/search', json={
    'query': 'What is JavaScript?',
    'maxResults': 5,
    'scoreThreshold': 0.8
})

data = response.json()
print(data)
```

## 🛠️ Configuração

### Variáveis de Ambiente

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key
EMBEDDING_MODEL=text-embedding-ada-002

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# API Server
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Chunk Configuration
CHUNK_SIZE=600
CHUNK_OVERLAP=100
```

### CORS
Por padrão, a API aceita requisições de:
- http://localhost:3000
- http://localhost:3001

Para adicionar outras origens, configure a variável `ALLOWED_ORIGINS`.

## 📊 Monitoramento

### Logs
O servidor usa Morgan para logging. Os logs incluem:
- Timestamp
- Método HTTP
- URL
- Status code
- Tempo de resposta
- User-Agent

### Health Check
Use o endpoint `/health` para monitoramento automatizado:
- Verifica conexão com Redis
- Verifica conexão com OpenAI
- Verifica estado do Vector Store

## 🚨 Tratamento de Erros

### Códigos de Status HTTP
- **200**: Sucesso
- **400**: Erro de validação (query inválida)
- **404**: Endpoint não encontrado
- **500**: Erro interno do servidor
- **503**: Serviços indisponíveis

### Formato de Erro
```json
{
  "success": false,
  "error": "Mensagem de erro descritiva",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔒 Segurança

- **Helmet**: Headers de segurança
- **CORS**: Controle de origem
- **Rate Limiting**: Limite de requisições (configurável)
- **Input Validation**: Validação de entrada
- **Error Handling**: Tratamento seguro de erros

## 📈 Performance

### Otimizações Implementadas
- Processamento em lotes para embeddings
- Cache de conexões Redis
- Compressão de respostas
- Timeout de requisições
- Pool de conexões

### Limites
- Máximo 20 resultados por busca
- Timeout de 30 segundos por requisição
- Limite de 10MB por requisição
