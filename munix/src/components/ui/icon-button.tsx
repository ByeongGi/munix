import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";

import { cn } from "@/lib/cn";
import { iconButton } from "@/lib/ui-variants";

interface IconButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButton> {
  asChild?: boolean;
  icon: ReactNode;
  label: string;
}

export function IconButton({
  asChild = false,
  icon,
  label,
  size,
  active,
  className,
  type = "button",
  title,
  "aria-label": ariaLabel,
  children,
  ...props
}: IconButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      type={asChild ? undefined : type}
      title={title ?? label}
      aria-label={ariaLabel ?? label}
      className={cn(iconButton({ size, active }), className)}
      {...props}
    >
      {icon}
      {children}
    </Comp>
  );
}
