import Link from "next/link";

type HistorialEmptyStateProps = {
  title: string;
  description: string;
  showAction?: boolean;
};

export function HistorialEmptyState({
  title,
  description,
  showAction = false,
}: HistorialEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl"></div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <p className="max-w-md text-md text-sm text-slate-500">{description}</p>
      </div>
      {showAction ? (
        <Link
          href="/pedidos/nuevo"
          className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
        >
          Crear nuevo pedido
        </Link>
      ) : null}
    </div>
  );
}
