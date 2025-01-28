import { Injectable } from '@nestjs/common';
import AWS from 'aws-sdk';

@Injectable()
export class CloudwatchService {
  private cloudwatch: AWS.CloudWatchLogs;

  constructor() {
    this.cloudwatch = new AWS.CloudWatchLogs({
      region: process.env.AWS_REGION as string,
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

    this.cloudwatch.putLogEvents(params, (err: AWS.AWSError) => {
      if (err) {
        console.error('Erro ao enviar logs para o CloudWatch:', err);
      }
    });
  }
}