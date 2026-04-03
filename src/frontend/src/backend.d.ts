import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserPublic {
    id: Principal;
    name: string;
    createdAt: bigint;
    role: Role;
    assignedBusinessIds: Array<string>;
}
export enum Role {
    admin = "admin",
    supplier = "supplier",
    staff = "staff"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserRole(): Promise<UserRole>;
    getCurrentUser(): Promise<UserPublic>;
    isCallerAdmin(): Promise<boolean>;
}
