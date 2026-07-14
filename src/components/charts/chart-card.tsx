import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

export const ChartCard = forwardRef<HTMLDivElement, Props>(
  ({ title, description, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border bg-card p-5 shadow-soft", className)}
      {...rest}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  ),
);
ChartCard.displayName = "ChartCard";
