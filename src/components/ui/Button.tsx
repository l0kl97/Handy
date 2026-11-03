import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "outline"
    | "warning"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "font-medium rounded-[8px] border focus:outline-none transition-[background-color,border-color,color,opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer";

  // Monochrome first (Profound): the primary action is solid ink — white on
  // dark, near-black on light. The accent is reserved for state, not buttons.
  const variantClasses = {
    primary: "text-background bg-text border-text hover:opacity-90",
    "primary-soft":
      "text-text bg-accent/12 border-transparent hover:bg-accent/18",
    secondary:
      "text-text bg-surface-2 border-line hover:bg-wash hover:border-line-strong",
    // For screens where secondary's grey fill reads as disabled (onboarding)
    outline:
      "text-text bg-transparent border-line-strong hover:bg-wash hover:border-ink-3",
    // Secondary's neutral resting look, but hover/focus use the semantic
    // --color-warning token — for buttons on warning surfaces like
    // SecureInputWarning
    warning:
      "text-text bg-surface-2 border-line hover:bg-warning-wash hover:border-warning",
    danger: "text-on-error bg-error border-error hover:opacity-90",
    "danger-ghost":
      "text-error border-transparent hover:bg-error-wash focus:bg-error-wash",
    ghost: "text-current border-transparent hover:bg-wash focus:bg-wash",
  };

  const sizeClasses = {
    sm: "px-2.5 h-7 text-xs",
    md: "px-3.5 h-8 text-[13px]",
    lg: "px-4 h-9 text-sm",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
