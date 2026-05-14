import { test, expect } from "@playwright/test";
import mysql from "mysql2/promise";

const API_URL = process.env.API_URL || "http://backend:8000";
const DB_HOST = process.env.MYSQL_HOST || "db";
const DB_USER = process.env.MYSQL_USER || "urlshortener";
const DB_PASSWORD = process.env.MYSQL_PASSWORD || "urlshortener123";
const DB_NAME = process.env.MYSQL_DATABASE || "urlshortener";

async function queryDb(sql: string, params?: any[]) {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });
  const [rows] = await connection.execute(sql, params || []);
  await connection.end();
  return rows as any[];
}

test("@integration POST /shorten creates a short URL and persists it in DB", async ({ request }) => {
  const longUrl = "https://docs.example.com/integration-test";

  const res = await request.post(`${API_URL}/shorten`, {
    data: { long_url: longUrl },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();

  expect(body).toHaveProperty("short_url");
  expect(body).toHaveProperty("short_code");
  expect(body.long_url).toBe(longUrl);
  expect(body.short_code).toMatch(/^\w{7}$/);

  const rows = await queryDb("SELECT * FROM url_mappings WHERE short_code = ?", [body.short_code]);
  expect(rows.length).toBe(1);
  expect(rows[0].long_url).toBe(longUrl);
});

test("@integration GET /{short_code} resolves to the original URL", async ({ request }) => {
  const longUrl = "https://blog.example.com/resolution-test";

  const create = await request.post(`${API_URL}/shorten`, {
    data: { long_url: longUrl },
  });
  const { short_code } = await create.json();

  const res = await request.get(`${API_URL}/${short_code}`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.long_url).toBe(longUrl);
});

test("@integration duplicate URL returns same short code (dedup)", async ({ request }) => {
  const longUrl = "https://dedup.example.com/test";

  const res1 = await request.post(`${API_URL}/shorten`, { data: { long_url: longUrl } });
  const body1 = await res1.json();

  const res2 = await request.post(`${API_URL}/shorten`, { data: { long_url: longUrl } });
  const body2 = await res2.json();

  expect(body1.short_code).toBe(body2.short_code);
});

test("@integration returns 404 for unknown short code", async ({ request }) => {
  const res = await request.get(`${API_URL}/nonexist`);
  expect(res.status()).toBe(404);
});

test("@integration bucket counters are created and incremented", async ({ request }) => {
  const url1 = "https://bucket1.example.com/a";
  const url2 = "https://bucket2.example.com/b";

  await request.post(`${API_URL}/shorten`, { data: { long_url: url1 } });
  await request.post(`${API_URL}/shorten`, { data: { long_url: url2 } });

  const rows = await queryDb("SELECT COUNT(*) as cnt FROM bucket_counters");
  expect(rows[0].cnt).toBeGreaterThanOrEqual(1);
});
