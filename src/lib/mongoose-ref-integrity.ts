// src/lib/mongoose-ref-integrity.ts
//
// BR-099: Mongoose does not check that a `ref` field's target document
// actually exists — this plugin adds that check as an async validator on
// every ObjectId path that declares a `ref`. A null/undefined value always
// passes: every optional ref in this codebase (e.g. actorRef: null for a
// system-generated audit/timeline entry) means "no reference," not "any
// reference," and a required-but-missing ref is already caught by
// Mongoose's own `required` validator — this only adds the "and it must
// point at something real" half.
//
// Apply via `schema.plugin(refIntegrityPlugin)` on any schema with
// cross-collection ObjectId references. Every model this is applied to
// already creates referenced documents before referencing them (e.g. the
// category-setup wizard creates the Category first, then the RoutingRule
// and SLARule against its real _id; the dev seed route creates Offices
// before Categories before RoutingRules/SLARules before Complaints) — so
// this only rejects genuinely dangling references, never a legitimate
// same-request creation order.
import mongoose, { Schema } from "mongoose";

export function refIntegrityPlugin(schema: Schema) {
  schema.eachPath((pathName, schemaType) => {
    const refName = (schemaType as unknown as { options?: { ref?: string } }).options?.ref;
    if (!refName || schemaType.instance !== "ObjectId") return;

    schemaType.validate({
      validator: async function (value: unknown) {
        if (value == null) return true;
        const RefModel = mongoose.models[refName];
        if (!RefModel) return true; // ref model not registered — don't block on unrelated wiring
        const exists = await RefModel.exists({ _id: value });
        return exists != null;
      },
      message: (props: { path: string }) =>
        `${props.path} references a ${refName} document that does not exist`,
    });
  });
}
