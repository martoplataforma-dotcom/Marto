import type { HTMLAttributes } from "react";

type BadgeVariant =
  | "pending"
  | "paid"
  | "in_progress"
  | "completed"
  | "error";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  pending: "bg-black/5 text-foreground",
  paid: "bg-success text-white",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-success text-white",
  error: "bg-danger text-white",
};

export function Badge({
  variant,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
