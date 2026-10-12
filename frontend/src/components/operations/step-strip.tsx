import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Import products", description: "Upload MOP spreadsheet" },
  { title: "Run price check", description: "Scrape a marketplace" },
  { title: "Monitor results", description: "Live progress & counts" },
];

/** Orienting 3-step strip. Purely visual — doesn't track real progress. */
export function StepStrip({ activeStep = 1 }: { activeStep?: number }) {
  return (
    <div className="mb-6 flex items-center">
      {STEPS.map((step, idx) => {
        const stepNumber = idx + 1;
        const isDone = stepNumber < activeStep;
        const isActive = stepNumber === activeStep;
        return (
          <div key={step.title} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isActive && !isDone && "border-primary text-primary",
                  !isActive && !isDone && "border-border text-muted-foreground"
                )}
              >
                {isDone ? <Check className="size-4" /> : stepNumber}
              </div>
              <div className="hidden sm:block">
                <p className={cn("text-sm font-medium", !isActive && !isDone && "text-muted-foreground")}>{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {stepNumber < STEPS.length && <div className="mx-3 h-px flex-1 bg-border sm:mx-4" />}
          </div>
        );
      })}
    </div>
  );
}
