import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api/v1');

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Piron Backend running on: http://localhost:${port}`);
  console.log(`📊 Available routes:`);
  console.log(`   GET  /api/v1/platform/metrics`);
  console.log(`   GET  /api/v1/pools`);
  console.log(`   GET  /api/v1/pools/featured`);
  console.log(`   GET  /api/v1/pools/:poolAddress`);
  console.log(`   GET  /api/v1/pools/:poolAddress/stats`);
  console.log(`   GET  /api/v1/users/:walletAddress/positions`);
  console.log(`   GET  /api/v1/users/:walletAddress/positions/:poolAddress`);
}

bootstrap();
