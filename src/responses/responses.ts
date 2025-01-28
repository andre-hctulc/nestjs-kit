interface Accepted {
    /**
     * _true_ if the operation was successful, _false_ otherwise.
     * For most cases, this is always _true_.
     */
    accepted: boolean;
}

export interface CreatedResBody extends Accepted {
    /**
     * The ids of the created resource.s Can be empty if no ids are available.
     */
    created_id: string | string[];
}

export interface UpdatedResBody extends Accepted {
    /**
     * The ids of the updated resources. Can be empty if no id is available.
     */
    updated_id: string | string[];
}

export interface AcceptedResBody extends Accepted {}

export interface ResultResBody<T = any> extends Accepted {
    /**
     * Result of the operation
     */
    result: T;
}

export function createdBody(created_id: string | string[], accepted = true): CreatedResBody {
    return { created_id, accepted };
}

export function acceptedBody(accepted = true): AcceptedResBody {
    return { accepted };
}

export function resultBody<T>(result: T, accepted = true): ResultResBody<T> {
    return { result, accepted };
}
