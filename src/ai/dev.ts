
import { config } from 'dotenv';
config();

import '@/ai/flows/collection-gap-analyzer.ts';
import '@/ai/flows/collection-insights-generator.ts';
import '@/ai/flows/product-type-identifier.ts'; // Added new flow
import '@/ai/flows/product-size-identifier.ts'; // Added new flow for size identification
