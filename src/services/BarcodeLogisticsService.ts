/**
 * Al-Thuraya ERP & JAM System Pro - Barcode Logistics & Advanced Data Import Utilities
 * Author: Senior Software Architect & Lead Backend Developer
 */

// Local dictionary containing synonym mapping for inventory field standards
const SCHEMA_LOCAL_DICTIONARY: { [field: string]: string[] } = {
  barcode: [
    'الباركود', 'باركود', 'الكود', 'رقم الباركود', 'رقم الكود', 'تشفير', 'رمز المنتج', 'الرمز', 'رقم التشيفر',
    'barcode', 'code', 'sku', 'upc', 'ean', 'sn', 'serialnumber', 'id', 'رقم القطعة', 'الرقم المصنعي', 'رقم_القطعة'
  ],
  name: [
    'اسم المنتج', 'اسم الصنف', 'الصنف', 'الاسم', 'البضاعة', 'المادة', 'اسم المادة', 'البيان',
    'name', 'productname', 'itemname', 'product', 'item', 'title', 'label', 'description'
  ],
  category: [
    'القسم', 'المجموعة', 'الفئة', 'نوع الصنف', 'تصنيف', 'قسم البضاعة', 'العائلة',
    'category', 'group', 'type', 'section', 'classification'
  ],
  cost: [
    'سعر التكلفة', 'التكلفة', 'سعر الشراء', 'شراء', 'تكلفة', 'تكلفتها', 'سعر تكلفة الصنف', 'سعر تكلفه', 'التكلفه',
    'cost', 'buyprice', 'purchaseprice', 'buy', 'purchase'
  ],
  price: [
    'سعر البيع', 'البيع', 'سعر تجزئة', 'سعر مفرق', 'سعر الحبة', 'سعر بيع الصنف', 'القيمة', 'السعر', 'سعر الحبه',
    'price', 'saleprice', 'retailprice', 'sale', 'sell', 'amount'
  ],
  stock: [
    'الكمية الحالية', 'الكمية', 'المخزون', 'الموجود', 'العدد', 'الكمية المتوفرة', 'الرصيد', 'كمية', 'كميه',
    'stock', 'quantity', 'qty', 'count', 'amount', 'onhand', 'balance'
  ],
  model: [
    'الموديل', 'موديل', 'النوع', 'رقم الموديل', 'الموديل/الماركة',
    'model', 'modelnumber', 'brand_model'
  ]
};

/**
 * Normalizes Arabic characters to avoid mismatched spellings due to Tashkeel/Alefs/Teh Marbutas etc.
 */
export function normalizeArabicString(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '') // Strip Arabic diacritics (Fatha, Damma, etc)
    .replace(/[أإآ]/g, 'ا') // Normalize Alef variations
    .replace(/ة/g, 'ه') // Normalize Teh Marbuta to Heh
    .replace(/ى/g, 'ي') // Normalize Alef Maksura to Yeh
    .replace(/[\s_\-\t\n\r]/g, ''); // Strip all spacing and punctuations
}

/**
 * Classical Levenshtein Distance algorithm to compute minimal edit distance between strings.
 * Perfect for finding optimal matches under minor misspelling errors in headers.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,    // Deletion
          matrix[i][j - 1] + 1,    // Insertion
          matrix[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }
  
  return matrix[a.length][b.length];
}

/**
 * Calculates string similarity percentage (0.0 to 1.0) based on Levenshtein Distance
 */
export function getSimilarityScore(s1: string, s2: string): number {
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

/**
 * Calculates EAN-13 Checksum (the 13th digit) according to GS1 coding specifications.
 */
export function calculateEAN13Checksum(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Auto-generates a unique valid EAN-13 barcode starting with '29', ensuring it does not collide
 * with any of the predefined merchant database records.
 */
export function generateUniqueEAN13(existingBarcodes: Set<string>): string {
  let isUnique = false;
  let code = '';
  let safetyCounter = 0;
  
  while (!isUnique && safetyCounter < 500) {
    safetyCounter++;
    const midPart = String(Date.now()).slice(-8); // 8-digit unique timestamp division
    const randPart = String(Math.floor(10 + Math.random() * 90)); // 2-digit random slice
    const base12 = `29${midPart}${randPart}`;
    const checksum = calculateEAN13Checksum(base12);
    code = `${base12}${checksum}`;
    
    if (!existingBarcodes.has(code.toLowerCase())) {
      isUnique = true;
    }
  }
  return code;
}

/**
 * 1. AI & Local Dictionary-Driven Column Suggestion Matching System.
 * Matches legacy input spreadsheet headers dynamically to the app's standard schemas.
 */
export function suggestColumnMapping(
  legacyHeaders: string[],
  targetSchema: string[]
): Record<string, string> {
  const resultSuggestions: Record<string, string> = {};

  for (const rawHeader of legacyHeaders) {
    const headerNormal = normalizeArabicString(rawHeader);
    let bestMatchKey = '';
    let highestScore = 0.0;

    // Phase A: Dictionary-based Synonym Verification
    for (const schemaKey of targetSchema) {
      const synonyms = SCHEMA_LOCAL_DICTIONARY[schemaKey] || [];
      for (const synonym of synonyms) {
        const synonymNormal = normalizeArabicString(synonym);
        if (headerNormal === synonymNormal) {
          bestMatchKey = schemaKey;
          highestScore = 1.0;
          break;
        }
      }
      if (highestScore === 1.0) break;
    }

    // Phase B: Levenshtein Distance Fallback (if confidence score is too low or unmapped)
    if (highestScore < 1.0) {
      for (const schemaKey of targetSchema) {
        // Compute against target name and synonyms
        const synonyms = SCHEMA_LOCAL_DICTIONARY[schemaKey] || [];
        for (const synonym of synonyms) {
          const score = getSimilarityScore(rawHeader, synonym);
          if (score > highestScore && score >= 0.55) {
            highestScore = score;
            bestMatchKey = schemaKey;
          }
        }
      }
    }

    if (bestMatchKey) {
      resultSuggestions[rawHeader] = bestMatchKey;
    } else {
      resultSuggestions[rawHeader] = '';
    }
  }

  return resultSuggestions;
}

/**
 * 2. Adaptive Barcode parsing block (Preserves valid input or dynamically auto-generates GS1 compliant EAN-13s).
 */
export function adaptiveBarcodeProcess(
  items: any[],
  existingBarcodes: Set<string>
): {
  processedRows: any[];
  autoGeneratedCount: number;
  duplicateResolvedCount: number;
} {
  const processedRows: any[] = [];
  let autoGeneratedCount = 0;
  let duplicateResolvedCount = 0;
  const localBatchTracking = new Set<string>();

  for (const item of items) {
    const currentItem = { ...item };
    
    // Normalize properties
    currentItem.name = String(currentItem.name || '').trim();
    currentItem.category = String(currentItem.category || 'عام').trim();
    currentItem.cost = Number(currentItem.cost) || 0;
    currentItem.price = Number(currentItem.price) || 0;
    currentItem.stock = Number(currentItem.stock) || 0;

    const rawBarcode = item.barcode ? sanitizeBarcodeScan(String(item.barcode)) : '';

    if (!rawBarcode) {
      // Create new standard EAN13
      const generatedCode = generateUniqueEAN13(new Set([...existingBarcodes, ...localBatchTracking]));
      currentItem.barcode = generatedCode;
      localBatchTracking.add(generatedCode.toLowerCase());
      autoGeneratedCount++;
    } else {
      const lowerKey = rawBarcode.toLowerCase();
      if (existingBarcodes.has(lowerKey) || localBatchTracking.has(lowerKey)) {
        // Resolve duplicate barcode safely
        let alternateUnique = '';
        let isUnique = false;
        let suffix = 1;
        while (!isUnique) {
          alternateUnique = `${rawBarcode}-${suffix}`;
          const checkKey = alternateUnique.toLowerCase();
          if (!existingBarcodes.has(checkKey) && !localBatchTracking.has(checkKey)) {
            isUnique = true;
          }
          suffix++;
        }
        currentItem.barcode = alternateUnique;
        localBatchTracking.add(alternateUnique.toLowerCase());
        duplicateResolvedCount++;
      } else {
        currentItem.barcode = rawBarcode;
        localBatchTracking.add(lowerKey);
      }
    }
    processedRows.push(currentItem);
  }

  return {
    processedRows,
    autoGeneratedCount,
    duplicateResolvedCount
  };
}

/**
 * 3. Universal Keyboard Wedge / Physical Hardware scanner input sanitizer.
 * Drops line-breaks (\r, \n), tab delimiters (\t), hidden non-printable bytes or spacing delays.
 */
export function sanitizeBarcodeScan(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[\r\n\t]/g, '')               // Remove Carriage Return, Line Feed, and Tab configurations
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')    // Strip non-printable ASCII characters and device control bytes
    .replace(/\s+/g, '');                    // Prevent double spaced gaps from fast-trigger mechanical keys
}
