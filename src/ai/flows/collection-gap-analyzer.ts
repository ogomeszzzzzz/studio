'use server';

/**
 * @fileOverview Analyzes product data to identify potential stockout risks for current collections.
 *
 * - analyzeStockoutRisks - Analyzes product data for stockout risks.
 * - AnalyzeStockoutRisksInput - Input type for analyzeStockoutRisks function.
 * - AnalyzeStockoutRisksOutput - Return type for analyzeStockoutRisks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeStockoutRisksInputSchema = z.object({
  productData: z
    .string()
    .describe(
      'A string containing product data, including ID VTEX, Name, Stock, Collection, Start Date, and End Date.'
    ),
});

export type AnalyzeStockoutRisksInput = z.infer<typeof AnalyzeStockoutRisksInputSchema>;

const AnalyzeStockoutRisksOutputSchema = z.object({
  analysisResults: z.string().describe('Analysis of stockout risks for current collections.'),
});

export type AnalyzeStockoutRisksOutput = z.infer<typeof AnalyzeStockoutRisksOutputSchema>;

export async function analyzeStockoutRisks(input: AnalyzeStockoutRisksInput): Promise<AnalyzeStockoutRisksOutput> {
  return analyzeStockoutRisksFlow(input);
}

const analyzeStockoutRisksPrompt = ai.definePrompt({
  name: 'analyzeStockoutRisksPrompt',
  input: {schema: AnalyzeStockoutRisksInputSchema},
  output: {schema: AnalyzeStockoutRisksOutputSchema},
  prompt: `You are an expert business analyst specializing in inventory management.

You will analyze the provided product data to identify potential stockout risks, especially for products in current collections.
Consider factors such as stock levels, collection end dates, and sales estimates, but sales estimates may not be available.

Product Data: {{{productData}}}

Provide a clear and concise analysis of potential stockout risks, highlighting products that require attention.
`, safetySettings: [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_ONLY_HIGH',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_LOW_AND_ABOVE',
    },
  ],
});

const analyzeStockoutRisksFlow = ai.defineFlow(
  {
    name: 'analyzeStockoutRisksFlow',
    inputSchema: AnalyzeStockoutRisksInputSchema,
    outputSchema: AnalyzeStockoutRisksOutputSchema,
  },
  async input => {
    const {output} = await analyzeStockoutRisksPrompt(input);
    return output!;
  }
);
