import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createInteractionSlice, type InteractionSlice } from "./interactionSlice";

enableMapSet();

export type SchemaStore = InteractionSlice;

export const useSchemaStore = create<SchemaStore>()(
  immer((...a) => ({ ...createInteractionSlice(...a) })),
);
