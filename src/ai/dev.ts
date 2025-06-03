
import { config } from 'dotenv';
config();

// AI flows are not currently used in the active UI.
// If you re-enable AI features, uncomment the relevant imports.

// import '@/ai/flows/collection-insights-generator.ts';
// import '@/ai/flows/product-type-identifier.ts';
// import '@/ai/flows/product-size-identifier.ts';
// import '@/ai/flows/collection-gap-analyzer.ts';
import '@/ai/flows/logistics-predictor-flow.ts';

