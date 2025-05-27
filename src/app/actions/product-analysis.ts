
'use server';
import { 
  identifyProductTypes, 
  type ProductTypeIdentifierInput, 
  type ProductTypeIdentifierOutput 
} from '@/ai/flows/product-type-identifier';

import {
  identifyProductSizes,
  type ProductSizeIdentifierInput,
  type ProductSizeIdentifierOutput
} from '@/ai/flows/product-size-identifier';

/**
 * Server action to identify product types for a list of product names.
 * @param productNames An array of product names.
 * @returns A promise that resolves to the AI's categorization output or an error object.
 */
export async function getAIProductCategorization(productNames: string[]): Promise<ProductTypeIdentifierOutput | { error: string }> {
  if (!productNames || productNames.length === 0) {
    return { categorizedProducts: [] }; 
  }

  const uniqueProductNames = Array.from(new Set(productNames.filter(name => name && name.trim() !== '')));

  if (uniqueProductNames.length === 0) {
     return { categorizedProducts: [] };
  }

  const input: ProductTypeIdentifierInput = {
    productNames: uniqueProductNames,
  };

  try {
    const result = await identifyProductTypes(input);
    return result;
  } catch (error) {
    console.error('Error performing AI product type categorization:', error);
    let errorMessage = 'Failed to categorize product types using AI.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    // Limitar o tamanho da mensagem de erro para evitar problemas com o cliente/toast
    return { error: errorMessage.substring(0, 500) };
  }
}


/**
 * Server action to identify product sizes for a list of product names.
 * @param productNames An array of product names.
 * @returns A promise that resolves to the AI's size categorization output or an error object.
 */
export async function getAIProductSizeCategorization(productNames: string[]): Promise<ProductSizeIdentifierOutput | { error: string }> {
  if (!productNames || productNames.length === 0) {
    return { categorizedProductSizes: [] };
  }
  const uniqueProductNames = Array.from(new Set(productNames.filter(name => name && name.trim() !== '')));
  if (uniqueProductNames.length === 0) {
    return { categorizedProductSizes: [] };
  }

  const input: ProductSizeIdentifierInput = {
    productNames: uniqueProductNames,
  };

  try {
    const result = await identifyProductSizes(input);
    return result;
  } catch (error) {
    console.error('Error performing AI product size categorization:', error);
    let errorMessage = 'Failed to categorize product sizes using AI.';
     if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    return { error: errorMessage.substring(0, 500) };
  }
}
