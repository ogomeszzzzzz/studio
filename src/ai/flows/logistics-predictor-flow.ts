
'use server';
/**
 * @fileOverview A Genkit flow to predict logistics risks and suggest actions.
 *
 * - predictLogistics - A function that takes product data and returns logistics predictions.
 * - LogisticsPredictionInput - The input type for the predictLogistics function.
 * - LogisticsPredictionOutput - The return type for the predictLogistics function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define Zod Schemas for Input and Output
export const LogisticsPredictionInputSchema = z.object({
  productId: z.string().describe("The unique identifier of the product (e.g., VTEX ID or internal SKU)."),
  productName: z.string().describe("The display name of the product."),
  currentStock: z.number().min(0).describe("The current total physical stock quantity of the product."),
  sales30d: z.number().min(0).describe("The total sales quantity of the product in the last 30 days."),
  price: z.number().min(0).optional().describe("The current selling price of the product."),
  readyToShipStock: z.number().min(0).optional().describe("Stock available at 'Pronta Entrega' warehouse."),
  regulatorStock: z.number().min(0).optional().describe("Stock available at 'Regulador' warehouse."),
  openOrders: z.number().min(0).optional().describe("Quantity of the product in open purchase orders (incoming stock)."),
});
export type LogisticsPredictionInput = z.infer<typeof LogisticsPredictionInputSchema>;

export const LogisticsPredictionOutputSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  daysToRupture: z.number().describe("Estimated number of days until the current stock runs out based on 30-day sales velocity. Returns Infinity if no sales."),
  riskStatus: z.enum(['Crítico', 'Alto', 'Médio', 'Baixo', 'N/A']).describe("Risk level of stockout: Crítico (ruptured with sales), Alto (<=7 days cover), Médio (8-15 days cover), Baixo (>15 days cover), N/A (no sales or no stock)."),
  suggestedRestockUnits: z.number().min(0).describe("Suggested quantity to restock to achieve a target stock cover (e.g., 30 days). Considers open orders."),
  alerts: z.array(z.string()).optional().describe("Specific alerts or observations, e.g., 'High sales velocity with low stock', 'Stock parado'."),
});
export type LogisticsPredictionOutput = z.infer<typeof LogisticsPredictionOutputSchema>;


export async function predictLogistics(input: LogisticsPredictionInput): Promise<LogisticsPredictionOutput> {
  return logisticsPredictorFlow(input);
}

const logisticsPredictorFlow = ai.defineFlow(
  {
    name: 'logisticsPredictorFlow',
    inputSchema: LogisticsPredictionInputSchema,
    outputSchema: LogisticsPredictionOutputSchema,
  },
  async (input: LogisticsPredictionInput): Promise<LogisticsPredictionOutput> => {
    const {
      productId,
      productName,
      currentStock,
      sales30d,
      openOrders = 0, // Default to 0 if not provided
      // price, readyToShipStock, regulatorStock, // These might be used in a more complex prompt
    } = input;

    const dailySales = sales30d > 0 ? sales30d / 30 : 0;
    let daysToRupture: number;
    let riskStatus: LogisticsPredictionOutput['riskStatus'];
    let suggestedRestockUnits = 0;
    const alerts: string[] = [];
    const targetCoverageDays = 30; // Target stock coverage in days

    if (dailySales > 0) {
      daysToRupture = currentStock / dailySales;
      if (currentStock === 0 && openOrders === 0) {
        riskStatus = 'Crítico'; // Ruptured and no incoming stock
        alerts.push("Produto em ruptura crítica (sem estoque e sem pedidos).");
      } else if (daysToRupture <= 7) {
        riskStatus = 'Alto';
      } else if (daysToRupture <= 15) {
        riskStatus = 'Médio';
      } else {
        riskStatus = 'Baixo';
      }

      // Suggest restock if effective stock (current + open orders) is less than target coverage
      const effectiveStock = currentStock + openOrders;
      const targetStock = targetCoverageDays * dailySales;
      if (effectiveStock < targetStock) {
        suggestedRestockUnits = Math.max(0, Math.ceil(targetStock - effectiveStock));
      }
      
      if (daysToRupture <=7 && openOrders === 0) {
        alerts.push("Alto Risco: Baixa cobertura e sem pedidos de compra abertos.");
      }


    } else { // No sales in the last 30 days
      daysToRupture = Infinity;
      riskStatus = currentStock > 0 ? 'N/A' : 'Crítico'; // If no sales & no stock, still critical from a presence POV
      if (currentStock > 50) { // Arbitrary threshold for "parado"
          alerts.push("Estoque parado: Sem vendas nos últimos 30 dias.");
      }
      if (currentStock === 0) {
        alerts.push("Produto sem estoque e sem histórico de vendas recentes.");
      }
    }
    
    // Further refine risk status based on open orders for items with sales
    if (dailySales > 0 && openOrders > 0) {
        const daysToRuptureWithOpenOrders = (currentStock + openOrders) / dailySales;
        if (riskStatus === 'Alto' || riskStatus === 'Crítico') {
            if (daysToRuptureWithOpenOrders > 15) riskStatus = 'Médio'; // With open orders, risk might be lower
            else if (daysToRuptureWithOpenOrders > 7) riskStatus = 'Médio';
        }
        if (riskStatus === 'Crítico' && currentStock === 0 && openOrders > 0) {
            alerts.push("Ruptura atual, mas há pedidos em aberto.");
        }
    }


    // This is a simplified direct calculation.
    // A real GenAI prompt would be used for more nuanced suggestions & alerts.
    // For example, if you wanted the LLM to generate the `alerts` text.
    // const { output } = await prompt(input);
    // return output!;

    return {
      productId,
      productName,
      daysToRupture,
      riskStatus,
      suggestedRestockUnits,
      alerts,
    };
  }
);

// Example of how a prompt would be defined if we were using an LLM for this.
// For now, the flow directly calculates the output.
/*
const prompt = ai.definePrompt({
  name: 'logisticsPredictorPrompt',
  input: { schema: LogisticsPredictionInputSchema },
  output: { schema: LogisticsPredictionOutputSchema },
  prompt: `Você é um especialista em logística e planejamento de demanda para e-commerce.
  Analise os seguintes dados do produto:
  - ID: {{productId}}
  - Nome: {{productName}}
  - Estoque Atual: {{currentStock}} unidades
  - Vendas nos Últimos 30 Dias: {{sales30d}} unidades
  - Preço: R$ {{price}}
  - Estoque Pronta Entrega: {{readyToShipStock}}
  - Estoque Regulador: {{regulatorStock}}
  - Pedidos em Aberto: {{openOrders}}

  Calcule:
  1.  **daysToRupture**: Estimativa de dias até a ruptura do estoque atual. Se não houver vendas, retorne Infinity.
  2.  **riskStatus**: Classifique o risco de ruptura como 'Crítico' (sem estoque, mas vende E sem pedidos em aberto), 'Alto' (cobertura <= 7 dias), 'Médio' (cobertura 8-15 dias), 'Baixo' (cobertura > 15 dias), ou 'N/A' (sem vendas ou sem estoque e sem vendas). Considere pedidos em aberto para mitigar o risco se o estoque atual for baixo.
  3.  **suggestedRestockUnits**: Sugira uma quantidade para reposição para atingir 30 dias de cobertura, considerando o estoque atual e os pedidos em aberto. Deve ser 0 se a cobertura atual + pedidos em aberto for >= 30 dias.
  4.  **alerts**: Forneça alertas relevantes em um array de strings, como:
      - "Produto em ruptura crítica (sem estoque e sem pedidos)."
      - "Alto Risco: Baixa cobertura e sem pedidos de compra abertos."
      - "Estoque parado: Sem vendas nos últimos 30 dias com estoque considerável (ex: >50 unidades)."
      - "Ruptura atual, mas há pedidos em aberto."
      - Outras observações pertinentes.

  Seja preciso nos cálculos e forneça alertas concisos e acionáveis.
  `,
});
*/

