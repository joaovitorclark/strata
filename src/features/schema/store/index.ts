import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createLodSlice, type LodSlice } from "@/features/canvas/store/lodSlice";
import { createDocumentSlice, type DocumentSlice } from "./documentSlice";
import { createInteractionSlice, type InteractionSlice } from "./interactionSlice";
import { createViewSlice, type ViewSlice } from "./viewSlice";

enableMapSet();

export type SchemaStore = InteractionSlice & LodSlice & DocumentSlice & ViewSlice;

export const useSchemaStore = create<SchemaStore>()(
  immer((...a) => ({
    ...createInteractionSlice(...(a as Parameters<typeof createInteractionSlice>)),
    ...createLodSlice(...(a as Parameters<typeof createLodSlice>)),
    ...createDocumentSlice(...(a as Parameters<typeof createDocumentSlice>)),
    ...createViewSlice(...(a as Parameters<typeof createViewSlice>)),
  })),
);
