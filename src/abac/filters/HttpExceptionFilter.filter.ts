import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
} from "@nestjs/common";
import { HttpArgumentsHost } from "@nestjs/common/interfaces";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();

        response.status(exception.getStatus()).json({
            name: exception.name,
            message: exception.message,
            cause: exception.cause,
            statusCode: exception.getStatus(),
            timestamp: new Date().toISOString(),
            url: request.url,
        });
    }
}
