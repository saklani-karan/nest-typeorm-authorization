import { HttpException, HttpStatus } from "@nestjs/common";

export class InternalServerError extends HttpException {
    constructor(error: any) {
        super(
            error?.message || "Internal Server Error",
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
}
