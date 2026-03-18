import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAddFundingEntry,
  useAvailableICPBalance,
  useFundingEntries,
  useTotalFundedICP,
} from "@/hooks/useQueries";
import { Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { FundingEntryType } from "../backend";

function StatCard({
  label,
  value,
  isLoading,
  colorClass,
  icon: Icon,
  ocid,
}: {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  colorClass: string;
  icon: React.ElementType;
  ocid: string;
}) {
  return (
    <Card className="bg-card border-border flex-1" data-ocid={ocid}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} className={colorClass} />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {label}
          </span>
        </div>
        {isLoading ? (
          <div className="h-7 w-24 rounded bg-muted animate-pulse" />
        ) : (
          <p className={`text-xl font-bold font-mono ${colorClass}`}>
            {(value ?? 0).toFixed(2)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ICP
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Funding() {
  const { data: fundingEntries, isLoading: entriesLoading } =
    useFundingEntries();
  const { data: totalFunded, isLoading: totalLoading } = useTotalFundedICP();
  const { data: availableBalance, isLoading: balanceLoading } =
    useAvailableICPBalance();
  const addEntry = useAddFundingEntry();

  const [entryType, setEntryType] = useState<string>("deposit");
  const [amountICP, setAmountICP] = useState("");
  const [note, setNote] = useState("");

  const swappedAway =
    totalFunded !== undefined && availableBalance !== undefined
      ? Math.max(0, totalFunded - availableBalance)
      : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(amountICP);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid ICP amount");
      return;
    }
    const type: FundingEntryType =
      entryType === "stakingReward"
        ? FundingEntryType.stakingReward
        : FundingEntryType.deposit;
    addEntry.mutate(
      { entryType: type, amountICP: amount, note: note.trim() },
      {
        onSuccess: () => {
          toast.success("Entry added");
          setAmountICP("");
          setNote("");
          setEntryType("deposit");
        },
        onError: () => toast.error("Failed to add entry"),
      },
    );
  };

  const sorted = [...(fundingEntries ?? [])].sort(
    (a, b) => Number(b.timestamp) - Number(a.timestamp),
  );

  const formatDate = (ts: bigint) => {
    const ms = Number(ts) / 1_000_000;
    return new Date(ms).toLocaleString();
  };

  const formatType = (type: FundingEntryType) => {
    if (type === FundingEntryType.stakingReward) return "Staking Reward";
    return "Deposit";
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground">Funding</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track deposits and staking rewards
        </p>
      </motion.div>

      {/* Summary Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        <StatCard
          label="Total Funded"
          value={totalFunded}
          isLoading={totalLoading}
          colorClass="text-cyan-400"
          icon={TrendingUp}
          ocid="funding.total_funded.card"
        />
        <StatCard
          label="Total Swapped Away"
          value={swappedAway}
          isLoading={totalLoading || balanceLoading}
          colorClass="text-red-400"
          icon={TrendingDown}
          ocid="funding.swapped_away.card"
        />
        <StatCard
          label="Available ICP Balance"
          value={availableBalance}
          isLoading={balanceLoading}
          colorClass="text-green-400"
          icon={Wallet}
          ocid="funding.available_balance.card"
        />
      </motion.div>

      {/* Entry Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6"
      >
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              Add Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="entry-type"
                    className="text-sm text-muted-foreground"
                  >
                    Type
                  </Label>
                  <Select value={entryType} onValueChange={setEntryType}>
                    <SelectTrigger
                      id="entry-type"
                      className="bg-background border-border"
                      data-ocid="funding.type.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="stakingReward">
                        Staking Reward
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="amount"
                    className="text-sm text-muted-foreground"
                  >
                    Amount ICP
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amountICP}
                    onChange={(e) => setAmountICP(e.target.value)}
                    className="bg-background border-border"
                    data-ocid="funding.amount.input"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="note"
                    className="text-sm text-muted-foreground"
                  >
                    Note{" "}
                    <span className="text-muted-foreground/50">(optional)</span>
                  </Label>
                  <Input
                    id="note"
                    type="text"
                    placeholder="e.g. NNS staking reward"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-background border-border"
                    data-ocid="funding.note.input"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={addEntry.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-ocid="funding.add_entry.submit_button"
                >
                  {addEntry.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {addEntry.isPending ? "Adding..." : "Add Entry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* History Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              Funding History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entriesLoading ? (
              <div
                className="flex items-center justify-center py-12"
                data-ocid="funding.history.loading_state"
              >
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-center px-4"
                data-ocid="funding.history.empty_state"
              >
                <Wallet size={32} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No entries yet. Add a deposit or staking reward above.
                </p>
              </div>
            ) : (
              <Table data-ocid="funding.history.table">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs pl-6">
                      Type
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Amount (ICP)
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Note
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs pr-6">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((entry, idx) => (
                    <TableRow
                      key={String(entry.id)}
                      className="border-border hover:bg-accent/5"
                      data-ocid={`funding.history.item.${idx + 1}`}
                    >
                      <TableCell className="pl-6">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            entry.entryType === FundingEntryType.stakingReward
                              ? "bg-purple-500/15 text-purple-400"
                              : "bg-cyan-500/15 text-cyan-400"
                          }`}
                        >
                          {formatType(entry.entryType)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        {entry.amountICP.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {entry.note || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground pr-6">
                        {formatDate(entry.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
