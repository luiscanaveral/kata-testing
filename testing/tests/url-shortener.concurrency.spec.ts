import { test, expect } from "@playwright/test";

const API_URL = process.env.API_URL || "http://localhost:4000";

async function shorten(request: any, url: string) {
  const res = await request.post(`${API_URL}/shorten`, { data: { long_url: url } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test("@concurrency same URL sent 15 times returns the same short code", async ({ request }) => {
  const longUrl = "https://concurrency-test.example.com/identical-url";
  const results: string[] = [];

  for (let i = 0; i < 15; i++) {
    const body = await shorten(request, longUrl);
    results.push(body.short_code);
  }

  const uniqueCodes = new Set(results);
  expect(uniqueCodes.size).toBe(1);
});

test("@concurrency 30 different URLs all get unique short codes", async ({ request }) => {
  const urls = Array.from(
    { length: 30 },
    (_, i) => `https://concurrency-test.example.com/unique-${i}`
  );

  const results: string[] = [];
  for (let i = 0; i < urls.length; i += 5) {
    const batch = urls.slice(i, i + 5);
    const bodies = await Promise.all(
      batch.map((url) =>
        request.post(`${API_URL}/shorten`, { data: { long_url: url } }).then((r: any) => {
          expect(r.ok()).toBeTruthy();
          return r.json();
        })
      )
    );
    results.push(...bodies.map((b: any) => b.short_code));
  }

  const uniqueCodes = new Set(results);
  expect(uniqueCodes.size).toBe(30);
});

test("@concurrency all generated short codes are globally unique", async ({ request }) => {
  const urls = Array.from(
    { length: 50 },
    (_, i) => `https://concurrency-test.example.com/global-${i}`
  );

  const results: string[] = [];
  for (let i = 0; i < urls.length; i += 5) {
    const batch = urls.slice(i, i + 5);
    const bodies = await Promise.all(
      batch.map((url) =>
        request.post(`${API_URL}/shorten`, { data: { long_url: url } }).then((r: any) => {
          expect(r.ok()).toBeTruthy();
          return r.json();
        })
      )
    );
    results.push(...bodies.map((b: any) => b.short_code));
  }

  const uniqueCodes = new Set(results);
  expect(uniqueCodes.size).toBe(50);
});

test("@concurrency same URL sent concurrently with 3 different URLs each gets consistent results", async ({ request }) => {
  const testUrls = [
    "https://concurrency-test.example.com/batch-A",
    "https://concurrency-test.example.com/batch-B",
    "https://concurrency-test.example.com/batch-C",
  ];

  for (const url of testUrls) {
    const bodies = await Promise.all(
      Array.from({ length: 10 }, () =>
        request.post(`${API_URL}/shorten`, { data: { long_url: url } }).then((r: any) => {
          expect(r.ok()).toBeTruthy();
          return r.json();
        })
      )
    );

    const shortCodes = bodies.map((b: any) => b.short_code);
    const uniqueCodes = new Set(shortCodes);
    expect(uniqueCodes.size).toBe(1);
  }
});
