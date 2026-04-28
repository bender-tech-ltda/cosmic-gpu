import { isApiError } from '../lib/api-error.js';

export interface ErrorBannerProps {
  error: unknown;
  /** Render an inline (non-blocking) banner instead of the default. */
  variant?: 'inline';
}

export default function ErrorBanner({ error, variant }: ErrorBannerProps): JSX.Element | null {
  if (!error) return null;

  let message: string;
  let code: string | null = null;

  if (isApiError(error)) {
    message = error.message;
    code = error.code;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  return (
    <div
      role="alert"
      className={[
        'rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900',
        variant === 'inline' ? 'mt-2' : 'my-4',
      ].join(' ')}
    >
      {code !== null && (
        <span className="mr-2 inline-block rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide text-red-800">
          {code}
        </span>
      )}
      {message}
    </div>
  );
}
