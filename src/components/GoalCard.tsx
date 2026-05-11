import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface GoalCardProps {
  goal: {
    id: string;
    habit: string;
    icon: string;
    goalText?: string;
    goal?: string;
    progress: number;
    target: number;
    unit: string;
    status?: string;
    type?: string;
  };
  onLog: () => void;
}

const GoalCard = ({ goal, onLog }: GoalCardProps) => {
  const percentage = Math.min(goal.progress / goal.target * 100, 100);
  const isComplete = percentage >= 100;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={`rounded-2xl border p-4 transition-colors ${
      isComplete ?
      "border-primary/20 bg-accent" :
      "border-border bg-card"}`
      }>
      
      <div className="flex items-start justify-between">
        
        {isComplete &&
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </span>
        }
      </div>
      <p className="mt-3 text-sm font-semibold">{goal.habit}</p>
      <p className="text-xs text-muted-foreground">{goal.goalText || goal.goal}</p>
      {goal.type &&
      <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[9px] font-medium text-secondary-foreground">
          {goal.type}
        </span>
      }
      <div className="mt-3">
        <div className="h-1 w-full rounded-full bg-secondary">
          <div
            className="h-1 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percentage}%` }} />
          
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {goal.progress}/{goal.target} {goal.unit}
        </p>
      </div>
      {!isComplete &&
      <button
        onClick={onLog}
        className="mt-3 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
        
          Log
        </button>
      }
    </motion.div>);

};

export default GoalCard;