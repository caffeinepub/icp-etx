import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";
import { motion } from "motion/react";

export default function SwapHistory() {
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground">Swap History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All executed trades and swaps
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        data-ocid="swap-history.empty_state"
      >
        <Card className="bg-card border-border shadow-card-glow">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 border border-border flex items-center justify-center">
              <History className="text-muted-foreground" size={28} />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground mb-1">
                No swaps executed yet
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your swap history will appear here once you execute your first
                trade.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
