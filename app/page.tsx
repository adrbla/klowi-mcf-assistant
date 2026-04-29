export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Klowi
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            MCF Coach
          </h1>
        </div>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
          Assistante de préparation aux auditions de Maître de Conférences en études
          britanniques. Préparée pour Chloë.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Squelette en place. Le chat sera branché à la prochaine étape.
        </p>
      </div>
    </main>
  );
}
