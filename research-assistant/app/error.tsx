"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
