export class Trading212Error extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "Trading212Error";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function getActionableSuggestion(error: unknown): string {
  const message = formatError(error);

  if (message.includes("Authentication")) {
    return "Check your API_KEY and SECRET in the .env file.";
  }
  if (message.includes("not found")) {
    return "Verify the instrument ticker or order ID is correct.";
  }
  if (message.includes("Rate limit")) {
    return "Wait before retrying and reduce request frequency.";
  }
  if (message.includes("Bad request")) {
    return "Check order parameters: quantity must be positive, prices must be valid.";
  }

  return "Review the API documentation for required parameters.";
}
