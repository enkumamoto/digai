# Configure o provider AWS
provider "aws" {
  region = "us-east-1" # Substitua pela sua região
}

# Crie um cluster ECS
resource "aws_ecs_cluster" "main" {
  name = "my-cluster"
}

# Crie um Application Load Balancer (ALB)
resource "aws_lb" "main" {
  name               = "my-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id] # Substitua pelas suas subnets públicas

  enable_deletion_protection = false
}

# Crie um grupo de destino para o ALB
resource "aws_lb_target_group" "main" {
  name     = "my-target-group"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id # Substitua pela sua VPC

  health_check {
    path               = "/"
    protocol           = "HTTP"
    matcher            = "200"
    interval           = 30
    timeout            = 5
    healthy_threshold  = 3
    unhealthy_threshold = 3
  }
}

# Crie um listener para o ALB
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# Defina a definição do serviço ECS
resource "aws_ecs_service" "main" {
  name            = "my-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = 2 # Número de instâncias

  load_balancer {
    target_group_arn = aws_lb_target_group.main.arn
    container_name   = "my-container" # Nome do seu container no task definition
    container_port   = 8080 # Substitua pela porta do seu container
  }

  # Estratégia de deploy
  deployment_controller {
    type = "ECS"
  }

  # Rollback automático em caso de falha
  lifecycle {
    create_before_destroy = true
  }
}

# Defina o task definition do ECS
resource "aws_ecs_task_definition" "main" {
  family = "my-task-definition"
  container_definitions = jsonencode({
    "name": "my-container",
    "image": "${ECR_REPOSITORY_URL}:latest",
    "portMappings": [
      {
        "containerPort": 8080,
        "hostPort": 8080
      }
    ]
  })
}