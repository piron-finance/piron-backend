# Transaction Endpoints

Base URL: `http://localhost:3008/api/v1`

---

## 1. Get Pool Transactions

**Endpoint:** `GET /pools/:poolAddress/transactions`

**Description:** Get all transactions for a specific pool

**Parameters:**

- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Example Request:**

```bash
GET /pools/0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5/transactions?page=1&limit=20
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "DEPOSIT",
      "txHash": "0x16a13e5aa189cdce6a4b02aa151b96e97b00b06aac6f7202268526bb34351aec",
      "amount": "1300",
      "shares": "1300.256527",
      "fee": null,
      "from": null,
      "to": null,
      "blockNumber": "34183126",
      "blockHash": null,
      "gasUsed": null,
      "gasPrice": null,
      "status": "CONFIRMED",
      "failureReason": null,
      "timestamp": "2025-11-26T05:22:20.000Z",
      "createdAt": "2025-11-26T06:51:40.094Z",
      "updatedAt": "2025-11-26T06:51:40.094Z",
      "pool": {
        "name": "Piron Global Stable Yield Fund",
        "poolAddress": "0x51e33dbf7fa275dc9a9e48c86d373aa7b75745a5",
        "assetSymbol": "E20M"
      }
    },
    {
      "id": "uuid",
      "type": "DEPOSIT",
      "txHash": "0xf3f30089c6cdc9266a94f00b0e3bf81b05c7e02e94c4c80607e83a8b81e9a05e",
      "amount": "1000",
      "shares": "1000",
      "timestamp": "2025-11-26T03:00:44.000Z",
      "status": "CONFIRMED",
      "pool": {
        "name": "Piron Global Stable Yield Fund",
        "poolAddress": "0x51e33dbf7fa275dc9a9e48c86d373aa7b75745a5",
        "assetSymbol": "E20M"
      }
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 2. Get User Transactions

**Endpoint:** `GET /users/:walletAddress/transactions`

**Description:** Get all transactions for a specific user/wallet

**Parameters:**

- `poolId` (optional) - Filter by specific pool UUID
- `type` (optional) - Filter by transaction type: `DEPOSIT`, `WITHDRAWAL`, `COUPON_CLAIM`, `MATURITY_CLAIM`, `REFUND`, `EMERGENCY_WITHDRAWAL`, `TRANSFER`
- `status` (optional) - Filter by status: `PENDING`, `CONFIRMED`, `FAILED`
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Example Request:**

```bash
GET /users/0x6e9150717c8a810ddbcb1aa1d459c399efbed2a5/transactions?page=1&limit=20
```

**Example with Filters:**

```bash
GET /users/0x6e9150717c8a810ddbcb1aa1d459c399efbed2a5/transactions?type=DEPOSIT&status=CONFIRMED&page=1
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "DEPOSIT",
      "txHash": "0x16a13e5aa189cdce6a4b02aa151b96e97b00b06aac6f7202268526bb34351aec",
      "amount": "1300",
      "shares": "1300.256527",
      "fee": null,
      "from": null,
      "to": null,
      "blockNumber": "34183126",
      "blockHash": null,
      "gasUsed": null,
      "gasPrice": null,
      "status": "CONFIRMED",
      "failureReason": null,
      "timestamp": "2025-11-26T05:22:20.000Z",
      "createdAt": "2025-11-26T06:51:40.094Z",
      "updatedAt": "2025-11-26T06:51:40.094Z",
      "pool": {
        "name": "Piron Global Stable Yield Fund",
        "poolAddress": "0x51e33dbf7fa275dc9a9e48c86d373aa7b75745a5",
        "assetSymbol": "E20M"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 3. Get Transaction by Hash

**Endpoint:** `GET /transactions/:txHash`

**Description:** Get details of a specific transaction by its transaction hash

**Example Request:**

```bash
GET /transactions/0x16a13e5aa189cdce6a4b02aa151b96e97b00b06aac6f7202268526bb34351aec
```

**Response:**

```json
{
  "id": "uuid",
  "type": "DEPOSIT",
  "txHash": "0x16a13e5aa189cdce6a4b02aa151b96e97b00b06aac6f7202268526bb34351aec",
  "chainId": 84532,
  "amount": "1300",
  "shares": "1300.256527",
  "fee": null,
  "from": null,
  "to": null,
  "blockNumber": "34183126",
  "blockHash": null,
  "gasUsed": null,
  "gasPrice": null,
  "status": "CONFIRMED",
  "failureReason": null,
  "timestamp": "2025-11-26T05:22:20.000Z",
  "createdAt": "2025-11-26T06:51:40.094Z",
  "updatedAt": "2025-11-26T06:51:40.094Z",
  "user": {
    "walletAddress": "0x6e9150717c8a810ddbcb1aa1d459c399efbed2a5"
  },
  "pool": {
    "name": "Piron Global Stable Yield Fund",
    "poolAddress": "0x51e33dbf7fa275dc9a9e48c86d373aa7b75745a5",
    "assetSymbol": "E20M"
  }
}
```

---

## Data Types

### Transaction Types

- `DEPOSIT` - User deposits funds into pool
- `WITHDRAWAL` - User withdraws funds from pool
- `COUPON_CLAIM` - User claims coupon payment
- `MATURITY_CLAIM` - User claims maturity payment
- `REFUND` - Pool refund to user
- `EMERGENCY_WITHDRAWAL` - Emergency withdrawal
- `TRANSFER` - Transfer between users

### Transaction Status

- `PENDING` - Transaction submitted but not confirmed
- `CONFIRMED` - Transaction confirmed on blockchain
- `FAILED` - Transaction failed

### Field Descriptions

| Field              | Type              | Description                                    |
| ------------------ | ----------------- | ---------------------------------------------- |
| `id`               | string (uuid)     | Unique transaction ID                          |
| `type`             | string            | Transaction type (see above)                   |
| `txHash`           | string            | Blockchain transaction hash                    |
| `chainId`          | number            | Blockchain network ID (84532 for Base Sepolia) |
| `amount`           | string            | Transaction amount (in token decimals)         |
| `shares`           | string            | Pool shares involved (if applicable)           |
| `fee`              | string \| null    | Transaction fee amount                         |
| `blockNumber`      | string            | Block number where transaction was included    |
| `status`           | string            | Transaction status                             |
| `timestamp`        | string (ISO 8601) | When transaction occurred                      |
| `pool.name`        | string            | Pool name                                      |
| `pool.poolAddress` | string            | Pool contract address                          |
| `pool.assetSymbol` | string            | Asset token symbol (e.g., "USDC", "E20M")      |

---

## Frontend Implementation Examples

### React/TypeScript Example - Pool Transactions

```typescript
import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  type: string;
  txHash: string;
  amount: string;
  shares: string;
  timestamp: string;
  status: string;
  pool: {
    name: string;
    poolAddress: string;
    assetSymbol: string;
  };
}

interface TransactionsResponse {
  data: Transaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const PoolTransactions = ({ poolAddress }: { poolAddress: string }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/pools/${poolAddress}/transactions?page=${page}&limit=20`,
        );
        const data: TransactionsResponse = await response.json();
        setTransactions(data.data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [poolAddress, page]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Transaction History</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Time</th>
            <th>Transaction</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{tx.type}</td>
              <td>
                {tx.amount} {tx.pool.assetSymbol}
              </td>
              <td>{new Date(tx.timestamp).toLocaleString()}</td>
              <td>
                <a
                  href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tx.txHash.substring(0, 10)}...
                </a>
              </td>
              <td>{tx.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### User Transactions with Filters

```typescript
const UserTransactions = ({ walletAddress }: { walletAddress: string }) => {
  const [type, setType] = useState<string>(''); // DEPOSIT, WITHDRAWAL, etc.
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      const params = new URLSearchParams({
        page: '1',
        limit: '20',
        ...(type && { type }),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${walletAddress}/transactions?${params}`,
      );
      const data = await response.json();
      setTransactions(data.data);
    };

    fetchTransactions();
  }, [walletAddress, type]);

  return (
    <div>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All Types</option>
        <option value="DEPOSIT">Deposits</option>
        <option value="WITHDRAWAL">Withdrawals</option>
        <option value="COUPON_CLAIM">Coupon Claims</option>
      </select>

      {/* Render transactions... */}
    </div>
  );
};
```

---

## Testing Endpoints

### Using curl:

```bash
# Get pool transactions
curl http://localhost:3008/api/v1/pools/0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5/transactions

# Get user transactions
curl http://localhost:3008/api/v1/users/0x6e9150717c8a810ddbcb1aa1d459c399efbed2a5/transactions

# Get specific transaction
curl http://localhost:3008/api/v1/transactions/0x16a13e5aa189cdce6a4b02aa151b96e97b00b06aac6f7202268526bb34351aec

# With pagination
curl "http://localhost:3008/api/v1/pools/0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5/transactions?page=1&limit=10"

# Filter by type
curl "http://localhost:3008/api/v1/users/0x6e9150717c8a810ddbcb1aa1d459c399efbed2a5/transactions?type=DEPOSIT"
```

### Using JavaScript fetch:

```javascript
// Browser console test
fetch('http://localhost:3008/api/v1/pools/0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5/transactions')
  .then((r) => r.json())
  .then((d) => console.table(d.data));
```

---

## Notes

1. **All amounts are strings** - Parse with `parseFloat()` or `Number()` before calculations
2. **Timestamps are ISO 8601** - Use `new Date(timestamp)` to parse
3. **Pagination is zero-indexed in the response** - First page is 1
4. **Wallet addresses are case-insensitive** - Backend converts to lowercase
5. **Pool addresses are case-insensitive** - Backend converts to lowercase

---

## Error Responses

### 404 - Not Found

```json
{
  "statusCode": 404,
  "message": "User with wallet 0x... not found",
  "error": "Not Found"
}
```

### 400 - Bad Request

```json
{
  "statusCode": 400,
  "message": ["page must be a positive number"],
  "error": "Bad Request"
}
```
