# Use uma imagem base Node.js para produção
FROM node:16-alpine as builder

# Defina o diretório de trabalho
WORKDIR /app

# Copie os arquivos package.json e package-lock.json (se existir)
COPY package*.json ./

# Instale as dependências
RUN npm install --production

# Copie o restante do código fonte
COPY . .

# Construa o aplicativo NestJS
RUN npm run build

# Use uma imagem menor para o runtime
FROM node:16-alpine

# Defina o diretório de trabalho
WORKDIR /app

# Copie os arquivos do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Exponha a porta 8080
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["node", "dist/main.js"]