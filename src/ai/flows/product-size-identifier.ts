
'use server';
/**
 * @fileOverview Identifies product sizes (e.g., Solteiro, Casal) from product names.
 *
 * - identifyProductSizes - A function that takes product names and returns their identified sizes.
 * - ProductSizeIdentifierInput - The input type for the function.
 * - ProductSizeIdentifierOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PRODUCT_SIZES = [
  "Solteiro King",
  "Solteiro",
  "Casal",
  "Queen King",
  "Super King",
  "Outros" // Fallback category
].join(', ');

const ProductSizeIdentifierInputSchema = z.object({
  productNames: z.array(z.string()).describe('An array of product names to be categorized by size.'),
});
export type ProductSizeIdentifierInput = z.infer<typeof ProductSizeIdentifierInputSchema>;

const ProductSizeIdentifierOutputSchema = z.object({
  categorizedProductSizes: z
    .array(
      z.object({
        originalName: z.string().describe('The original product name provided in the input.'),
        identifiedSize: z.string().describe('The identified product size from the predefined list.'),
      })
    )
    .describe('An array of objects, each mapping an original product name to its identified size.'),
});
export type ProductSizeIdentifierOutput = z.infer<typeof ProductSizeIdentifierOutputSchema>;

export async function identifyProductSizes(input: ProductSizeIdentifierInput): Promise<ProductSizeIdentifierOutput> {
  return identifyProductSizesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'productSizeIdentifierPrompt',
  input: {schema: ProductSizeIdentifierInputSchema},
  output: {schema: ProductSizeIdentifierOutputSchema},
  prompt: `Você é um especialista em categorização de tamanhos de produtos de cama.
Sua tarefa é classificar cada nome de produto fornecido em uma das seguintes categorias de tamanho: ${PRODUCT_SIZES}.
Se um produto não se encaixar claramente em nenhuma das categorias listadas, ou se o nome do produto não indicar um tamanho específico, classifique-o como "Outros".

Para cada nome de produto na lista de entrada 'productNames', retorne um objeto contendo o 'originalName' (o nome exato que foi fornecido) e o 'identifiedSize' (a categoria de tamanho que você identificou).

A lista de nomes de produtos é:
{{#each productNames}}
- {{{this}}}
{{/each}}

Responda APENAS com a estrutura JSON definida no esquema de saída.
`,
   safetySettings: [
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

const identifyProductSizesFlow = ai.defineFlow(
  {
    name: 'identifyProductSizesFlow',
    inputSchema: ProductSizeIdentifierInputSchema,
    outputSchema: ProductSizeIdentifierOutputSchema,
  },
  async (input: ProductSizeIdentifierInput) => {
    if (!input.productNames || input.productNames.length === 0) {
      return { categorizedProductSizes: [] };
    }
    const {output} = await prompt(input);
    if (!output) {
        console.error("AI prompt returned null output for product size identification.");
        throw new Error("AI prompt returned null output for size identification.");
    }
    return output;
  }
);
