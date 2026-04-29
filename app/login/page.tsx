type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <form
        action="/api/login"
        method="POST"
        className="w-full max-w-sm space-y-6"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Klowi
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Accès réservé.
          </p>
        </div>

        {next && <input type="hidden" name="next" value={next} />}

        <div className="space-y-2">
          <label
            htmlFor="passcode"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Passcode
          </label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            autoFocus
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50 focus:border-zinc-950 dark:focus:border-zinc-50 focus:outline-none transition"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Passcode incorrect.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          Entrer
        </button>
      </form>
    </main>
  );
}
