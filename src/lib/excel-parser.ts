
import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';
import type { Product } from '@/types';

const parseDate = (dateStr: string | number | undefined): Date | null => {
  if (typeof dateStr === 'number') {
    // Handle Excel date serial numbers
    // Excel's epoch starts on December 30, 1899 for Windows, or Jan 1, 1904 for Mac (less common)
    // Assuming Windows epoch.
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // December 30, 1899
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
  if (row[primaryKey] !== undefined && row[primaryKey] !== null) {
    return row[primaryKey];
  }
  for (const fallbackKey of fallbacks) {
    if (row[fallbackKey] !== undefined && row[fallbackKey] !== null) {
      return row[fallbackKey];
    }
  }
  // Try case-insensitive match for primaryKey as a last resort for common keys
  const rowKeys = Object.keys(row);
  const primaryKeyUpper = primaryKey.toUpperCase();
  const foundKey = rowKeys.find(k => k.toUpperCase() === primaryKeyUpper);
  if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
    return row[foundKey];
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
          const productName = getRowValue(row, 'Nome Produto', ['Nome do Produto', 'Nome']);
          
          // Robust way to get ID VTEX
          let vtexIdValue = getRowValue(row, 'ID VTEX', ['Id Vtex', 'IDVtex', 'ID_VTEX']);
          if (vtexIdValue === '' || vtexIdValue === null || vtexIdValue === undefined) {
             // Check if a column named 'ID VTEX' (with space) exists
             const keys = Object.keys(row);
             const exactKey = keys.find(k => k.trim() === 'ID VTEX');
             if (exactKey) {
                vtexIdValue = row[exactKey];
             }
          }


          return {
            vtexId: vtexIdValue ?? '',
            name: productName,
            productId: getRowValue(row, 'Produto'),
            derivation: getRowValue(row, 'Derivação'),
            productDerivation: getRowValue(row, 'Produto-Derivação', ['Produto Derivacao']),
            stock: Number(getRowValue(row, 'Estoque', [], 0)) || 0,
            readyToShip: Number(getRowValue(row, 'Pronta Entrega', [], 0)) || 0,
            regulatorStock: Number(getRowValue(row, 'Regulador', [], 0)) || 0,
            description: getRowValue(row, 'Descrição'), // For print/pattern
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
