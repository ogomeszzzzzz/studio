
import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';
import type { Product } from '@/types';

const parseDate = (dateStr: string | number | undefined): Date | null => {
  if (typeof dateStr === 'number') {
    // Handle Excel date serial numbers
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

// collectionColumnKey: The key in the Excel row object to use for the 'collection' field.
// Defaults to 'COLEÇÃO' for backward compatibility with Collection Analyzer.
// For Dashboard, it will be 'Linha Comercial'.
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
        // Use raw: false to get raw values, especially for dates, then parse them manually.
        // defval: null ensures empty cells are null, not undefined, which can be more consistent.
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { raw: false, defval: null });

        const products: Product[] = jsonData.map((row: any) => {
          const startDate = parseDate(row['Início Coleção']);
          const endDate = parseDate(row['Fim Coleção']);
          
          // Determine the collection value based on the provided key
          const collectionValue = row[collectionColumnKey] ?? '';

          return {
            vtexId: row['ID VTEX'] ?? '',
            name: row['Nome'] ?? '',
            productId: row['Produto'] ?? undefined,
            derivation: row['Derivação'] ?? undefined,
            productDerivation: row['Produto-Derivação'] ?? undefined,
            stock: Number(row['Estoque']) || 0,
            readyToShip: Number(row['Pronta Entrega']) || 0, // Convert to number
            order: Number(row['Pedido']) || 0, // Convert to number
            description: row['Descrição'] ?? '', // Keep as string for print/pattern
            size: row['Tamanho'] ?? undefined,
            complement: row['Compl.'] ?? undefined,
            commercialLine: row['Linha Comercial'] ?? '', // Keep commercialLine populated
            collection: collectionValue, // This is now dynamic
            commercialLineDescription: row['Descrição Linha Comercial'] ?? undefined,
            isCurrentCollection: toBoolean(row['Coleção Atual']), // This might need re-evaluation based on 'Linha Comercial' context
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
