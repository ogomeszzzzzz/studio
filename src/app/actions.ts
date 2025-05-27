'use server';
import { analyzeStockoutRisks, AnalyzeStockoutRisksInput, AnalyzeStockoutRisksOutput } from '@/ai/flows/collection-gap-analyzer';
import type { Product } from '@/types';
import { format } from 'date-fns';

export async function performGapAnalysis(products: Product[]): Promise<AnalyzeStockoutRisksOutput | { error: string }> {
  if (!products || products.length === 0) {
    return { error: "No product data provided for analysis." };
  }

  try {
    // Prepare data for AI: a string with key fields.
    // The AI prompt mentions: ID VTEX, Name, Stock, Collection, Start Date, and End Date.
    const productDataString = products.map(p => {
      const startDate = p.collectionStartDate ? format(p.collectionStartDate, 'yyyy-MM-dd') : 'N/A';
      const endDate = p.collectionEndDate ? format(p.collectionEndDate, 'yyyy-MM-dd') : 'N/A';
      return `ID VTEX: ${p.vtexId}, Name: ${p.name}, Stock: ${p.stock}, Collection: ${p.collection}, Start Date: ${startDate}, End Date: ${endDate}`;
    }).join('\n');

    const input: AnalyzeStockoutRisksInput = {
      productData: productDataString,
    };
    
    const result = await analyzeStockoutRisks(input);
    return result;
  } catch (error) {
    console.error('Error performing gap analysis:', error);
    return { error: 'Failed to perform gap analysis. Please try again.' };
  }
}
