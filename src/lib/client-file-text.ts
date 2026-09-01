/**
 * Browser-side plain-text extraction used only for pasting job-description
 * files into the JD form. Resume files are extracted server-side.
 */
export async function readFileAsText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return (await file.text()).trim();
  }

  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text).replace(/\s+\n/g, "\n").trim();
  }

  if (name.endsWith(".docx")) {
    const { unzipSync, strFromU8 } = await import("fflate");
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const doc = files["word/document.xml"];
    if (!doc) throw new Error("That DOCX file looks empty.");
    return strFromU8(doc)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT or MD.");
}
