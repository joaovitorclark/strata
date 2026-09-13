import { createContext, useContext } from "react";
import {
  type CanvasDensity,
  rowHeightForDensity,
} from "@/features/canvas/utils/scaleLimits";

export const CanvasDensityContext = createContext<CanvasDensity>("cozy");

export function useCanvasDensity(): CanvasDensity {
  return useContext(CanvasDensityContext);
}

export function useCanvasRowH(): number {
  return rowHeightForDensity(useCanvasDensity());
}
