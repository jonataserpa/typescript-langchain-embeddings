# Visualização de Dados Redis

Este projeto inclui duas opções para visualizar e gerenciar os dados do Redis:

## 1. RedisInsight (Recomendado)

### Opção A: Redis Stack (já incluído)
- **URL**: http://localhost:8001
- **Descrição**: Interface web integrada ao Redis Stack
- **Vantagens**: Já configurado, sem necessidade de configuração adicional

### Opção B: RedisInsight Standalone
- **URL**: http://localhost:8002
- **Descrição**: Versão standalone do RedisInsight
- **Vantagens**: Mais leve, interface mais limpa

## Como usar

1. **Inicie os serviços**:
   ```bash
   docker-compose up -d
   ```

2. **Acesse uma das interfaces**:
   - Redis Stack: http://localhost:8001
   - RedisInsight: http://localhost:8002

3. **Configure a conexão** (se necessário):
   - Host: `redis-stack` (ou `localhost`)
   - Port: `6379`
   - Nome: `Local Redis`

## Funcionalidades do RedisInsight

- ✅ Visualizar todas as chaves e valores
- ✅ Executar comandos Redis diretamente
- ✅ Monitorar performance em tempo real
- ✅ Visualizar estruturas de dados (strings, hashes, lists, sets, etc.)
- ✅ Buscar e filtrar chaves
- ✅ Exportar/importar dados
- ✅ Análise de memória e performance

## Comandos úteis

```bash
# Ver logs dos containers
docker-compose logs redis-stack
docker-compose logs redisinsight

# Parar os serviços
docker-compose down

# Reiniciar apenas o RedisInsight
docker-compose restart redisinsight
```
