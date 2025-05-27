
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

const KNOWN_PRODUCT_TYPES = [
  "Jogo de Cama",
  "Lençol Avulso",
  "Lençol com Elástico",
  "Lençol Superior",
  "Fronha Avulsa",
  "Cobre Leito",
  "Kit Colcha",
  "Jogo de Colcha",
  "Protetor de Colchão",
  "Protetor de Travesseiro",
  "Saia para Cama Box",
  "Porta Travesseiro",
  "Toalha de Banho",
  "Toalha de Rosto",
  "Toalha de Piso",
  // Single word types that should be prioritized if found alone or as start
  "Edredom",
  "Fronha",
  "Travesseiro",
  "Toalha",
  "Roupão",
  "Cortina",
  "Almofada",
  "Manta",
  "Tapete"
].sort((a, b) => b.length - a.length); // Sort by length descending to match longer phrases first

const deriveProductType = (productName: string): string => {
  if (!productName || typeof productName !== 'string') return 'Outros';
  const nameUpper = productName.toUpperCase();

  for (const type of KNOWN_PRODUCT_TYPES) {
    if (nameUpper.startsWith(type.toUpperCase())) {
      return type;
    }
  }
  // Fallback to the first word if no known type matches
  const firstWord = productName.split(' ')[0];
  return firstWord || 'Outros';
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
          const startDate = parseDate(row['Início Coleção']);
          const endDate = parseDate(row['Fim Coleção']);
          const collectionValue = row[collectionColumnKey] ?? '';
          const productName = row['Nome'] ?? '';

          return {
            vtexId: row['ID VTEX'] ?? '',
            name: productName,
            productId: row['Produto'] ?? undefined,
            derivation: row['Derivação'] ?? undefined,
            productDerivation: row['Produto-Derivação'] ?? undefined,
            stock: Number(row['Estoque']) || 0,
            readyToShip: Number(row['Pronta Entrega']) || 0,
            order: Number(row['Pedido']) || 0,
            description: row['Descrição'] ?? '', // For print/pattern
            size: row['Tamanho'] ?? 'Não Especificado', // From Excel "Tamanho"
            productType: deriveProductType(productName), // Derived from "Nome"
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
