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
    console.log(`🚀 Piron Backend running in PRODUCTION mode on port ${port}`);
  } else {
    console.log(`🚀 Piron Backend running on: http://localhost:${port}`);
    console.log(`🌐 Network access: Change localhost to your Mac's IP address`);
  }
  console.log(`\n📊 Public Routes:`);
  console.log(`   GET  /api/v1/platform/metrics`);
  console.log(`   GET  /api/v1/pools`);
  console.log(`   GET  /api/v1/pools/featured`);
  console.log(`   GET  /api/v1/pools/:poolAddress`);
  console.log(`   GET  /api/v1/pools/:poolAddress/stats`);
  console.log(`\n👤 User Routes:`);
  console.log(`   GET  /api/v1/users/:walletAddress/positions`);
  console.log(`   GET  /api/v1/users/:walletAddress/positions/:poolAddress`);
  console.log(`   GET  /api/v1/users/:walletAddress/transactions`);
  console.log(`   POST /api/v1/deposits`);
  console.log(`\n💸 Transaction Routes:`);
  console.log(`   GET  /api/v1/pools/:poolAddress/transactions`);
  console.log(`   GET  /api/v1/transactions/:txHash`);
  console.log(`\n🔐 Admin Routes:`);
  console.log(`   POST  /api/v1/admin/pools/create`);
  console.log(`   POST  /api/v1/admin/pools/pause`);
  console.log(`   POST  /api/v1/admin/pools/:poolAddress/unpause`);
  console.log(`   POST  /api/v1/admin/assets/approve`);
  console.log(`   GET   /api/v1/admin/pools`);
  console.log(`   GET   /api/v1/admin/pools/:id`);
  console.log(`   PATCH /api/v1/admin/pools/:id`);
  console.log(`   GET   /api/v1/admin/analytics/overview`);
  console.log(`   GET   /api/v1/admin/activity`);
  console.log(`   DEL   /api/v1/admin/pools/:id`);
  console.log(`\n🏦 SPV Routes:`);
  console.log(`   POST /api/v1/spv/pools/:poolAddress/allocate`);
  console.log(`   POST /api/v1/spv/pools/:poolAddress/instruments/add`);
  console.log(`   POST /api/v1/spv/pools/:poolAddress/instruments/:instrumentId/mature`);
  console.log(`   GET  /api/v1/spv/pools`);
  console.log(`   GET  /api/v1/spv/pools/:poolAddress`);
  console.log(`   GET  /api/v1/spv/pools/:poolAddress/instruments`);
  console.log(`   GET  /api/v1/spv/operations`);
  console.log(`   GET  /api/v1/spv/analytics/overview`);
  console.log(`   GET  /api/v1/spv/analytics/maturities`);
  console.log(`\n🔍 Indexers:`);
  console.log(`   Pool creation watcher started`);
  console.log(`   Deposit indexer started`);
  console.log(`⛓️  Blockchain providers initialized`);
}

bootstrap();
