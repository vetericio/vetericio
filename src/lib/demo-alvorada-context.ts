import { createContext, useContext } from "react";

export const DemoAlvoradaContext = createContext(false);

export function useDemoAlvorada() {
  return useContext(DemoAlvoradaContext);
}
