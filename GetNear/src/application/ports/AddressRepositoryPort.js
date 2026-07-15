/**
 * Port (interface) for address persistence.
 * NestJS: implement as AddressRepository injectable.
 *
 * @typedef {object} AddressRepositoryPort
 * @property {(userId: string) => Promise<import('../../domain/address').mapAddress extends Function ? any : never[]>} listByUserId
 * @property {(id: string) => Promise<any>} findById
 * @property {(userId: string, input: object) => Promise<any>} create
 * @property {(userId: string, addressId: string, input: object) => Promise<any>} update
 * @property {(userId: string, addressId: string) => Promise<void>} softDelete
 * @property {(userId: string, addressId: string) => Promise<any>} setDefault
 */

export {};
