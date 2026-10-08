import { getReceiptUrl } from "@/lib/operations/service";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = await getReceiptUrl((await params).id);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
