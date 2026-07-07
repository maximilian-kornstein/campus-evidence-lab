import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
export const repoRoot = path.resolve(path.dirname(__filename), "../..");

export const parseArgs = (argv, defaults = {}) => {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
};

export const slugify = (value) => {
  const slug = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
};

export const hashId = (prefix, parts) => {
  const hash = crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part ?? "").toLowerCase().trim()).join("|"))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${hash}`;
};

export const normalizeEmail = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
};

export const domainFromEmail = (email) => {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") ? normalized.split("@").pop() : "";
};

export const normalizeDomain = (value) => {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (text.includes("@")) return domainFromEmail(text);
  return text.replace(/[^a-z0-9.-]/g, "");
};

export const sqlString = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;

export const runSql = (db, sql) =>
  execFileSync("sqlite3", [db], {
    cwd: repoRoot,
    input: sql,
    encoding: "utf8",
  });

export const queryJson = (db, sql) => {
  const output = execFileSync("sqlite3", ["-json", db, sql], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  return output ? JSON.parse(output) : [];
};

export const toCsv = (rows, headers) => {
  const escapeCell = (value) => {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n") + "\n";
};

export const parseCsv = (text) => {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((candidate) =>
    candidate.some((cell) => String(cell).trim() !== ""),
  );
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), dataRow[index] ?? ""])),
  );
};
