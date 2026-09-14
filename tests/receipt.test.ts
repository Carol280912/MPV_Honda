import { it, expect } from "vitest";
import { mapInvoice } from "../supabase/functions/_shared/receipt";
it("maps OCR suggestions, line items and confidence without treating OCR as proof of payment", () => {
  const mapped = mapInvoice({
    documents: [
      {
        fields: {
          VendorName: { valueString: "Dealer", confidence: 0.99 },
          InvoiceId: { valueString: "A-123" },
          InvoiceDate: { valueDate: "2026-01-01" },
          InvoiceTotal: {
            valueCurrency: { amount: 125.5, currencyCode: "MYR" },
            confidence: 0.7,
          },
          Items: {
            valueArray: [
              {
                valueObject: {
                  Description: { content: "Oil service" },
                  Amount: { content: "125.50" },
                },
              },
            ],
          },
        },
      },
    ],
  });
  expect(mapped.total_sen).toBe(12550);
  expect(mapped.extracted.currency).toBe("MYR");
  expect(mapped.extracted.items[0].description).toBe("Oil service");
  expect(mapped).not.toHaveProperty("points");
  expect(mapped).not.toHaveProperty("paid_confirmed");
});
it("does not fabricate missing values or accept multiple invoices as one claim", () => {
  expect(mapInvoice({ documents: [{ fields: {} }] }).total_sen).toBe(0);
  expect(() => mapInvoice({ documents: [{}, {}] })).toThrow(/one invoice/);
});
