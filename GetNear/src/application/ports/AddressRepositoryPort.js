/**
 * Port (interface) for address persistence.
 * NestJS: implement as AddressRepository injectable.
 *
 * Geo is stored as PostGIS geography(Point,4326). Clients pass lat/lng;
 * the adapter / RPC writes `location`. Never persist separate lat/lng columns.
 *
 * @typedef {object} AddressRepositoryPort
 * @property {(userId: string) => Promise<object[]>} listByUserId
 * @property {(id: string) => Promise<object|null>} findById
 * @property {(userId: string, input: object) => Promise<object>} create
 * @property {(userId: string, addressId: string, input: object) => Promise<object>} update
 * @property {(userId: string, addressId: string) => Promise<void>} softDelete
 * @property {(userId: string, addressId: string) => Promise<object>} setDefault
 * @property {(addressId: string, branchId: string) => Promise<object>} validateDelivery
 */

export {};
