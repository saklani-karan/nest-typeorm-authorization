import { ConsoleLogger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Console } from "console";

export class Logger extends Console {
    prefix: string;
    constructor(prefix: string) {
        super(process.stdout);
        this.prefix = prefix;
    }

    createForMethod(methodName: string): Logger {
        return new Logger(`${this.prefix} [${methodName}]:`);
    }

    log(message?: any, ...optionalParams: any[]): void {
        super.log(`${this.prefix}: ${message}`, ...optionalParams);
    }

    error(message?: any, error?: Error, ...optionalParams: any[]): void {
        super.error(
            `${this.prefix}: ${message} with error ${JSON.stringify({
                message: error?.message,
                stack: error?.stack,
            })}`,
            ...optionalParams
        );
    }
}
