
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

const getRowValue = (row: any, primaryKey: string, fallbacks: string[] = [], defaultValue: any = '') => {
  const keysToTry = [primaryKey, ...fallbacks];
  const rowKeys = Object.keys(row);

  for (const tryKey of keysToTry) {
    // Try exact match first
    if (Object.prototype.hasOwnProperty.call(row, tryKey) && row[tryKey] !== null && row[tryKey] !== undefined) {
       if (typeof row[tryKey] === 'string' && row[tryKey].trim() === '') continue; // Treat empty strings as not found for this general helper, specific logic can override
      return row[tryKey];
    }
    // Try case-insensitive match
    const actualKey = rowKeys.find(k => k.trim().toLowerCase() === tryKey.trim().toLowerCase());
    if (actualKey && row[actualKey] !== null && row[actualKey] !== undefined) {
      if (typeof row[actualKey] === 'string' && row[actualKey].trim() === '') continue;
      return row[actualKey];
    }
  }
  return defaultValue;
};


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
          const startDate = parseDate(getRowValue(row, 'Início Coleção', ['Inicio Colecao']));
          const endDate = parseDate(getRowValue(row, 'Fim Coleção', ['Fim Colecao']));
          const collectionValue = getRowValue(row, collectionColumnKey, [], '');
          
          const rawVtexId = getRowValue(row, 'ID VTEX', ['Id Vtex', 'IDVtex', 'ID_VTEX'], ''); 
          let processedVtexId: string | number = ''; 

          if (rawVtexId !== null && rawVtexId !== undefined && String(rawVtexId).trim() !== '') {
              if (typeof rawVtexId === 'number' && !isNaN(rawVtexId)) {
                  processedVtexId = rawVtexId; 
              } else if (typeof rawVtexId === 'string') {
                  const trimmedVal = rawVtexId.trim();
                  // Check if the string can be cleanly converted to a number
                  // It should only contain digits, optionally a decimal point or a leading minus sign
                  if (/^[-+]?\d*\.?\d+$/.test(trimmedVal) && !isNaN(Number(trimmedVal))) {
                      processedVtexId = Number(trimmedVal);
                  } else {
                      processedVtexId = trimmedVal; // Keep as string (e.g., "#N/D", "ABC")
                  }
              } else {
                  processedVtexId = String(rawVtexId); // Fallback for other types like boolean
              }
          } else {
             processedVtexId = ''; // If rawVtexId is null, undefined, or empty string after trim
          }


          return {
            vtexId: processedVtexId,
            name: getRowValue(row, 'Nome Produto', ['Nome do Produto', 'Nome']),
            productId: getRowValue(row, 'Produto'),
            derivation: getRowValue(row, 'Derivação'),
            productDerivation: getRowValue(row, 'Produto-Derivação', ['Produto Derivacao']),
            stock: Number(getRowValue(row, 'Estoque', [], 0)) || 0,
            readyToShip: Number(getRowValue(row, 'Pronta Entrega', [], 0)) || 0,
            regulatorStock: Number(getRowValue(row, 'Regulador', [], 0)) || 0,
            openOrders: Number(getRowValue(row, 'Pedidos em Aberto', ['Pedidos Abertos', 'Open Orders'], 0)) || 0,
            description: getRowValue(row, 'Descrição'), 
            size: getRowValue(row, 'Tamanho', [], 'Não Especificado'),
            productType: getRowValue(row, 'Tipo. Produto', ['Tipo Produto'], 'Não Especificado'),
            complement: getRowValue(row, 'Compl.'),
            commercialLine: getRowValue(row, 'Linha Comercial'),
            collection: collectionValue,
            commercialLineDescription: getRowValue(row, 'Descrição Linha Comercial'),
            isCurrentCollection: toBoolean(getRowValue(row, 'Coleção Atual', ['Colecao Atual'])),
            collectionStartDate: startDate,
            collectionEndDate: endDate,
            rawCollectionStartDate: String(getRowValue(row, 'Início Coleção', ['Inicio Colecao']) ?? ''),
            rawCollectionEndDate: String(getRowValue(row, 'Fim Coleção', ['Fim Colecao']) ?? ''),
            isExcMtVendors: toBoolean(getRowValue(row, 'Exc.MT-Vendors', ['Exc MT Vendors'])),
            isDiscontinued: toBoolean(getRowValue(row, 'Fora de linha', ['Fora de Linha'])),
          };
        });
        resolve(products);
      } catch (error) {
        console.error("Error parsing Excel:", error);
        reject(new Error('Failed to parse Excel file. Ensure it is a valid Excel file and the format is correct. Error: ' + (error instanceof Error ? error.message : String(error)) ));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
