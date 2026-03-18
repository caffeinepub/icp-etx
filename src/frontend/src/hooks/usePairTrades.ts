import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type PairTrade, RiskTier } from "../backend";
import { useActor } from "./useActor";

export type { PairTrade };
export { RiskTier };

export function usePairTrades() {
  const { actor, isFetching } = useActor();
  return useQuery<PairTrade[]>({
    queryKey: ["pairTrades"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPairTrades();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePairTrade(id: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<PairTrade | null>({
    queryKey: ["pairTrade", id.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPairTrade(id);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreatePairTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      tokenAAddress: string;
      tokenASymbol: string;
      tokenBAddress: string;
      tokenBSymbol: string;
      allocationUsd: number;
      riskTier: RiskTier;
      routeViaICP: boolean;
      notes: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createPairTrade(
        params.tokenAAddress,
        params.tokenASymbol,
        params.tokenBAddress,
        params.tokenBSymbol,
        params.allocationUsd,
        params.riskTier,
        params.routeViaICP,
        params.notes,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pairTrades"] });
    },
  });
}

export function useUpdatePairTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      allocationUsd: number;
      riskTier: RiskTier;
      notes: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updatePairTrade(
        params.id,
        params.allocationUsd,
        params.riskTier,
        params.notes,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pairTrades"] });
      queryClient.invalidateQueries({
        queryKey: ["pairTrade", variables.id.toString()],
      });
    },
  });
}

export function useDeletePairTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deletePairTrade(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pairTrades"] });
    },
  });
}
