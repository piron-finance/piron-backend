const { ethers } = require('ethers');

// Test the exact code
const receiver = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1";
console.log("Testing address:", receiver);

try {
  const normalized = ethers.getAddress(receiver);
  console.log("✅ Normalized:", normalized);
  console.log("✅ SUCCESS - Address validation works!");
} catch (error) {
  console.log("❌ ERROR:", error.message);
}


