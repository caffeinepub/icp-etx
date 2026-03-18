import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import Layout from "./components/Layout";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import Analysis from "./pages/Analysis";
import BasketDetail from "./pages/BasketDetail";
import Baskets from "./pages/Baskets";
import Chat from "./pages/Chat";
import CreateBasket from "./pages/CreateBasket";
import CreatePairTrade from "./pages/CreatePairTrade";
import Dashboard from "./pages/Dashboard";
import EditBasket from "./pages/EditBasket";
import Funding from "./pages/Funding";
import LandingPage from "./pages/LandingPage";
import Onboarding from "./pages/Onboarding";
import PairTradeDetail from "./pages/PairTradeDetail";
import PairTrades from "./pages/PairTrades";
import Risk from "./pages/Risk";
import SwapHistory from "./pages/SwapHistory";
import Wallet from "./pages/Wallet";

function AuthGuard() {
  const { identity, isInitializing } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const navigate = useNavigate();

  useEffect(() => {
    if (!identity || isFetching || !actor) return;
    const pending = sessionStorage.getItem("pending_auth_check");
    if (!pending) return;
    sessionStorage.removeItem("pending_auth_check");
    actor
      .isOwner()
      .then((isOwner) => {
        navigate({ to: isOwner ? "/" : "/onboarding", replace: true });
      })
      .catch(() => {
        navigate({ to: "/onboarding", replace: true });
      });
  }, [identity, isFetching, actor, navigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!identity) {
    return <LandingPage />;
  }

  return <Outlet />;
}

// Route tree
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster theme="dark" />
    </>
  ),
});

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth-layout",
  component: AuthGuard,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  id: "app-layout",
  component: Layout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: Dashboard,
});

const fundingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/funding",
  component: Funding,
});

const pairTradesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/pair-trades",
  component: PairTrades,
});

const createPairTradeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/pair-trades/new",
  component: CreatePairTrade,
});

const pairTradeDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/pair-trades/$id",
  component: PairTradeDetail,
});

const basketsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/baskets",
  component: Baskets,
});

const createBasketRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/baskets/new",
  component: CreateBasket,
});

const basketDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/baskets/$id",
  component: BasketDetail,
});

const editBasketRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/baskets/$id/edit",
  component: EditBasket,
});

const walletRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/wallet",
  component: Wallet,
});

const chatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/chat",
  component: Chat,
});

const swapHistoryRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/swap-history",
  component: SwapHistory,
});

const riskRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/risk",
  component: Risk,
});

const analysisRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/analysis",
  component: Analysis,
});

const onboardingRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/onboarding",
  component: Onboarding,
});

const catchAllRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "*",
  component: Dashboard,
});

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([
    appLayoutRoute.addChildren([
      dashboardRoute,
      fundingRoute,
      pairTradesRoute,
      createPairTradeRoute,
      pairTradeDetailRoute,
      basketsRoute,
      createBasketRoute,
      basketDetailRoute,
      editBasketRoute,
      walletRoute,
      chatRoute,
      swapHistoryRoute,
      riskRoute,
      analysisRoute,
      catchAllRoute,
    ]),
    onboardingRoute,
  ]),
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
