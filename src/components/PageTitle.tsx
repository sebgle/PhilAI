// Every page starts the same way: a title and maybe a line under it.
export function PageTitle({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h1 className="text-[2rem] font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
