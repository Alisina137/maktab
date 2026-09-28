import { inflateRawSync } from "node:zlib";

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export interface TabularPreview {
  headers: string[];
  rows: Array<Record<string, string>>;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function matrixToPreview(matrix: string[][]): TabularPreview {
  if (matrix.length === 0) throw new ImportFileError("The import file is empty.");
  const headers = (matrix[0] ?? []).map((value) => value.trim());
  if (headers.length === 0 || headers.every((value) => !value)) {
    throw new ImportFileError("The import file must contain a header row.");
  }
  if (headers.some((value) => !value)) {
    throw new ImportFileError("Every import column must have a header.");
  }
  if (new Set(headers.map((value) => value.toLowerCase())).size !== headers.length) {
    throw new ImportFileError("Import column headers must be unique.");
  }

  const rows = matrix
    .slice(1)
    .filter((row) => row.some((value) => value.trim() !== ""))
    .slice(0, 1000)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));

  if (rows.length === 0) throw new ImportFileError("The import file has no data rows.");
  return { headers, rows };
}

function parseCsv(text: string): TabularPreview {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(",") ? "," : firstLine.includes("\t") ? "\t" : ",";
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index] ?? "";
    const next = clean[index + 1] ?? "";
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      matrix.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) throw new ImportFileError("The CSV contains an unclosed quoted field.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    matrix.push(row);
  }
  return matrixToPreview(matrix);
}

function unzipEntries(buffer: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new ImportFileError("The XLSX file is not a valid ZIP workbook.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new ImportFileError("The XLSX ZIP directory is invalid.");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new ImportFileError("The XLSX ZIP entry is invalid.");
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let content: Buffer;
    if (method === 0) content = compressed;
    else if (method === 8) content = inflateRawSync(compressed);
    else throw new ImportFileError("The XLSX file uses an unsupported ZIP compression method.");
    entries.set(fileName, content);

    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

function xmlTextFragments(xml: string): string {
  return Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    .map((match) => decodeXml(match[1] ?? ""))
    .join("");
}

function parseXlsx(buffer: Buffer): TabularPreview {
  const entries = unzipEntries(buffer);
  const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = Array.from(sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g))
    .map((match) => xmlTextFragments(match[1] ?? ""));

  const sheetName = Array.from(entries.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numberA = Number(a.match(/sheet(\d+)/i)?.[1] ?? 0);
      const numberB = Number(b.match(/sheet(\d+)/i)?.[1] ?? 0);
      return numberA - numberB;
    })[0];
  if (!sheetName) throw new ImportFileError("The XLSX workbook does not contain a worksheet.");

  const xml = entries.get(sheetName)?.toString("utf8") ?? "";
  const matrix: string[][] = [];

  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    const rowXml = rowMatch[1] ?? "";
    for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? "A1";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      let value = "";
      if (type === "s") value = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") value = xmlTextFragments(body);
      else value = decodeXml(raw);
      row[columnIndex(ref)] = value;
    }
    matrix.push(row.map((value) => value ?? ""));
  }
  return matrixToPreview(matrix);
}

export function parseTabularFile(fileName: string, contentBase64: string): TabularPreview {
  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length === 0) throw new ImportFileError("The uploaded import file is empty.");
  if (buffer.length > 5 * 1024 * 1024) throw new ImportFileError("Import files are limited to 5 MB.");

  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return parseCsv(buffer.toString("utf8"));
  if (lower.endsWith(".xlsx")) return parseXlsx(buffer);
  throw new ImportFileError("Use a CSV or XLSX import file.");
}
