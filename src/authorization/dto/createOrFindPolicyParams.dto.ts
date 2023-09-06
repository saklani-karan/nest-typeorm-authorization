import { Policy as SqlPolicy } from "../entities/sql";
import { Policy as MongoPolicy } from "../entities/mongodb";

export class CreateOrFindPolicyParams<IPolicy extends SqlPolicy | MongoPolicy> {
    resource: IPolicy["resource"];
    action: IPolicy["action"];
}
