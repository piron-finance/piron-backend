#!/usr/bin/env node
/**
 * Get SPV Address from AccessManager
 * This script checks which address has the SPV_ROLE in the AccessManager contract
 */

const { ethers } = require('ethers');

// AccessManager ABI
const ACCESS_MANAGER_ABI = [
  {
    "type": "function",
    "name": "SPV_ROLE",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isSPV",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMemberCount",
    "inputs": [{ "name": "role", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMember",
    "inputs": [
      { "name": "role", "type": "bytes32", "internalType": "bytes32" },
      { "name": "index", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      { "name": "role", "type": "bytes32", "internalType": "bytes32" },
      { "name": "account", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  }
];

const ACCESS_MANAGER_ADDRESS = '0x05b326d12D802DF04b96Fa82335c5b9e7e22EA4b';

async function main() {
  console.log('=== Getting SPV Address from AccessManager ===\n');

  try {
    // Setup provider
    const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('Connected to:', RPC_URL);
    console.log('Access Manager:', ACCESS_MANAGER_ADDRESS);
    console.log('');

    // Connect to AccessManager
    const accessManager = new ethers.Contract(
      ACCESS_MANAGER_ADDRESS,
      ACCESS_MANAGER_ABI,
      provider
    );

    // Get SPV_ROLE hash
    const spvRoleHash = await accessManager.SPV_ROLE();
    console.log('SPV_ROLE Hash:', spvRoleHash);
    console.log('');

    // Try to get role member count or query events
    try {
      const memberCount = await accessManager.getRoleMemberCount(spvRoleHash);
      console.log(`Number of addresses with SPV_ROLE: ${memberCount}`);
      console.log('');

      if (memberCount > 0) {
        console.log('=== SPV Addresses ===');
        for (let i = 0; i < memberCount; i++) {
          const memberAddress = await accessManager.getRoleMember(spvRoleHash, i);
          console.log(`${i + 1}. ${memberAddress}`);
          
          // Verify with isSPV
          const isSPV = await accessManager.isSPV(memberAddress);
          console.log(`   isSPV check: ${isSPV ? '✅' : '❌'}`);
          console.log('');
        }
      } else {
        console.log('⚠️  No addresses have SPV_ROLE assigned yet.');
      }
    } catch (error) {
      // If getRoleMemberCount is not available, query RoleGranted events
      console.log('Querying RoleGranted events for SPV_ROLE...\n');
      
      try {
        // Query last 10000 blocks for RoleGranted events
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000);
        
        const filter = {
          address: ACCESS_MANAGER_ADDRESS,
          topics: [
            ethers.id('RoleGranted(bytes32,address,address)'),
            spvRoleHash, // role
          ],
          fromBlock,
          toBlock: 'latest'
        };
        
        const logs = await provider.getLogs(filter);
        
        if (logs.length > 0) {
          console.log('=== SPV Addresses (from RoleGranted events) ===');
          const spvAddresses = new Set();
          
          for (const log of logs) {
            // Decode the account address (2nd indexed parameter)
            const account = '0x' + log.topics[2].slice(26); // Remove padding
            spvAddresses.add(ethers.getAddress(account));
          }
          
          let index = 1;
          for (const address of spvAddresses) {
            console.log(`${index}. ${address}`);
            
            // Verify current status
            const isSPV = await accessManager.isSPV(address);
            console.log(`   Current isSPV check: ${isSPV ? '✅ Active' : '❌ Revoked'}`);
            console.log('');
            index++;
          }
        } else {
          console.log('No RoleGranted events found for SPV_ROLE.');
          console.log('');
          console.log('The SPV address might have been set in the constructor.');
          console.log('Check your deployment logs or .env file for the SPV address.');
        }
      } catch (eventError) {
        console.log('Could not query events:', eventError.message);
        console.log('');
        console.log('If you know a potential SPV address, you can check it manually.');
        console.log('Example: await accessManager.isSPV("0x...")');
      }
    }

    // Check specific address provided by user
    console.log('\n=== Checking Specific Address ===');
    const addressToCheck = '0xFeed27E8413d416Df4B26bf7BE275Bf92997413c';
    console.log(`Address: ${addressToCheck}`);
    
    const hasSPVRole = await accessManager.isSPV(addressToCheck);
    console.log(`Has SPV_ROLE: ${hasSPVRole ? '✅ YES' : '❌ NO'}`);
    
    // Check if it's the default admin
    const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const isDefaultAdmin = await accessManager.hasRole(DEFAULT_ADMIN_ROLE, addressToCheck);
    console.log(`Is DEFAULT_ADMIN: ${isDefaultAdmin ? '✅ YES' : '❌ NO'}`);

    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

