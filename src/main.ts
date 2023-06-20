import * as dotenv from 'dotenv';

dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('grabber');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'parser_queue',
      queueOptions: {
        durable: false,
      },
      heartbeatInterval: 3600000, // 1 hour
    },
  });
  await app.listen(8000);
}

bootstrap();
