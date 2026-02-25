import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

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

  const corsOrigin = process.env.CORS_ORIGIN?.split(',');

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log(`Piron Backend running in PRODUCTION mode on port ${port}`);
  } else {
    console.log(` Piron Backend running on: http://localhost:${port}`);
    console.log(` Network access: Change localhost to your Mac's IP address`);
  }
}

bootstrap();
