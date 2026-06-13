import { generateWebToffeeCSV } from "@/lib/csvParser";
import { getProductsCollection } from "@/lib/productsDb";
import { NextRequest, NextResponse } from "next/server";

function yyyyMMDD(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const inStock = searchParams.get("inStock");
    const search = searchParams.get("search");

    // ── Build MongoDB filter ────────────────────────────────────────
    const filter: Record<string, unknown> = {};

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.categories = { $regex: category, $options: "i" };
    }

    if (inStock !== null && inStock !== undefined && inStock !== "") {
      filter.inStock = inStock === "true";
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    // ── Connect and fetch ───────────────────────────────────────────
    const collection = await getProductsCollection();
    const products = await collection.find(filter).toArray();

    // ── Generate CSV ────────────────────────────────────────────────
    const csv = generateWebToffeeCSV(
      products as unknown as Parameters<typeof generateWebToffeeCSV>[0],
    );

    const dateStr = yyyyMMDD();

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-export-${dateStr}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Export failed" },
      { status: 500 },
    );
  }
}
