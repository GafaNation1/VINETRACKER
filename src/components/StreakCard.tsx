interface StreakCardProps {
  streak: {
    habit: string;
    current: number;
    longest: number;
    icon: string;
  };
}

const StreakCard = ({ streak }: StreakCardProps) => {
  return (
    <div className="flex-shrink-0 rounded-2xl border border-border bg-card p-4 min-w-[130px]">
      <span className="text-xl">{streak.icon}</span>
      <div className="mt-2">
        <span className="text-2xl font-bold tracking-tight text-primary">{streak.current}</span>
        <span className="ml-1 text-xs text-muted-foreground">days</span>
      </div>
      <p className="mt-0.5 text-xs font-medium text-foreground">{streak.habit}</p>
      <p className="text-[10px] text-muted-foreground">Best: {streak.longest}</p>
    </div>
  );
};

export default StreakCard;
