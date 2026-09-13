import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createLodSlice, type LodSlice } from "@/features/canvas/store/lodSlice";
import { createDocumentSlice, type DocumentSlice } from "./documentSlice";
import { createInteractionSlice, type InteractionSlice } from "./interactionSlice";

enableMapSet();

export type SchemaStore = InteractionSlice & LodSlice & DocumentSlice;

export const useSchemaStore = create<SchemaStore>()(
  immer((...a) => ({
    ...createInteractionSlice(...a),
    ...createLodSlice(...a),
    ...createDocumentSlice(...a),
  })),
);
