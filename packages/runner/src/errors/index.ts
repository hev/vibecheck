export class VibeCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VibeCheckError';
  }
}

export class AuthenticationError extends VibeCheckError {
  constructor(message: string = 'Authentication failed: Invalid API key. Get your API key at https://vibescheck.io') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends VibeCheckError {
  constructor(message: string = 'Network error: Unable to connect to vibecheck API') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends VibeCheckError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class EvaluationError extends VibeCheckError {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}
