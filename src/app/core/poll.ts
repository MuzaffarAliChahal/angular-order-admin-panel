import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Polled<T> {
  value: T | null;
  error: string | null;
}

/**
 * Re-runs a request on an interval. switchMap drops a slow response when the next tick starts,
 * and errors are turned into values so one failed request doesn't stop the polling.
 */
export function poll<T>(request: () => Observable<T>, intervalMs = environment.pollMs): Observable<Polled<T>> {
  return timer(0, intervalMs).pipe(
    switchMap(() =>
      request().pipe(
        map((value): Polled<T> => ({ value, error: null })),
        catchError((e: Error) => of<Polled<T>>({ value: null, error: e.message })),
      ),
    ),
  );
}
