import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type PageContainerProps = HTMLAttributes<HTMLDivElement>;

export function PageContainer({
  children,
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
