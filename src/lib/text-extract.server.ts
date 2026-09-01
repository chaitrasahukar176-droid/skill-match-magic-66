import { unzipSync, strFromU8 } from "fflate";

function normalize(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return normalize(Array.isArray(text) ? text.join("\n") : text);
}

function extractDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This DOCX file has no readable document body.");
  const xml = strFromU8(doc);
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, " ");
  const text = withBreaks
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return normalize(text);
}

/** Extracts plain text from a PDF or DOCX file buffer. */
export async function extractDocumentText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const lower = fileName.toLowerCase();
  let text: string;
  if (lower.endsWith(".pdf")) {
    text = await extractPdf(bytes);
  } else if (lower.endsWith(".docx")) {
    text = extractDocx(bytes);
  } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = normalize(strFromU8(bytes));
  } else {
    throw new Error("Unsupported file type. Upload a PDF or DOCX file.");
  }

  if (text.replace(/\s/g, "").length < 40) {
    throw new Error("Could not read enough text from this file (it may be a scanned image).");
  }
  return text.slice(0, 24000);
}
