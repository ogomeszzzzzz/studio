
'use server';
/**
 * @fileOverview A Genkit flow to predict logistics risks for Ready-to-Ship (PE) stock and suggest actions.
 *
 * - predictLogistics - A function that takes product data and returns logistics predictions for PE.
 * - LogisticsPredictionInput - The input type for the predictLogistics function.
 * - LogisticsPredictionOutput - The return type for the predictLogistics function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define Zod Schemas for Input and Output
const LogisticsPredictionInputSchema = z.object({
  productId: z.string().describe("The unique identifier of the product (e.g., VTEX ID or internal SKU)."),
  productName: z.string().describe("The display name of the product."),
  currentStock: z.number().min(0).describe("The current total physical stock quantity of the product."),
  readyToShipStock: z.number().min(0).describe("Stock available at 'Pronta Entrega' warehouse."),
  regulatorStock: z.number().min(0).optional().describe("Stock available at 'Regulador' warehouse."),
  sales30d: z.number().min(0).describe("The total sales quantity of the product in the last 30 days."),
  price: z.number().min(0).optional().describe("The current selling price of the product."),
  openOrders: z.number().min(0).optional().describe("Quantity of the product in open purchase orders (incoming stock for total inventory)."),
});
export type LogisticsPredictionInput = z.infer<typeof LogisticsPredictionInputSchema>;

const LogisticsPredictionOutputSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  daysToRupturePE: z.number().nullable().describe(
    "Estimated number of days until 'Pronta Entrega' (Ready-to-Ship) stock runs out based on 30-day sales velocity. " +
    "Returns null if no sales or no PE stock with no sales."
  ),
  riskStatusPE: z.enum(['Ruptura Iminente', 'Atenção', 'Estável', 'N/A']).describe(
    "Risk level for 'Pronta Entrega' stockout: Ruptura Iminente (<5 days cover), Atenção (5-10 days cover), " +
    "Estável (>10 days cover), N/A (no sales for PE or PE is 0 with no sales)."
  ),
  suggestedRestockUnitsPE: z.number().min(0).describe(
    "Suggested quantity to restock 'Pronta Entrega' to achieve a target stock cover (e.g., 30 days). This calculation primarily aims to replenish PE from other sources or new stock, not considering open orders directly for this specific PE target."
  ),
  alerts: z.array(z.string()).optional().describe(
    "General alerts or observations for the product, e.g., 'High sales velocity with low total stock', 'Stock parado (total)'."
  ),
  dailyAverageSales: z.number().min(0).describe("Calculated average daily sales over the last 30 days."),
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
      currentStock, // Total stock
      readyToShipStock,
      sales30d,
      openOrders = 0,
      // regulatorStock, // Available if needed for more complex alerts
      // price, // Available if needed
    } = input;

    const dailyAverageSales = sales30d > 0 ? sales30d / 30 : 0;
    let daysToRupturePE: number | null;
    let riskStatusPE: LogisticsPredictionOutput['riskStatusPE'];
    let suggestedRestockUnitsPE = 0;
    const generalAlerts: string[] = [];
    const targetCoverageDaysPE = 30; // Target stock coverage in days for Pronta Entrega

    if (dailyAverageSales > 0 && readyToShipStock > 0) {
      daysToRupturePE = readyToShipStock / dailyAverageSales;
      if (daysToRupturePE < 5) {
        riskStatusPE = 'Ruptura Iminente';
      } else if (daysToRupturePE <= 10) {
        riskStatusPE = 'Atenção';
      } else {
        riskStatusPE = 'Estável';
      }
    } else if (dailyAverageSales > 0 && readyToShipStock === 0) {
      daysToRupturePE = 0; // Ruptured
      riskStatusPE = 'Ruptura Iminente';
    } else { // No sales or no PE stock with no sales
      daysToRupturePE = null;
      riskStatusPE = 'N/A';
    }

    // Suggested restock for Pronta Entrega
    if (dailyAverageSales > 0) {
      const targetStockPE = targetCoverageDaysPE * dailyAverageSales;
      if (readyToShipStock < targetStockPE) {
        suggestedRestockUnitsPE = Math.max(0, Math.ceil(targetStockPE - readyToShipStock));
      }
    }
    
    // General alerts based on total stock and open orders (can be expanded)
    if (dailyAverageSales > 0 && currentStock === 0 && openOrders === 0) {
        generalAlerts.push("Produto em ruptura crítica total (sem estoque e sem pedidos).");
    } else if (dailyAverageSales > 0 && currentStock / dailyAverageSales <= 7 && openOrders === 0 ) {
        generalAlerts.push("Alto Risco: Baixa cobertura de estoque total e sem pedidos de compra abertos.");
    }
    if (dailyAverageSales === 0 && currentStock > 50) { // Arbitrary threshold for "parado"
        generalAlerts.push("Estoque total parado: Sem vendas nos últimos 30 dias.");
    }
    if (currentStock === 0 && openOrders > 0 && riskStatusPE === 'Ruptura Iminente') {
        generalAlerts.push("Pronta Entrega em ruptura, mas há pedidos em aberto para estoque total.");
    }


    return {
      productId,
      productName,
      daysToRupturePE,
      riskStatusPE,
      suggestedRestockUnitsPE,
      alerts: generalAlerts,
      dailyAverageSales,
    };
  }
);
