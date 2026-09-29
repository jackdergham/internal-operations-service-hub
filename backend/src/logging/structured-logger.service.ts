import { Injectable } from '@nestjs/common';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

const REDACTED = '[redacted]';
const MAX_DEPTH = 4;

// Intentionally no /g flag: a global regex would carry lastIndex between calls.
const SENSITIVE_KEY = /(api[-_ ]?key|secret|token|password|passwd|authorization|credential|private[-_ ]?key)/i;
const INLINE_SECRET = /([?&](?:key|api[-_]?key|access[-_]?token|token|secret|password)=)[^&\s"'<>]+/gi;
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi;

function redactString(value: string): string {
  return value.replace(URL_CREDENTIALS, '$1[redacted]@').replace(INLINE_SECRET, '$1[redacted]');
}

function sanitizeRecord(source: Record<string, unknown>, depth: number, seen: WeakSet<object>): LogFields {
  const sanitized: LogFields = {};

  for (const [key, value] of Object.entries(source)) {
    // Checked at every level, not just the top one: a credential is just as
    // leaked when it sits under `nested.dbPassword` as under `apiKey`.
    if (SENSITIVE_KEY.test(key)) {
      sanitized[key] = REDACTED;
      continue;
    }

    const entry = sanitizeValue(value, depth + 1, seen);
    if (entry !== undefined) sanitized[key] = entry;
  }

  return sanitized;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'function' || typeof value === 'symbol') return '[unserializable]';

  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (value instanceof Date) return value.toISOString();

  if (depth >= MAX_DEPTH) return '[max-depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, depth + 1, seen));

  return sanitizeRecord(value as Record<string, unknown>, depth, seen);
}

/**
 * Emits one JSON object per line so the output stays greppable and structured
 * in a log aggregator. Field values are sanitized before they are written:
 * keys that look like credentials are replaced wholesale, and inline secrets
 * that leak through free text (query strings, URL credentials) are masked.
 */
@Injectable()
export class StructuredLogger {
  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: LogLevel, event: string, fields: LogFields): void {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...sanitizeRecord(fields, 0, new WeakSet()),
    };
    const line = JSON.stringify(record);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}
