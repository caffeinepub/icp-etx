import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export default function Chat() {
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground">Chat</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-powered trading assistant
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-card border-border shadow-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles size={18} className="text-secondary" />
              AI Trading Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-col items-center justify-center py-16 gap-4 rounded-lg border border-dashed border-secondary/20 bg-secondary/5"
              data-ocid="chat.coming-soon.panel"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-secondary/20 blur-xl rounded-full" />
                <MessageSquare className="relative text-secondary" size={40} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">
                  Your AI trading assistant is coming soon
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Get trade recommendations, market insights, and automated
                  strategy suggestions from your personal AI.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
