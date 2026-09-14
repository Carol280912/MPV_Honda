import type { Actor, Data, Repository, Table } from "../lib/types";
import { supabase } from "../lib/supabase";
export const supabaseRepository: Repository = {
  async load(actor: Actor) {
    if (!supabase) throw Error("Supabase is not configured.");
    const tables: Table[] = [
      "loyalty_claims",
      "service_documents",
      "service_catalogue",
      "service_requests",
      "customers",
      "vehicles",
      "appointments",
      "recovery_cases",
      "campaigns",
      "adjustments",
      "loyalty_entries",
      "memberships",
      "settings",
      "audit_events",
      "feedback",
      "notifications",
      "inspections",
    ];
    const data = {} as Data;
    await Promise.all(
      tables.map(async (table) => {
        const { data: rows, error } = await supabase!
          .from(table)
          .select("*")
          .eq("tenant_id", actor.tenant_id)
          .eq("branch_id", actor.branch_id);
        if (error) throw Error(`${table}: ${error.message}`);
        (data as unknown as Record<string, unknown>)[table] = rows;
      }),
    );
    data.appointments = data.appointments.map((a) => ({
      ...a,
      time: a.time.slice(0, 5),
    }));
    return data;
  },
  async execute(actor, command) {
    if (!supabase) throw Error("Supabase is not configured.");
    if (command.type === "loyalty.extract") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.functions.invoke(
          "extract-receipt",
          {
            body: {
              document_id: command.id,
              storage_path: command.payload.storage_path,
            },
          },
        );
        if (error)
          throw Error(
            "Extraction unavailable. Your upload is saved; retry from Points claims.",
          );
        if (data?.status !== "Extracting") return;
        if (attempt < 7)
          await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return;
    }
    const { error } = await supabase.rpc(
      command.type.startsWith("loyalty.")
        ? "loyalty_action"
        : command.type.startsWith("document.")
          ? "document_action"
          : command.type.startsWith("phase2.")
            ? "phase2_action"
            : "phase1_action",
      {
        p_tenant: actor.tenant_id,
        p_branch: actor.branch_id,
        p_action: command.type,
        p_id: command.id || null,
        p_payload: command.payload,
      },
    );
    if (error) throw Error(error.message);
  },
};
