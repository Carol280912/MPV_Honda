// Azure Document Intelligence v4 invoice fields. Never infer payment or eligibility.
type Field = {
  valueString?: string;
  valueDate?: string;
  valueCurrency?: { amount?: number; currencyCode?: string };
  content?: string;
  confidence?: number;
  valueArray?: { valueObject?: Record<string, Field> }[];
};
export function mapInvoice(result: {
  documents?: { fields?: Record<string, Field> }[];
}) {
  if (result.documents?.length !== 1)
    throw Error(
      "Upload one invoice per file; enter details manually if extraction is ambiguous.",
    );
  const f = result.documents[0].fields || {};
  const text = (name: string) =>
    String(
      f[name]?.valueString || f[name]?.valueDate || f[name]?.content || "",
    ).slice(0, 300);
  const amount = f.InvoiceTotal?.valueCurrency?.amount;
  const total =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0
      ? Math.round(amount * 100)
      : 0;
  if (total > 100000000) throw Error("Amount exceeds the supported limit.");
  return {
    merchant: text("VendorName"),
    invoice_number: text("InvoiceId"),
    invoice_date: /^\d{4}-\d{2}-\d{2}$/.test(text("InvoiceDate"))
      ? text("InvoiceDate")
      : "",
    total_sen: total,
    extracted: {
      source: "Azure Document Intelligence · prebuilt-invoice · 2024-11-30",
      currency:
        f.InvoiceTotal?.valueCurrency?.currencyCode || "Unknown — confirm MYR",
      fields: Object.fromEntries(
        [
          "VendorName",
          "InvoiceId",
          "InvoiceDate",
          "InvoiceTotal",
          "TotalTax",
        ].map((k) => [
          k,
          { text: f[k]?.content || "", confidence: f[k]?.confidence ?? null },
        ]),
      ),
      items: (f.Items?.valueArray || [])
        .slice(0, 100)
        .map((i) => ({
          description: i.valueObject?.Description?.content || "",
          amount: i.valueObject?.Amount?.content || "",
        })),
    },
  };
}
