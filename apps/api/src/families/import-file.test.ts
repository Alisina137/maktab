import assert from "node:assert/strict";
import test from "node:test";
import { parseTabularFile } from "./import-file.js";

test("CSV import preview preserves quoted values and headers", () => {
  const csv = 'username,fullName,phone\nparent.1,"Parent, One",0700000000\n';
  const preview = parseTabularFile("parents.csv", Buffer.from(csv).toString("base64"));
  assert.deepEqual(preview.headers, ["username", "fullName", "phone"]);
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0]?.fullName, "Parent, One");
});


function storedZip(entries: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);

    localOffset += local.length + name.length + content.length;
  }

  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralData.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  return Buffer.concat([localData, centralData, eocd]);
}

test("XLSX import preview reads the first worksheet", () => {
  const worksheet = `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet>
      <sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>username</t></is></c>
          <c r="B1" t="inlineStr"><is><t>fullName</t></is></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>parent.xlsx</t></is></c>
          <c r="B2" t="inlineStr"><is><t>Parent XLSX</t></is></c>
        </row>
      </sheetData>
    </worksheet>`;
  const workbook = storedZip([
    { name: "xl/worksheets/sheet1.xml", content: worksheet }
  ]);

  const preview = parseTabularFile("parents.xlsx", workbook.toString("base64"));
  assert.deepEqual(preview.headers, ["username", "fullName"]);
  assert.equal(preview.rows[0]?.username, "parent.xlsx");
  assert.equal(preview.rows[0]?.fullName, "Parent XLSX");
});
