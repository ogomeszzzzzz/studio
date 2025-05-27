
import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';
import type { Product } from '@/types';

const parseDate = (dateStr: string | number | undefined): Date | null => {
  if (typeof dateStr === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const excelDate = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
    if (isValid(excelDate)) return excelDate;
  }
  if (typeof dateStr === 'string') {
    const formatsToTry = ['dd/MM/yy', 'dd/MM/yyyy', 'MM/dd/yy', 'MM/dd/yyyy', 'yyyy-MM-dd'];
    for (const format of formatsToTry) {
      const parsed = parse(dateStr, format, new Date());
      if (isValid(parsed)) return parsed;
    }
  }
  return null;
};

const toBoolean = (value: string | number | undefined): boolean => {
  if (typeof value === 'string') {
    return value.trim().toUpperCase() === 'S' || value.trim().toUpperCase() === 'TRUE' || value.trim().toUpperCase() === 'YES';
  }
  return Boolean(value);
};

// Removed deriveProductType function and KNOWN_PRODUCT_TYPES as product type now comes directly from Excel.

export const parseExcelData = (file: File, collectionColumnKey: string = 'COLEÇÃO'): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result;
        if (!arrayBuffer) {
          reject(new Error('Could not read file content.'));
          return;
        }
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { raw: false, defval: null });

        const products: Product[] = jsonData.map((row: any) => {
          const startDate = parseDate(row['Início Coleção']);
          const endDate = parseDate(row['Fim Coleção']);
          const collectionValue = row[collectionColumnKey] ?? '';
          // const productName = row['Nome'] ?? ''; // Still needed for product.name

          return {
            vtexId: row['ID VTEX'] ?? '',
            name: row['Nome'] ?? '', // Product name is still needed
            productId: row['Produto'] ?? undefined,
            derivation: row['Derivação'] ?? undefined,
            productDerivation: row['Produto-Derivação'] ?? undefined,
            stock: Number(row['Estoque']) || 0,
            readyToShip: Number(row['Pronta Entrega']) || 0,
            order: Number(row['Pedido']) || 0,
            description: row['Descrição'] ?? '', // For print/pattern
            size: row['Tamanho'] ?? 'Não Especificado', // From Excel "Tamanho"
            productType: row['Tipo. Produto'] ?? 'Não Especificado', // Directly from "Tipo. Produto" column
            complement: row['Compl.'] ?? undefined,
            commercialLine: row['Linha Comercial'] ?? '',
            collection: collectionValue,
            commercialLineDescription: row['Descrição Linha Comercial'] ?? undefined,
            isCurrentCollection: toBoolean(row['Coleção Atual']),
            collectionStartDate: startDate,
            collectionEndDate: endDate,
            rawCollectionStartDate: row['Início Coleção'] ? String(row['Início Coleção']) : undefined,
            rawCollectionEndDate: row['Fim Coleção'] ? String(row['Fim Coleção']) : undefined,
            isExcMtVendors: toBoolean(row['Exc.MT-Vendors']),
            isDiscontinued: toBoolean(row['Fora de linha']),
          };
        });
        resolve(products);
      } catch (error) {
        console.error("Error parsing Excel:", error);
        reject(new Error('Failed to parse Excel file. Ensure it is a valid Excel file and the format is correct.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
