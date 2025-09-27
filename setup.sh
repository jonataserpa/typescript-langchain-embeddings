#!/bin/bash

echo "🚀 Configurando sistema de busca semântica com LangChain e Redis..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale Node.js 18+ primeiro."
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Por favor, instale Docker primeiro."
    exit 1
fi

echo "✅ Docker encontrado: $(docker --version)"

# Verificar se Docker Compose está disponível
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose não encontrado. Por favor, instale Docker Compose primeiro."
    exit 1
fi

echo "✅ Docker Compose encontrado"

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo "✅ Dependências instaladas com sucesso"

# Verificar se arquivo .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp env.example .env
    echo "⚠️  IMPORTANTE: Edite o arquivo .env e configure sua OPENAI_API_KEY"
    echo "   nano .env"
fi

# Verificar se Redis está rodando
echo "🐳 Iniciando Redis Stack..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Erro ao iniciar Redis Stack"
    exit 1
fi

echo "⏳ Aguardando Redis inicializar..."
sleep 10

# Verificar se Redis está funcionando
if docker-compose ps | grep -q "Up"; then
    echo "✅ Redis Stack está rodando"
else
    echo "❌ Redis Stack não está funcionando corretamente"
    exit 1
fi

echo ""
echo "🎉 Setup concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure sua OPENAI_API_KEY no arquivo .env"
echo "2. Execute: npm run dev (para processar PDF e criar embeddings)"
echo "3. Execute: npm run search (para busca interativa)"
echo ""
echo "🔧 Comandos úteis:"
echo "   npm run process-pdf  # Processar apenas o PDF"
echo "   npm run dev         # Pipeline completo"
echo "   npm run search      # Busca interativa"
echo "   docker-compose logs # Ver logs do Redis"
echo ""
echo "🌐 RedisInsight (interface web): http://localhost:8001"
echo ""
