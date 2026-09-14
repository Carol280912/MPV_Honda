import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { mapInvoice } from "../_shared/receipt.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      anon = Deno.env.get("SUPABASE_ANON_KEY")!,
      service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return reply({ error: "Sign in required" }, 401);
    const body = await req.json();
    if (!body.document_id && !body.storage_path)
      return reply({ error: "Document required" }, 400);
    const query = userClient.from("service_documents").select("*");
    const { data: doc, error: docError } = await (
      body.document_id
        ? query.eq("id", body.document_id)
        : query.eq("storage_path", body.storage_path)
    ).single();
    if (docError || !doc || doc.kind === "Supporting document")
      return reply({ error: "Receipt or invoice unavailable" }, 403);
    const { data: owner } = await userClient
      .from("customers")
      .select("user_id")
      .eq("id", doc.customer_id)
      .single();
    const { data: member } = await userClient
      .from("memberships")
      .select("role")
      .eq("tenant_id", doc.tenant_id)
      .eq("branch_id", doc.branch_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .single();
    if (owner?.user_id !== user.id || member?.role !== "customer")
      return reply({ error: "Customer document ownership required" }, 403);
    const server = createClient(url, service);
    let { data: claim } = await server
      .from("loyalty_claims")
      .select("*")
      .eq("document_id", doc.id)
      .maybeSingle();
    if (!claim) {
      const inserted = await server
        .from("loyalty_claims")
        .insert({
          tenant_id: doc.tenant_id,
          branch_id: doc.branch_id,
          customer_id: doc.customer_id,
          document_id: doc.id,
        })
        .select()
        .single();
      if (inserted.error) {
        const existing = await server
          .from("loyalty_claims")
          .select("*")
          .eq("document_id", doc.id)
          .single();
        if (existing.error) throw Error("Unable to prepare claim");
        claim = existing.data;
      } else claim = inserted.data;
    }
    if (claim.status !== "Extracting") return reply({ status: claim.status });
    async function fail(message: string) {
      const { error } = await server
        .from("loyalty_claims")
        .update({
          status: "Extraction failed",
          extracted: { source: "Extraction unavailable", message },
        })
        .eq("id", claim.id)
        .eq("status", "Extracting");
      if (error) throw Error("Unable to save extraction status");
      return reply({ status: "Extraction failed" });
    }
    const endpoint = Deno.env
        .get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        ?.replace(/\/$/, ""),
      key = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_KEY");
    if (!endpoint || !key)
      return fail(
        "OCR is not configured. You can enter the invoice details manually.",
      );
    const origin = new URL(endpoint);
    if (origin.protocol !== "https:")
      throw Error("OCR endpoint must use HTTPS");
    const { data: job } = await server
      .from("loyalty_ocr_jobs")
      .select("*")
      .eq("document_id", doc.id)
      .maybeSingle();
    if (!job) {
      const lock = await server
        .from("loyalty_ocr_jobs")
        .insert({ document_id: doc.id });
      if (lock.error) return reply({ status: "Extracting" });
      const { data: file, error } = await server.storage
        .from("service-evidence")
        .download(doc.storage_path);
      if (error || !file)
        return fail("Document could not be read. Contact your administrator.");
      if (file.size > 5242880) return fail("Document exceeds 5 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const valid =
        (doc.mime_type === "application/pdf" &&
          String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") ||
        (doc.mime_type === "image/jpeg" &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255) ||
        (doc.mime_type === "image/png" &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v));
      if (!valid)
        return fail(
          "Unsupported file content. Upload a valid JPEG, PNG or PDF.",
        );
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const response = await fetch(
        `${endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ base64Source: btoa(binary) }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        return fail(
          "OCR provider could not accept this document. Enter details manually or contact your administrator.",
        );
      const operation = response.headers.get("operation-location");
      if (!operation || new URL(operation).origin !== origin.origin)
        return fail("Invalid OCR response.");
      const saved = await server
        .from("loyalty_ocr_jobs")
        .update({ operation_url: operation })
        .eq("document_id", doc.id);
      if (saved.error) throw Error("Unable to save OCR job");
      return reply({ status: "Extracting" });
    }
    if (!job.operation_url) {
      if (Date.now() - Date.parse(job.started_at) > 120000)
        return fail(
          "Extraction was interrupted. Enter details manually to avoid duplicate processing.",
        );
      return reply({ status: "Extracting" });
    }
    if (new URL(job.operation_url).origin !== origin.origin)
      return fail("OCR endpoint changed; contact your administrator.");
    const response = await fetch(job.operation_url, {
      headers: { "Ocp-Apim-Subscription-Key": key },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (Date.now() - Date.parse(job.started_at) > 600000)
        return fail("OCR result unavailable. Enter details manually.");
      return reply({ status: "Extracting" });
    }
    const result = await response.json();
    if (result.status === "failed")
      return fail(
        "Document could not be read reliably. Check the original and enter details manually.",
      );
    if (result.status !== "succeeded") {
      if (Date.now() - Date.parse(job.started_at) > 600000)
        return fail("Extraction timed out. Enter details manually.");
      return reply({ status: "Extracting" });
    }
    let mapped;
    try {
      mapped = mapInvoice(result.analyzeResult);
    } catch (e) {
      return fail((e as Error).message);
    }
    const saved = await server
      .from("loyalty_claims")
      .update({ ...mapped, status: "Review details" })
      .eq("id", claim.id)
      .eq("status", "Extracting");
    if (saved.error) throw Error("Unable to save extracted details");
    return reply({ status: "Review details" });
  } catch {
    return reply(
      {
        error:
          "Extraction temporarily unavailable. Your uploaded file remains saved. Retry from Points claims.",
      },
      503,
    );
  }
});
