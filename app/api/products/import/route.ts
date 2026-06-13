import { parseWebToffeeCSV } from "@/lib/csvParser";
import { getProductsCollection } from "@/lib/productsDb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // ── Read the uploaded file ────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json(
      { success: false, error: "No file uploaded" },
      { status: 400 },
    );
  }

  let fileContent: string;
  try {
    fileContent = await file.text();
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to read uploaded file" },
      { status: 400 },
    );
  }

  if (!fileContent.trim()) {
    return NextResponse.json(
      { success: false, error: "Uploaded file is empty" },
      { status: 400 },
    );
  }

  // ── Parse CSV ─────────────────────────────────────────────────────
  const products = parseWebToffeeCSV(fileContent);
  console.log('File size:', fileContent.length);
  console.log('Parsed products count:', products.length);
  console.log('First product:', JSON.stringify(products[0], null, 2));

  // ── Connect to DB ─────────────────────────────────────────────────
  let collection;
  try {
    collection = await getProductsCollection();
  } catch {
    return NextResponse.json(
      { success: false, error: "Database connection failed" },
      { status: 500 },
    );
  }

  // ── Upsert each product by SKU ────────────────────────────────────
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { sku: string; message: string }[] = [];

  for (const product of products) {
    const { sku } = product;
    if (!sku) {
      skipped++;
      continue;
    }

    try {
      const result = await collection.updateOne(
        { sku },
        {
          $set: { ...product, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        imported++;
      } else {
        updated++;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error during upsert";
      errors.push({ sku, message });
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    updated,
    skipped,
    errors,
  });
}
