const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setProjectedAPY() {
  const poolAddress = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
  const projectedAPY = 15.36;

  const updated = await prisma.pool.update({
    where: {
      chainId_poolAddress: {
        chainId: 84532,
        poolAddress: poolAddress.toLowerCase(),
      },
    },
    data: {
      projectedAPY,
    },
  });

  console.log(`Updated pool ${poolAddress}`);
  console.log(`Projected APY: ${updated.projectedAPY}%`);
}

setProjectedAPY()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

