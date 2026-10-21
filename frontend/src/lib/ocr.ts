import Tesseract from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  drugNames: string[];
}

/**
 * Extract text from an image using Tesseract.js
 */
export async function extractTextFromImage(imageFile: File, onProgress?: (progress: number) => void): Promise<OCRResult> {
  try {
    const result = await Tesseract.recognize(imageFile, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    console.log("ocr result", result);

    const text = result.data.text;
    const confidence = result.data.confidence;

    // Extract potential drug names (words that are capitalized or medical-looking)
    const drugNames = extractDrugNames(text);

    return {
      text,
      confidence,
      drugNames,
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image");
  }
}

/**
 * Extract potential drug names from text
 * This is a simple implementation - you might want to improve this with a medical dictionary
 */
function extractDrugNames(text: string): string[] {
  // Split text into words
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  // Filter for potential drug names (capitalized words, excluding common words)
  const commonWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "have",
    "has",
    "had",
    "was",
    "were",
    "been",
    "being",
    "are",
    "will",
    "would",
    "should",
    "could",
    "may",
    "might",
    "must",
    "can",
    "tablet",
    "tablets",
    "mg",
    "capsule",
    "capsules",
    "pill",
    "pills",
    "medication",
    "medicine",
    "drug",
    "drugs",
  ]);

  const drugNames = words
    .filter((word) => {
      const cleaned = word.replace(/[^a-zA-Z]/g, "");
      return cleaned.length >= 3 && /^[A-Z]/.test(cleaned) && !commonWords.has(cleaned.toLowerCase());
    })
    .map((word) => word.replace(/[^a-zA-Z]/g, ""));

  // Remove duplicates and return
  return Array.from(new Set(drugNames));
}
