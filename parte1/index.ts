import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/aws";

// Crie um cluster ECS
const cluster = new aws.ecs.Cluster("my-cluster");

// Crie um Application Load Balancer (ALB)
const alb = new awsx.elasticloadbalancingv2.ApplicationLoadBalancer("my-alb", {
  external: true,
});

// Crie um grupo de destino para o ALB
const targetGroup = new awsx.elasticloadbalancingv2.ApplicationTargetGroup("my-target-group", {
  port: 8080,
  protocol: "HTTP",
  targetType: "ip",
  healthCheck: {
    path: "/",
    protocol: "HTTP",
    matcher: "200",
    interval: 30,
    timeout: 5,
    healthyThreshold: 3,
    unhealthyThreshold: 3,
  },
  loadBalancer: alb,
});

// Crie um serviço ECS
const service = new awsx.ecs.FargateService("my-service", {
  cluster: cluster.arn,
  taskDefinitionArgs: {
    container: {
      name: "my-container",
      image: `${process.env.ECR_REPOSITORY_URL}:latest`,
      portMappings: [{ containerPort: 8080 }],
    },
  },
  desiredCount: 2, // Número de instâncias
  loadBalancers: [
    {
      targetGroupArn: targetGroup.targetGroup.arn,
      containerName: "my-container", // Nome do seu container no task definition
      containerPort: 8080,
    },
  ],
});

// Exporte o endpoint do ALB
export const url = alb.loadBalancer.dnsName;