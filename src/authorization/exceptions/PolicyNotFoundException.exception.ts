import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy as SqlPolicy } from "../entities/sql";
import { Policy as MongoPolicy } from "../entities/mongodb";

export class PolicyNotFoundException<
    IPolicy extends SqlPolicy | MongoPolicy
> extends HttpException {
    constructor({ policyId }: { policyId: IPolicy["id"] }) {
        super(
            `policy with policyId=${policyId} does not exist`,
            HttpStatus.NOT_FOUND
        );
    }
}
