
'use server';
/**
 * @fileOverview Identifies product types (e.g., Edredom, Jogo de Cama) from product names.
 *
 * - identifyProductTypes - A function that takes product names and returns their identified types.
 * - ProductTypeIdentifierInput - The input type for the function.
 * - ProductTypeIdentifierOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PRODUCT_CATEGORIES = [
  "Edredom",
  "Jogo de Cama",
  "Lençol Avulso",
  "Fronha Avulsa",
  "Cobre Leito",
  "Kit Colcha",
  "Travesseiro",
  "Protetor de Colchão",
  "Protetor de Travesseiro",
  "Saia para Cama Box",
  "Porta Travesseiro",
  "Toalha de Banho",
  "Toalha de Rosto",
  "Toalha de Piso",
  "Roupão",
  "Cortina",
  "Almofada",
  "Manta",
  "Tapete",
  "Outros" // Fallback category
].join(', ');

// Schema definitions are now local to this module and not exported.
const ProductTypeIdentifierInputSchema = z.object({
  productNames: z.array(z.string()).describe('An array of product names to be categorized.'),
});
export type ProductTypeIdentifierInput = z.infer<typeof ProductTypeIdentifierInputSchema>;

const ProductTypeIdentifierOutputSchema = z.object({
  categorizedProducts: z
    .array(
      z.object({
        originalName: z.string().describe('The original product name provided in the input.'),
        identifiedType: z.string().describe('The identified product type from the predefined list.'),
      })
    )
    .describe('An array of objects, each mapping an original product name to its identified type.'),
});
export type ProductTypeIdentifierOutput = z.infer<typeof ProductTypeIdentifierOutputSchema>;

export async function identifyProductTypes(input: ProductTypeIdentifierInput): Promise<ProductTypeIdentifierOutput> {
  return identifyProductTypesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'productTypeIdentifierPrompt',
  input: {schema: ProductTypeIdentifierInputSchema},
  output: {schema: ProductTypeIdentifierOutputSchema},
  prompt: `Você é um especialista em categorização de produtos de cama, mesa e banho.
Sua tarefa é classificar cada nome de produto fornecido em uma das seguintes categorias: ${PRODUCT_CATEGORIES}.
Se um produto não se encaixar claramente em nenhuma das categorias listadas, classifique-o como "Outros".

Para cada nome de produto na lista de entrada 'productNames', retorne um objeto contendo o 'originalName' (o nome exato que foi fornecido) e o 'identifiedType' (a categoria que você identificou).

A lista de nomes de produtos é:
{{#each productNames}}
- {{{this}}}
{{/each}}

Responda APENAS com a estrutura JSON definida no esquema de saída.
Certifique-se de que todos os objetos na matriz JSON estejam separados por vírgulas e que todos os pares de chave-valor dentro de cada objeto também estejam separados por vírgulas. As chaves e os valores de string DEVEM estar entre aspas duplas.
Não inclua nenhuma explicação ou texto adicional fora da estrutura JSON.
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
  // config: { temperature: 0.2 } // Consider a low temperature for better JSON adherence if issues persist
});

const identifyProductTypesFlow = ai.defineFlow(
  {
    name: 'identifyProductTypesFlow',
    inputSchema: ProductTypeIdentifierInputSchema,
    outputSchema: ProductTypeIdentifierOutputSchema,
  },
  async (input: ProductTypeIdentifierInput) => {
    if (!input.productNames || input.productNames.length === 0) {
      return { categorizedProducts: [] };
    }
    const {output} = await prompt(input);
    if (!output) {
        console.error("AI prompt returned null output for product type identification. This could be due to malformed JSON from AI or a schema mismatch.");
        throw new Error("AI prompt returned null or invalid output for product type identification.");
    }
    return output;
  }
);

