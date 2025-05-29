
'use server';

import { z } from 'zod';

const UpdatePillowStockInputSchema = z.array(
  z.object({
    derivation: z.string().min(1, { message: 'Pillow derivation ID is required.' }),
    displayName: z.string(), // For matching back to UI, not sent to VTEX
  })
);

export interface UpdatePillowStockInputEntry {
  derivation: string;
  displayName: string;
}

export interface UpdatedPillowStockInfo {
  derivation: string;
  displayName: string;
  newStock?: number;
  error?: string;
}

/**
 * Fetches stock for given pillow derivations from VTEX.
 * THIS IS A MOCKED IMPLEMENTATION. Replace with actual VTEX API calls.
 */
export async function fetchPillowStockFromVtex(
  pillows: UpdatePillowStockInputEntry[]
): Promise<UpdatedPillowStockInfo[]> {
  console.log('[Server Action] fetchPillowStockFromVtex called with:', pillows);

  const vtexAccountName = process.env.VTEX_ACCOUNT_NAME;
  const vtexApiKey = process.env.VTEX_API_KEY;
  const vtexApiToken = process.env.VTEX_API_TOKEN;

  if (!vtexAccountName || !vtexApiKey || !vtexApiToken) {
    console.error('VTEX API credentials are not configured in .env');
    return pillows.map(p => ({
      ...p,
      error: 'VTEX API credentials not configured on server.',
    }));
  }

  const results: UpdatedPillowStockInfo[] = [];

  for (const pillow of pillows) {
    if (!pillow.derivation) {
      results.push({ ...pillow, error: 'Missing derivation ID for pillow.' });
      continue;
    }

    // =======================================================================
    // TODO: Replace this mock with an actual VTEX API call
    // Example VTEX API endpoint: `https://{accountName}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/{skuId}`
    // You would use `fetch` here with appropriate headers:
    // 'X-VTEX-API-AppKey': vtexApiKey,
    // 'X-VTEX-API-AppToken': vtexApiToken,
    // 'Content-Type': 'application/json',
    // 'Accept': 'application/json'
    // =======================================================================
    console.log(`[Server Action] MOCK: Fetching stock for VTEX SKU ID: ${pillow.derivation} for account ${vtexAccountName}`);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

      // MOCKED RESPONSE: Simulate finding stock or an error
      if (pillow.derivation.includes('ERROR')) { // Simulate an error for a specific SKU
        throw new Error(`Simulated API error for SKU ${pillow.derivation}`);
      }
      
      const mockApiResponse = {
        balance: [
          {
            warehouseId: 'principal', // example field
            warehouseName: 'Principal', // example field
            totalQuantity: Math.floor(Math.random() * 75), // Random stock for mock
            // ... other fields from VTEX API
          },
        ],
      };
      
      // Assuming the first balance entry has the relevant total quantity
      const newStock = mockApiResponse.balance[0]?.totalQuantity;

      if (typeof newStock === 'number') {
        console.log(`[Server Action] MOCK: Stock for ${pillow.derivation} is ${newStock}`);
        results.push({ ...pillow, newStock });
      } else {
        console.warn(`[Server Action] MOCK: No stock quantity found for ${pillow.derivation} in mock response.`);
        results.push({ ...pillow, error: 'Mock stock data not found.' });
      }
    } catch (apiError: any) {
      console.error(`[Server Action] MOCK: Error fetching stock for ${pillow.derivation}:`, apiError.message);
      results.push({ ...pillow, error: apiError.message || 'Failed to fetch stock from VTEX (mock).' });
    }
  }

  return results;
}
