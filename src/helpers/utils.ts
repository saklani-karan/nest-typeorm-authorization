import { Policy as SqlPolicy } from "../authorization/entities/sql";
import { Policy as MongoPolicy } from "../authorization/entities/mongodb";

export const convertPolicyToPolicyMapKey = <
    IPolicy extends SqlPolicy | MongoPolicy
>(
    policy: Pick<IPolicy, "action" | "resource">
) => {
    const { resource, action } = policy;
    return `$${resource}$${action}`;
};
