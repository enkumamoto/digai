**Desafio da Plataforma: API REST Escalável e Resiliente com TypeScript, NestJS e AWS
Este repositório contém o código para uma API REST desenvolvida com TypeScript, NestJS e AWS, demonstrando escalabilidade, resiliência e observabilidade.
---

*Estrutura do Projeto
parte1/
├── Dockerfile
├── index.ts
├── main.tf
├── pipeline_ci_ecr.yaml
├── pipeline_iac_pulumi.yaml
├── pipeline_iac_terraform.yaml
└── src
    ├── cloudwatch.service.ts
    └── prometheus.service.ts

*Parte 1: Contêinerização e Deploy Básico
Dockerfile
'''
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
'''

*Pipeline de CI para ECR (pipeline_ci_ecr.yaml)

'''yml
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
'''

*Parte 2: Provisionamento de Infraestrutura com Pulumi

Instalação do Pulumi

'''bash
    curl -fsSL https://get.pulumi.com/ | sh
'''

*Criação do Projeto Pulumi
'''bash
    pulumi new typescript
'''

*Código Pulumi (index.ts)
'''typeScript
    import * as pulumi from "@pulumi/pulumi";
    import * as aws from "@pulumi/aws";
    import * as awsx from "@pulumi/awsx";

    // Crie um cluster ECS
    const cluster = new aws.ecs.Cluster("my-cluster");

    // Crie um Application Load Balancer (ALB)
    const alb = new awsx.lb.ApplicationLoadBalancer("my-alb", {
    vpc: awsx.ec2.Vpc.getDefault(), // Use o VPC padrão ou especifique o seu
    internetFacing: true,
    });

    // Crie um grupo de destino para o ALB
    const targetGroup = alb.createTargetGroup("my-target-group", {
    port: 8080,
    protocol: "HTTP",
    healthCheck: {
        path: "/",
        protocol: "HTTP",
        matcher: "200",
        interval: 30,
        timeout: 5,
        healthyThreshold: 3,
        unhealthyThreshold: 3,
    },
    });

    // Crie um serviço ECS
    const service = new awsx.ecs.FargateService("my-service", {
    cluster,
    taskDefinitionArgs: {
        container: {
        image: `${process.env.ECR_REPOSITORY_URL}:latest`,
        portMappings: [{ containerPort: 8080 }],
        },
    },
    desiredCount: 2, // Número de instâncias
    loadBalancers: [
        {
        targetGroupArn: targetGroup.arn,
        containerName: "my-container", // Nome do seu container no task definition
        },
    ],
    });

    // Exporte o endpoint do ALB
    export const url = alb.loadBalancer.dnsName;
'''

*Pipeline para IaC com Pulumi (pipeline_iac_pulumi.yaml)
'''yml
    name: IaC

    on:
    push:
        branches:
        - main

    jobs:
    deploy-infrastructure:
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

        - name: Install Pulumi CLI
            uses: pulumi/actions@v4

        - name: Pulumi Login
            run: pulumi login --access-token ${{ secrets.PULUMI_ACCESS_TOKEN }}

        - name: Pulumi Preview
            run: pulumi preview --stack dev

        - name: Pulumi Up
            run: pulumi up --stack dev --yes
'''

*Parte 3: Observabilidade
cloudwatch.service.ts
'''typeScript
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
        logGroupName: '/aws/ecs/my-cluster/my-service', // Substitua pelo seu log group
        logStreamName: 'my-stream', // Substitua pelo seu log stream
        logEvents: [
            {
            timestamp: Date.now(),
            message: message,
            },
        ],
        };

        this.cloudwatch.putLogEvents(params, (err, data) => {
        if (err) {
            console.error('Erro ao enviar logs para o CloudWatch:', err);
        }
        });
    }
    }
'''

prometheus.service.ts
'''typeScript
    import { Injectable } from '@nestjs/common';
    import { Counter, register } from 'prom-client';
    import { collectDefaultMetrics } from 'prom-client';

    @Injectable()
    export class PrometheusService {
    private requestCounter: Counter;

    constructor() {
        this.requestCounter = new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        });

        collectDefaultMetrics({
        prefix: 'nodejs_',
        register: register,
        });
    }

    incrementRequestCount() {
        this.requestCounter.inc();
    }

    getMetrics(): Promise<string> {
        return register.metrics();
    }
    }
'''

**Instruções
*Executando os Pipelines
1. Configure as Secrets no GitHub:

AWS_ACCESS_KEY_ID: Sua chave de acesso AWS.
AWS_SECRET_ACCESS_KEY: Sua chave secreta AWS.
AWS_REGION: A região da AWS para seus recursos.
ECR_REPOSITORY_URL: A URL do seu repositório ECR.
ECS_CLUSTER_NAME: O nome do seu cluster ECS.
ECS_SERVICE_NAME: O nome do seu serviço ECS.
PULUMI_ACCESS_TOKEN: Seu token de acesso do Pulumi.

2. Dê push para o seu código no GitHub:

Os pipelines serão executados automaticamente após o push para o branch main.

*Testando a Aplicação
1. Localmente:

Clone o repositório.
Instale as dependências: npm install.
Execute a aplicação: npm run start:dev.
Acesse a API em http://localhost:8080.

2. Em produção:

Após a execução dos pipelines, a aplicação estará disponível no endpoint do ALB.
O endpoint será exibido na saída do Pulumi após o deploy.

*Monitorando e Observando o Sistema
1. CloudWatch:

Os logs da aplicação serão enviados para o CloudWatch.
Você pode monitorar os logs no console da AWS.

2. Prometheus:

As métricas da aplicação serão expostas no endpoint /metrics.
Você pode configurar o Prometheus para coletar as métricas.

**Observações
Este README fornece um guia básico para executar e testar a aplicação.
Para obter mais detalhes sobre a implementação, consulte o código fonte.
Certifique-se de configurar corretamente as secrets no GitHub antes de executar os pipelines.
Este exemplo utiliza o Pulumi para provisionamento de infraestrutura. Você pode adaptar o código para usar outras ferramentas, como Terraform.

**Recursos Adicionais
Documentação do NestJS
Documentação do Pulumi
Documentação da AWS

Este README abrangente fornece todas as informações necessárias para entender, executar e observar a aplicação. Ele também inclui links para recursos adicionais para aprofundar seus conhecimentos.