// src/ai/flows/collection-insights-generator.ts
'use server';

/**
 * @fileOverview Generates insights about collection performance based on provided data.
 *
 * - generateCollectionInsights - A function that takes collection data and returns a summary of insights.
 * - CollectionInsightsInput - The input type for the generateCollectionInsights function.
 * - CollectionInsightsOutput - The return type for the generateCollectionInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CollectionInsightsInputSchema = z.object({
  collectionData: z.string().describe('A stringified JSON array containing collection data. Each object should have fields like collection name, product name, stock level, and sales velocity.'),
});
export type CollectionInsightsInput = z.infer<typeof CollectionInsightsInputSchema>;

const CollectionInsightsOutputSchema = z.object({
  summary: z.string().describe('A summary of insights based on the collection performance data, highlighting trends, potential issues, and opportunities for optimization.'),
});
export type CollectionInsightsOutput = z.infer<typeof CollectionInsightsOutputSchema>;

export async function generateCollectionInsights(input: CollectionInsightsInput): Promise<CollectionInsightsOutput> {
  return generateCollectionInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'collectionInsightsPrompt',
  input: {schema: CollectionInsightsInputSchema},
  output: {schema: CollectionInsightsOutputSchema},
  prompt: `You are an expert collection performance analyst. Analyze the following collection data and generate a summary of insights, highlighting trends, potential issues, and opportunities for optimization.

Collection Data: {{{collectionData}}}

Focus on identifying:
- Collections with low stock relative to sales velocity.
- Collections nearing the end of their lifecycle that may require promotion or clearance.
- Top-performing collections with opportunities for expansion.
- Any other relevant trends or issues.

Provide a concise and actionable summary of your findings.
`,
});

const generateCollectionInsightsFlow = ai.defineFlow(
  {
    name: 'generateCollectionInsightsFlow',
    inputSchema: CollectionInsightsInputSchema,
    outputSchema: CollectionInsightsOutputSchema,
  },
  async input => {
    try {
      JSON.parse(input.collectionData);
    } catch (e) {
      throw new Error('Invalid JSON format for collection data.');
    }
    const {output} = await prompt(input);
    return output!;
  }
);
