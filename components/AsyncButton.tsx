"use client";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AsyncButtonProps = {
  onClick: () => Promise<unknown>;
  children: React.ReactNode;
  busyText?: string;
} & Omit<React.ComponentProps<typeof Button>, "onClick">;

export function AsyncButton({
  onClick,
  children,
  busyText = "Procesando…",
  disabled,
  ...props
}: AsyncButtonProps) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      disabled={disabled || loading}
      {...props}
      onClick={async () => {
        try {
          setLoading(true);
          await onClick();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? busyText : children}
    </Button>
  );
}
