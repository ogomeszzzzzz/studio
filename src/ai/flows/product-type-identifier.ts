
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
  "Lençol com Elástico",
  "Lençol Superior",
  "Fronha Avulsa",
  "Fronha",
  "Cobre Leito",
  "Kit Colcha",
  "Jogo de Colcha",
  "Travesseiro",
  "Protetor de Colchão",
  "Protetor de Travesseiro",
  "Saia para Cama Box",
  "Porta Travesseiro",
  "Toalha de Banho",
  "Toalha de Rosto",
  "Toalha de Piso",
  "Toalha",
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
Sua tarefa é classificar CADA nome de produto fornecido em EXATAMENTE UMA das seguintes categorias: ${PRODUCT_CATEGORIES}.
Você DEVE usar apenas as categorias fornecidas na lista. Não invente novas categorias nem use variações.

Regras CRÍTICAS de Classificação:
1.  **Foco no Início do Nome:** O tipo de produto geralmente é a primeira palavra ou as primeiras palavras do nome do produto. Analise o início do nome do produto com MÁXIMA prioridade.
2.  **Correspondência Exata e Mais Específica:** Encontre a correspondência MAIS LONGA e MAIS ESPECÍFICA do início do nome do produto com os termos na lista de categorias.
    *   Por exemplo, se o nome do produto começa com "Jogo de Cama", ele DEVE ser classificado como "Jogo de Cama". Não simplifique para "Cama" se "Jogo de Cama" estiver na lista.
    *   Se o nome começa com "Edredom", classifique como "Edredom".
    *   Se o nome começa com "Toalha de Banho", classifique como "Toalha de Banho", mesmo que "Toalha" também esteja na lista. "Toalha de Banho" é mais específico.
    *   Se o nome começa com "Fronha Avulsa", classifique como "Fronha Avulsa". Se começar apenas com "Fronha" (e nenhuma outra categoria mais específica se aplicar, como "Porta Travesseiro"), classifique como "Fronha".
3.  **Não Divida Categorias Compostas:** Se uma categoria é "Jogo de Cama", não a divida em "Jogo" e "Cama" separadamente. A correspondência deve ser com o termo completo da categoria.
4.  **Categoria "Outros":** Use "Outros" SOMENTE se nenhuma das categorias da lista (${PRODUCT_CATEGORIES}, exceto "Outros") corresponder claramente ao início do nome do produto após aplicar as regras acima.

Exemplos de Classificação CORRETA:
- "Edredom Casal Malha Fio Penteado Altenburg" deve ser "Edredom".
- "Jogo de Cama Solteiro Infantil 3 Peças 100% Algodão" deve ser "Jogo de Cama".
- "Fronha Avulsa Lisa Percal 180 Fios" deve ser "Fronha Avulsa".
- "Lençol com Elástico King Size Microfibra" deve ser "Lençol com Elástico".
- "Toalha de Rosto para Bordar Premier" deve ser "Toalha de Rosto".
- "Travesseiro Suporte Firme Visco Nasa" deve ser "Travesseiro".
- "Kit Cobre Leito Queen Dupla Face" deve ser "Cobre Leito" (considerando que "Kit Cobre Leito" não está na lista e "Cobre Leito" é a categoria mais próxima da lista ${PRODUCT_CATEGORIES} que corresponde ao início). Se "Kit Colcha" for a intenção e corresponder, use "Kit Colcha".
- "Manta Decorativa para Sofá Microfibra" deve ser "Manta".
- "PORTA TRAVESSEIRO ULTIMATE CETIM 300 FIOS BRANCO" deve ser "Porta Travesseiro".

Para cada nome de produto na lista de entrada 'productNames', retorne um objeto contendo o 'originalName' (o nome exato que foi fornecido) e o 'identifiedType' (a categoria que você identificou da lista ${PRODUCT_CATEGORIES}).

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
  // config: { temperature: 0.1 } // Consider a VERY low temperature for strict adherence to classification if issues persist.
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
    if (!output) { // This case is critical if AI returns malformed JSON that Zod can't parse
        console.error("AI prompt returned null output for product type identification. This could be due to malformed JSON from AI or a schema mismatch.");
        // To provide more context to the user, perhaps return a specific error or an empty list with a warning.
        throw new Error("AI prompt returned null or invalid output for product type identification.");
    }
    return output;
  }
);

