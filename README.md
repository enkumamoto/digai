# Desafio da Plataforma: API REST Escalável e Resiliente com TypeScript, NestJS e AWS

Este repositório contém o código para uma API REST desenvolvida com TypeScript, NestJS e AWS, demonstrando escalabilidade, resiliência e observabilidade.

---

## 📂 Estrutura do Projeto

```
parte1/
├── Dockerfile
├── index.ts
├── main.tf
├── pipeline_ci_ecr.yaml
├── pipeline_iac_pulumi.yaml
├── pipeline_iac_terraform.yaml
└── src/
    ├── cloudwatch.service.ts
    └── prometheus.service.ts
```

---

## 🚀 Parte 1: Contêinerização e Deploy Básico

### Dockerfile

```dockerfile
# Use uma imagem base Node.js para produção
FROM node:16-alpine as builder

# Defina o diretório de trabalho
WORKDIR /app

# Copie os arquivos package.json e package-lock.json
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
```

### Pipeline de CI para ECR (`pipeline_ci_ecr.yaml`)

```yaml
name: CI/CD

on:
  push:
    branches:
      - main

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and tag Docker image
        run: |
          docker build -t $ECR_REPOSITORY_URL:$GITHUB_SHA .
          docker tag $ECR_REPOSITORY_URL:$GITHUB_SHA $ECR_REPOSITORY_URL:latest

      - name: Push Docker image to ECR
        run: |
          docker push $ECR_REPOSITORY_URL:$GITHUB_SHA
          docker push $ECR_REPOSITORY_URL:latest

      - name: Update ECS service
        run: |
          aws ecs update-service --cluster $ECS_CLUSTER_NAME --service $ECS_SERVICE_NAME --force-new-deployment --image $ECR_REPOSITORY_URL:$GITHUB_SHA
```

---

## 🏗️ Parte 2: Provisionamento de Infraestrutura com Pulumi

### Instalação do Pulumi

```bash
curl -fsSL https://get.pulumi.com/ | sh
```

### Criação do Projeto Pulumi

```bash
pulumi new typescript
```

### Código Pulumi (`index.ts`)

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Criação do cluster ECS
const cluster = new aws.ecs.Cluster("my-cluster");

// Criação do ALB
const alb = new awsx.lb.ApplicationLoadBalancer("my-alb", {
  vpc: awsx.ec2.Vpc.getDefault(),
  internetFacing: true,
});

// Grupo de destino para o ALB
const targetGroup = alb.createTargetGroup("my-target-group", {
  port: 8080,
  protocol: "HTTP",
  healthCheck: {
    path: "/",
    matcher: "200",
  },
});

// Serviço ECS
const service = new awsx.ecs.FargateService("my-service", {
  cluster,
  taskDefinitionArgs: {
    container: {
      image: `${process.env.ECR_REPOSITORY_URL}:latest`,
      portMappings: [{ containerPort: 8080 }],
    },
  },
  desiredCount: 2,
  loadBalancers: [{
    targetGroupArn: targetGroup.arn,
    containerName: "my-container",
  }],
});

export const url = alb.loadBalancer.dnsName;
```

---

## 📊 Parte 3: Observabilidade

### CloudWatch (`cloudwatch.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class CloudwatchService {
  private cloudwatch: AWS.CloudWatchLogs;

  constructor() {
    this.cloudwatch = new AWS.CloudWatchLogs({
      region: process.env.AWS_REGION,
    });
  }

  log(message: string) {
    const params = {
      logGroupName: '/aws/ecs/my-cluster/my-service',
      logStreamName: 'my-stream',
      logEvents: [{ timestamp: Date.now(), message }],
    };

    this.cloudwatch.putLogEvents(params, (err) => {
      if (err) console.error('Erro ao enviar logs para o CloudWatch:', err);
    });
  }
}
```

### Prometheus (`prometheus.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { Counter, register, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class PrometheusService {
  private requestCounter: Counter;

  constructor() {
    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
    });
    collectDefaultMetrics({ prefix: 'nodejs_', register });
  }

  incrementRequestCount() {
    this.requestCounter.inc();
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }
}
```

---

## 📌 Instruções

### Executando os Pipelines

1. Configure as **Secrets** no GitHub:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `ECR_REPOSITORY_URL`
   - `ECS_CLUSTER_NAME`
   - `ECS_SERVICE_NAME`
   - `PULUMI_ACCESS_TOKEN`

2. Faça push do código para o GitHub:
   - Os pipelines serão executados automaticamente ao enviar código para `main`.

### Testando a Aplicação

#### Localmente

```bash
git clone <repositório>
npm install
npm run start:dev
```

Acesse em: `http://localhost:8080`

#### Em Produção

Após os pipelines, a aplicação estará disponível no **endpoint do ALB** (exibido na saída do Pulumi).

### Monitoramento

- **CloudWatch**: Logs disponíveis no console da AWS.
- **Prometheus**: Métricas disponíveis no endpoint `/metrics`.

---

## 📚 Recursos Adicionais

- [Documentação NestJS](https://nestjs.com/)
- [Documentação Pulumi](https://www.pulumi.com/docs/)
- [Documentação AWS](https://docs.aws.amazon.com/)

---

Este README fornece um guia claro e padronizado para configurar, executar e monitorar a aplicação. 🚀

