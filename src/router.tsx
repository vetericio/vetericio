import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./tutores-compact.css";
import "./agenda-actions.css";
import "./lib/agenda-livre-option";
import "./lib/promotional-codes-ui";
import "./lib/checkout-promo-location";

export const getRouter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 300_000, retry: 1, refetchOnWindowFocus: false } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 80,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
