/**
 * LoggerService - Professional logging with severity levels.
 * Ensures consistent observability across the application.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

class LoggerService {
  private isProd = process.env.NODE_ENV === 'production';

  public debug(message: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  public info(message: string, ...args: any[]) {
    this.log(LogLevel.INFO, message, ...args);
  }

  public warn(message: string, ...args: any[]) {
    this.log(LogLevel.WARN, message, ...args);
  }

  public error(message: string, ...args: any[]) {
    this.log(LogLevel.ERROR, message, ...args);
  }

  public fatal(message: string, ...args: any[]) {
    this.log(LogLevel.FATAL, message, ...args);
    // In a professional environment, this could trigger on-call alerts
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (this.isProd && level === LogLevel.DEBUG) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage, ...args);
        break;
    }
  }
}

export const logger = new LoggerService();
