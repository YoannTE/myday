"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // AEVIO One : AUCUN vert — le succès reprend l'accent bleu (soft/accent).
          success:
            "group-[.toaster]:!bg-soft group-[.toaster]:!text-accent group-[.toaster]:!border-accent/20",
          error:
            "group-[.toaster]:!bg-background group-[.toaster]:!text-ink group-[.toaster]:!border-border",
          info: "group-[.toaster]:!bg-soft group-[.toaster]:!text-accent group-[.toaster]:!border-accent/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
