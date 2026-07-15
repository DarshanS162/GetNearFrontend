/**
 * Composition root / DI container.
 * NestJS equivalent: module providers wiring repositories → use-cases.
 */
import { supabase } from '../lib/supabase';
import { SupabaseAddressRepository } from '../infrastructure/supabase/SupabaseAddressRepository';
import { SupabaseBranchRepository } from '../infrastructure/supabase/SupabaseBranchRepository';
import { SupabaseOrderRepository } from '../infrastructure/supabase/SupabaseOrderRepository';
import { ListAddresses } from './use-cases/ListAddresses';
import { CreateAddress } from './use-cases/CreateAddress';
import { UpdateAddress } from './use-cases/UpdateAddress';
import { DeleteAddress } from './use-cases/DeleteAddress';
import { SetDefaultAddress } from './use-cases/SetDefaultAddress';
import { PlaceOrder } from './use-cases/PlaceOrder';
import { GetOrder } from './use-cases/GetOrder';
import { ListCustomerOrders } from './use-cases/ListCustomerOrders';
import { ListRestaurantOrders } from './use-cases/ListRestaurantOrders';
import { UpdateOrderStatus } from './use-cases/UpdateOrderStatus';

const addressRepository = new SupabaseAddressRepository(supabase);
const branchRepository = new SupabaseBranchRepository(supabase);
const orderRepository = new SupabaseOrderRepository(supabase);

const deps = {
  addressRepository,
  branchRepository,
  orderRepository,
  supabaseClient: supabase,
};

export const addressUseCases = {
  list: new ListAddresses(deps),
  create: new CreateAddress(deps),
  update: new UpdateAddress(deps),
  remove: new DeleteAddress(deps),
  setDefault: new SetDefaultAddress(deps),
};

export const orderUseCases = {
  place: new PlaceOrder(deps),
  get: new GetOrder(deps),
  listForCustomer: new ListCustomerOrders(deps),
  listForRestaurant: new ListRestaurantOrders(deps),
  updateStatus: new UpdateOrderStatus(deps),
};
