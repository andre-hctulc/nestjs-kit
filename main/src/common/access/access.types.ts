import { ApiAccess } from "./api-access.class.js";

export type ApiAccessConstructor<T = ApiAccess> = abstract new (...args: any) => T;
