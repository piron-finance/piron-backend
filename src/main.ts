import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getDeploymentInfo } from './contracts/addresses';

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

  const deployment = getDeploymentInfo();
  
  console.log('='.repeat(60));
  console.log('PIRON BACKEND STARTED');
  console.log('='.repeat(60));
  console.log(`Environment:  ${deployment.environment.toUpperCase()}`);
  console.log(`Chain:        ${deployment.network.name} (${deployment.chainId})`);
  console.log(`Version:      ${deployment.deploymentVersion}`);
  console.log(`Port:         ${port}`);
  console.log('='.repeat(60));

  if (deployment.environment === 'production') {
    console.log('Running in PRODUCTION mode');
  } else {
    console.log(`Local:        http://localhost:${port}`);
    console.log(`API Docs:     http://localhost:${port}/api/v1`);
  }
}

bootstrap();
