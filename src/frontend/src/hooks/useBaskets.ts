import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Basket, BasketSlot } from "../backend";
import { useActor } from "./useActor";

export type { Basket, BasketSlot };

export function useBaskets() {
  const { actor, isFetching } = useActor();
  return useQuery<Basket[]>({
    queryKey: ["baskets"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getBaskets();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useBasket(id: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<Basket | null>({
    queryKey: ["basket", id.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getBasket(id);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateBasket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      description: string;
      slots: BasketSlot[];
      rebalanceThresholdBps: bigint;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.createBasket(
        params.name,
        params.description,
        params.slots,
        params.rebalanceThresholdBps,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["baskets"] });
    },
  });
}

export function useUpdateBasket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      name: string;
      description: string;
      slots: BasketSlot[];
      rebalanceThresholdBps: bigint;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.updateBasket(
        params.id,
        params.name,
        params.description,
        params.slots,
        params.rebalanceThresholdBps,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["baskets"] });
      queryClient.invalidateQueries({
        queryKey: ["basket", variables.id.toString()],
      });
    },
  });
}

export function useDeleteBasket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteBasket(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["baskets"] });
    },
  });
}

export function useValidateBasketSlots() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (slots: BasketSlot[]) => {
      if (!actor) throw new Error("Actor not available");
      return actor.validateBasketSlots(slots);
    },
  });
}
