import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./tutores-compact.css";
import "./agenda-actions.css";
import "./lib/agenda-livre-option";
import "./lib/promotional-codes-ui";
import "./lib/checkout-promo-location";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
