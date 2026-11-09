import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

// Server-only: turns an uploaded course outline file into plain text.

export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "html", "htm"];

export async function readOutlineFile(file: File): Promise<string> {
  // Work out the file type from its name, e.g. "COMP1531.pdf" -> "pdf"
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const bytes = new Uint8Array(await file.arrayBuffer());

  // PDF: pull the text out of every page
  if (extension === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }

  // Word document
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  }

  // A saved web page: drop scripts, styles and tags, keep the words
  if (extension === "html" || extension === "htm") {
    const html = new TextDecoder().decode(bytes);
    return html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
  }

  // Plain text
  if (extension === "txt" || extension === "md") {
    return new TextDecoder().decode(bytes);
  }

  throw new Error(`${file.name} isn't a supported file. Drop a PDF, Word (.docx), text or HTML file.`);
}
