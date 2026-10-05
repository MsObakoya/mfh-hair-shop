import { NextResponse } from "next/server";
import { products, productCategories } from "../../../lib/products";

export async function GET() {
  return NextResponse.json({ products, categories: productCategories });
}
