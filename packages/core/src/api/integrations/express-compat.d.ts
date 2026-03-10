declare module 'express' {
  export interface Request {
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    path?: string;
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    once(event: string | symbol, listener: (...args: unknown[]) => void): this;
    off(event: string | symbol, listener: (...args: unknown[]) => void): this;
  }

  export interface Response {
    statusCode: number;
    on(event: string | symbol, listener: (...args: unknown[]) => void): this;
    once(event: string | symbol, listener: (...args: unknown[]) => void): this;
    off(event: string | symbol, listener: (...args: unknown[]) => void): this;
  }

  export type NextFunction = (err?: unknown) => void;

  export interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): void;
  }
}
