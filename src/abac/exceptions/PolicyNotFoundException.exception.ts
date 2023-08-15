import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy } from "../entities/postgres/policy.entity";

export class PolicyNotFoundException extends HttpException {
    constructor({ policyId }: { policyId: Policy["id"] }) {
        super(
            `policy with policyId=${policyId} does not exist`,
            HttpStatus.NOT_FOUND
        );
    }
}
