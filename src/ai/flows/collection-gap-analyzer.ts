
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
  analysisResults: z.string().describe('Análise dos riscos de ruptura de estoque para as coleções atuais, em Português.'),
});

export type AnalyzeStockoutRisksOutput = z.infer<typeof AnalyzeStockoutRisksOutputSchema>;

export async function analyzeStockoutRisks(input: AnalyzeStockoutRisksInput): Promise<AnalyzeStockoutRisksOutput> {
  return analyzeStockoutRisksFlow(input);
}

const analyzeStockoutRisksPrompt = ai.definePrompt({
  name: 'analyzeStockoutRisksPrompt',
  input: {schema: AnalyzeStockoutRisksInputSchema},
  output: {schema: AnalyzeStockoutRisksOutputSchema},
  prompt: `Você é um analista de negócios especialista em gestão de inventário.

Você analisará os dados de produtos fornecidos para identificar potenciais riscos de ruptura de estoque, especialmente para produtos em coleções atuais.
Considere fatores como níveis de estoque, datas de término das coleções e estimativas de vendas, mas as estimativas de vendas podem não estar disponíveis.

Dados do Produto: {{{productData}}}

Forneça uma análise clara e concisa dos potenciais riscos de ruptura de estoque, destacando os produtos que requerem atenção.
A resposta DEVE ser em Português do Brasil.
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

