import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  console.log(`   GET  /pools`);
  console.log(`   GET  /pools/featured`);
  console.log(`   GET  /pools/:poolAddress`);
  console.log(`   GET  /pools/:poolAddress/stats`);
  console.log(`   GET  /users (legacy)`);
}

bootstrap();
