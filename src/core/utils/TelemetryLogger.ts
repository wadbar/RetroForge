import * as fs from 'fs';
import * as path from 'path';
import { Console } from 'console';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface TelemetryEvent {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: Record<string, any>;
  pid: number;
}

/**
 * High-performance, non-blocking telemetry logger.
 * Optimized for V8 and WSL2 environments.
 */
export class TelemetryLogger {
  private static instance: TelemetryLogger;
  private readonly stream: fs.WriteStream;
  private readonly consoleLogger: Console;
  private isShuttingDown: boolean = false;

  private constructor(logFilePath: string) {
    // Ensure directory exists
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.stream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
    this.consoleLogger = new Console({ stdout: process.stdout, stderr: process.stderr });
    
    this.bindProcessHandlers();
  }

  public static getInstance(): TelemetryLogger {
    if (!TelemetryLogger.instance) {
      TelemetryLogger.instance = new TelemetryLogger(path.join(process.cwd(), 'logs', 'telemetry.log'));
    }
    return TelemetryLogger.instance;
  }

  public log(level: LogLevel, context: string, message: string, metadata?: Record<string, any>): void {
    if (this.isShuttingDown) return;

    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(metadata && { metadata }),
      pid: process.pid
    };

    const payload = JSON.stringify(event);

    // Write to stream
    this.stream.write(payload + '\n', (error) => {
      if (error) {
        this.consoleLogger.error(`[CRITICAL] Telemetry stream write failure: ${error.message}`);
      }
    });

    // Console output based on level
    if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
      this.consoleLogger.error(payload);
    } else if (level === LogLevel.WARN) {
      this.consoleLogger.warn(payload);
    } else {
      this.consoleLogger.log(payload);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    return new Promise((resolve) => {
      this.log(LogLevel.INFO, 'TelemetryLogger', 'Initiating graceful shutdown of telemetry streams.');
      this.stream.end(() => {
        resolve();
      });
    });
  }

  private bindProcessHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      this.log(LogLevel.CRITICAL, 'Process', 'Uncaught Exception detected', { 
        name: error.name,
        message: error.message,
        stack: error.stack 
      });
    });

    process.on('unhandledRejection', (reason: any) => {
      this.log(LogLevel.CRITICAL, 'Process', 'Unhandled Promise Rejection detected', { 
        reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason
      });
    });

    process.on('SIGINT', () => this.handleSignal('SIGINT'));
    process.on('SIGTERM', () => this.handleSignal('SIGTERM'));
  }

  private async handleSignal(signal: string): Promise<void> {
    this.log(LogLevel.WARN, 'Process', `Received termination signal: ${signal}`);
    await this.shutdown();
    process.exit(0);
  }
}

export const logger = TelemetryLogger.getInstance();
