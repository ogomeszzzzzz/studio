
import * as XLSX from 'xlsx';
import { parse, isValid, subDays } from 'date-fns';
import type { Product } from '@/types'; // Removed SalesRecord

const robustParseDate = (dateStr: string | number | undefined): Date | null => {
  if (dateStr === null || dateStr === undefined) return null;

  if (typeof dateStr === 'number') {
    // Excel date (serial number)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch starts Dec 30, 1899 for compatibility with Lotus 1-2-3
    const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
    if (isValid(date)) return date;
  }
  if (typeof dateStr === 'string') {
    const commonFormats = [
      'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm', 'dd/MM/yyyy',
      'MM/dd/yyyy HH:mm:ss', 'MM/dd/yyyy HH:mm', 'MM/dd/yyyy',
      'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm', 'yyyy-MM-dd',
      'dd-MM-yyyy HH:mm:ss', 'dd-MM-yyyy HH:mm', 'dd-MM-yyyy',
      'MM-dd-yyyy HH:mm:ss', 'MM-dd-yyyy HH:mm', 'MM-dd-yyyy',
      "yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'",
      'dd/MM/yy HH:mm', 'dd/MM/yy',
      'MM/dd/yy HH:mm', 'MM/dd/yy'
    ];
    for (const format of commonFormats) {
      const parsed = parse(dateStr, format, new Date());
      if (isValid(parsed)) return parsed;
    }
    // Try ISO date parse as a fallback
    const isoParsed = new Date(dateStr);
    if (isValid(isoParsed)) return isoParsed;
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
  const keysToTry = [primaryKey, ...fallbacks.map(f => f.toLowerCase().trim()), primaryKey.toLowerCase().trim()];
  const rowKeys = Object.keys(row).map(k => k.toLowerCase().trim());

  for (const tryKey of keysToTry) {
    const actualKeyIndex = rowKeys.indexOf(tryKey);
    if (actualKeyIndex !== -1) {
      const originalKey = Object.keys(row)[actualKeyIndex];
       if (row[originalKey] !== null && row[originalKey] !== undefined && String(row[originalKey]).trim() !== '') {
         return row[originalKey];
       }
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
          const startDate = robustParseDate(getRowValue(row, 'Início Coleção', ['Inicio Colecao']));
          const endDate = robustParseDate(getRowValue(row, 'Fim Coleção', ['Fim Colecao']));
          const collectionValue = getRowValue(row, collectionColumnKey, [], '');
          
          const rawVtexId = getRowValue(row, 'ID VTEX', ['Id Vtex', 'IDVtex', 'ID_VTEX'], ''); 
          let processedVtexId: string | number = ''; 

          if (rawVtexId !== null && rawVtexId !== undefined && String(rawVtexId).trim() !== '') {
              if (typeof rawVtexId === 'number' && !isNaN(rawVtexId)) {
                  processedVtexId = rawVtexId; 
              } else if (typeof rawVtexId === 'string') {
                  const trimmedVal = rawVtexId.trim();
                  if (/^[-+]?\d*\.?\d+$/.test(trimmedVal) && !isNaN(Number(trimmedVal))) {
                      processedVtexId = Number(trimmedVal);
                  } else {
                      processedVtexId = trimmedVal; 
                  }
              } else {
                  processedVtexId = String(rawVtexId); 
              }
          } else {
             processedVtexId = ''; 
          }

          const priceValue = getRowValue(row, 'Preço', ['PRECO', 'PREÇO'], 0);
          const sales30dValue = getRowValue(row, 'Venda 30d', ['VENDAS 30D', 'VENDA_30D', 'VENDAS_30D'], 0);

          return {
            vtexId: processedVtexId,
            name: getRowValue(row, 'Nome Produto', ['Nome do Produto', 'Nome']),
            productId: getRowValue(row, 'Produto'),
            derivation: getRowValue(row, 'Derivação'),
            productDerivation: getRowValue(row, 'Produto-Derivação', ['Produto Derivacao', 'Produto-Derivaçao', 'Produto-derivacao']),
            stock: Number(getRowValue(row, 'Estoque', [], 0)) || 0,
            readyToShip: Number(getRowValue(row, 'Pronta Entrega', ['Pronta_Entrega', 'Pronta entrega'], 0)) || 0,
            regulatorStock: Number(getRowValue(row, 'Regulador', [], 0)) || 0,
            openOrders: Number(getRowValue(row, 'Pedidos em Aberto', ['Pedidos Abertos', 'Open Orders', 'PEDIDOS_EM_ABERTO', 'Pedidos em aberto'], 0)) || 0,
            description: getRowValue(row, 'Descrição', ['Descricao']), 
            size: getRowValue(row, 'Tamanho', [], 'Não Especificado'),
            productType: getRowValue(row, 'Tipo. Produto', ['Tipo Produto', 'Tipo.Produto'], 'Não Especificado'),
            complement: getRowValue(row, 'Compl.'),
            commercialLine: getRowValue(row, 'Linha Comercial', ['Linha comercial']),
            collection: collectionValue,
            commercialLineDescription: getRowValue(row, 'Descrição Linha Comercial', ['Descricao Linha Comercial']),
            isCurrentCollection: toBoolean(getRowValue(row, 'Coleção Atual', ['Colecao Atual', 'Coleçao Atual'])),
            collectionStartDate: startDate,
            collectionEndDate: endDate,
            rawCollectionStartDate: String(getRowValue(row, 'Início Coleção', ['Inicio Colecao']) ?? ''),
            rawCollectionEndDate: String(getRowValue(row, 'Fim Coleção', ['Fim Colecao']) ?? ''),
            isExcMtVendors: toBoolean(getRowValue(row, 'Exc.MT-Vendors', ['Exc MT Vendors', 'Exc. MT-Vendors'])),
            isDiscontinued: toBoolean(getRowValue(row, 'Fora de linha', ['Fora de Linha', 'Fora deLinha'])),
            price: typeof priceValue === 'string' ? parseFloat(priceValue.replace(',', '.')) : Number(priceValue) || 0,
            sales30d: Number(sales30dValue) || 0,
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

// Removed parseSalesData function as it was specific to the deleted Intelligence Panel
// export const parseSalesData = (file: File): Promise<SalesRecord[]> => { ... };
