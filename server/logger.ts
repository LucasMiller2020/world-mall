export type StructuredLogLevel = 'info' | 'warn' | 'error';

interface StructuredLogPayload {
  [key: string]: unknown;
}

function serializeValue(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

export function logStructuredEvent(
  event: string,
  payload: StructuredLogPayload = {},
  level: StructuredLogLevel = 'info',
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  console.log(JSON.stringify(entry, serializeValue));
}
