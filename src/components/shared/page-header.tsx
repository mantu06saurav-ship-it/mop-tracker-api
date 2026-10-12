import { ThemeToggle } from "@/components/shared/theme-toggle";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">MOP Tracker <span className="mx-1 text-border">/</span> Workspace</p>
        <h1 className="mt-1.5 text-[1.5rem] font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-[1.65rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {actions}
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
