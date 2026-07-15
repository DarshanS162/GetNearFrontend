import { generateOrderNumber } from '../../domain/orderStatus';
import { mapRlsError, resolveAppUserId } from '../../infrastructure/supabase/resolveAppUserId';

/**
 * PlaceOrder use-case (application service).
 * NestJS: @Injectable() PlaceOrderService with injected repos.
 */
export class PlaceOrder {
  constructor({
    orderRepository,
    addressRepository,
    branchRepository,
    supabaseClient,
  }) {
    this.orderRepository = orderRepository;
    this.addressRepository = addressRepository;
    this.branchRepository = branchRepository;
    this.supabaseClient = supabaseClient;
  }

  /**
   * @param {object} command
   * @param {string} command.customerId
   * @param {string} command.restaurantId
   * @param {string} command.addressId
   * @param {Array<{productId:string,productName:string,foodType:string,quantity:number,unitPrice:number}>} command.items
   * @param {number} command.subtotal
   * @param {number} command.discountAmount
   * @param {number} command.deliveryCharge
   * @param {number} command.taxAmount
   * @param {number} command.grandTotal
   * @param {string} [command.customerNotes]
   * @param {'cod'} [command.paymentMethod]
   */
  async execute(command) {
    const {
      customerId,
      restaurantId,
      addressId,
      items,
      subtotal,
      discountAmount = 0,
      deliveryCharge = 0,
      taxAmount = 0,
      grandTotal,
      customerNotes = '',
      paymentMethod = 'cod',
    } = command;

    if (!customerId) throw new Error('Login required to place order');
    if (!restaurantId) throw new Error('Restaurant is required');
    if (!addressId) throw new Error('Delivery address is required');
    if (!items?.length) throw new Error('Cart is empty');
    if (paymentMethod !== 'cod') {
      throw new Error('Only cash on delivery is available right now');
    }

    try {
      const linkedCustomerId = await resolveAppUserId(this.supabaseClient);

      const address = await this.addressRepository.findById(addressId);
      if (!address || address.userId !== linkedCustomerId) {
        throw new Error('Selected address is invalid');
      }

      const branchId = await this.branchRepository.ensureMainBranchId(restaurantId);
      const orderNumber = generateOrderNumber();

      const lineItems = items.map((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        if (!item.productId || quantity < 1) {
          throw new Error('Invalid cart item');
        }
        return {
          productId: item.productId,
          productName: item.productName,
          foodType: ['veg', 'non_veg', 'egg'].includes(item.foodType)
            ? item.foodType
            : 'veg',
          quantity,
          unitPrice,
          totalPrice: Number((unitPrice * quantity).toFixed(2)),
        };
      });

      const orderRow = {
        order_number: orderNumber,
        restaurant_id: restaurantId,
        branch_id: branchId,
        customer_id: linkedCustomerId,
        address_id: addressId,
        subtotal: Number(subtotal),
        discount_amount: Number(discountAmount),
        delivery_charge: Number(deliveryCharge),
        tax_amount: Number(taxAmount),
        grand_total: Number(grandTotal),
        payment_status: 'pending',
        order_status: 'placed',
        payment_method: 'cod',
        customer_notes: customerNotes || null,
      };

      const paymentRow = {
        transaction_id: `COD-${orderNumber}`,
        provider: 'cod',
        amount: Number(grandTotal),
        currency: 'INR',
        status: 'pending',
      };

      return await this.orderRepository.createWithItems({
        orderRow,
        items: lineItems,
        paymentRow,
      });
    } catch (err) {
      throw mapRlsError(err);
    }
  }
}
