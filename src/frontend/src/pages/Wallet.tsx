import SwapExecutionDialog from "@/components/SwapExecutionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActor } from "@/hooks/useActor";
import { useHoldings } from "@/hooks/useQueries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Wallet as WalletIcon, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export default function Wallet() {
  const { data: holdings, isLoading } = useHoldings();
  const [swapOpen, setSwapOpen] = useState(false);
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const revokePermission = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return (actor as any).revokeTradingPermission();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tradingPermission"] });
    },
  });

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        {/* Header row: title + actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your token holdings from executed swaps
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Revoke Permissions quick link */}
            <button
              type="button"
              onClick={() => revokePermission.mutate()}
              disabled={revokePermission.isPending}
              className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50"
              data-ocid="wallet.secondary_button"
            >
              {revokePermission.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              Revoke Permissions
            </button>

            {/* New Swap button */}
            <Button
              onClick={() => setSwapOpen(true)}
              className="bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 font-semibold px-4 py-2 h-auto text-sm shadow-[0_0_12px_rgba(0,245,255,0.15)] hover:shadow-[0_0_20px_rgba(0,245,255,0.25)] transition-all duration-200"
              data-ocid="wallet.primary_button"
            >
              <Zap size={14} className="mr-1.5" />
              New Swap
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletIcon size={18} className="text-success" />
              Holdings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !holdings || holdings.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 gap-4 rounded-b-lg border-t border-dashed border-success/20 bg-success/5"
                data-ocid="wallet.empty_state"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-success/20 blur-xl rounded-full" />
                  <WalletIcon className="relative text-success" size={36} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground mb-1">
                    No holdings yet
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Execute a swap to see your token balances here.
                  </p>
                </div>
                <Button
                  onClick={() => setSwapOpen(true)}
                  className="bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 text-xs px-4 py-1.5 h-auto"
                  data-ocid="wallet.secondary_button"
                >
                  <Zap size={12} className="mr-1" />
                  Make your first swap
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs pl-6">
                      Symbol
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Balance
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs pr-6">
                      Cost Basis
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h, idx) => (
                    <TableRow
                      key={h.tokenCanisterId}
                      className="border-border hover:bg-accent/5"
                      data-ocid={`wallet.item.${idx + 1}`}
                    >
                      <TableCell className="pl-6">
                        <span className="text-sm font-semibold text-cyan-400">
                          {h.symbol}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        {h.balance.toFixed(4)}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground pr-6">
                        {h.costBasis.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Swap dialog — controlled by swapOpen state, no pre-filled tokens */}
      <AnimatePresence>
        {swapOpen && (
          <SwapExecutionDialog
            open={swapOpen}
            onClose={() => setSwapOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
