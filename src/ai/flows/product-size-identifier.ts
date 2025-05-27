
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
  "Queen",
  "King",
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
Sua tarefa é classificar cada nome de produto fornecido em UMA das seguintes categorias de tamanho: ${PRODUCT_SIZES}.
Analise o nome do produto cuidadosamente para a correspondência MAIS PRECISA.

Exemplos de Classificação:
- "Edredom Solteiro King Altenburg" deve ser "Solteiro King".
- "Lençol Solteiro Malha" deve ser "Solteiro".
- "Jogo de Cama Casal Padrão" ou "Kit Cobre Leito Casal 3 Peças" deve ser "Casal".
- "Cobre Leito Queen King Estampado" deve ser "Queen King".
- "Kit Colcha Queen Microfibra" ou "Edredom Casal Queen" deve ser "Queen".
- "Lençol King Avulso com Elástico" ou "Jogo de Cama Casal King" deve ser "King".
- "Edredom Super King Branco" ou "Lençol Casal Super King" deve ser "Super King".

Regras de Precedência e Casos Específicos:
1.  Priorize a categoria MAIS ESPECÍFICA da lista que corresponder.
2.  Se o nome contiver "Casal" mas também um tamanho maior como "King", "Queen", ou "Super King" (ex: "Lençol Casal King Size", "Edredom Casal Queen"), classifique pelo tamanho maior (ex: "King" ou "Queen" ou "Super King", conforme a lista ${PRODUCT_SIZES}).
3.  Se o nome for "Travesseiro Casal" e "Casal" estiver na lista, classifique como "Casal".
4.  A categoria "Outros" deve ser usada SOMENTE se o nome do produto não contiver nenhuma indicação clara de tamanho da lista fornecida, ou se for um tamanho completamente diferente não listado.

Para cada nome de produto na lista de entrada 'productNames', retorne um objeto contendo o 'originalName' (o nome exato que foi fornecido) e o 'identifiedSize' (a categoria de tamanho que você identificou da lista ${PRODUCT_SIZES}).

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
        console.error("AI prompt returned null output for product size identification. This could be due to malformed JSON from AI or a schema mismatch.");
        throw new Error("AI prompt returned null or invalid output for size identification.");
    }
    return output;
  }
);

