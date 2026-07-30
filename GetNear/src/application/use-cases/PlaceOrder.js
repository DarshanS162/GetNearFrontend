import { generateOrderNumber } from '../../domain/orderStatus';
import { mapRlsError, resolveAppUserId } from '../../infrastructure/supabase/resolveAppUserId';

/**
 * PlaceOrder use-case (application service).
 * Frontend sends addressId + cart lines; server validates store, radius,
 * and recomputes delivery/tax from business settings when available.
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

  async execute(command) {
    const {
      customerId,
      restaurantId,
      addressId,
      items,
      subtotal,
      discountAmount = 0,
      deliveryCharge = 0,
      deliveryDiscount = 0,
      taxAmount = 0,
      grandTotal,
      customerNotes = '',
      paymentMethod = 'cod',
      couponCode = '',
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

      const { data: restaurant, error: restaurantError } = await this.supabaseClient
        .from('restaurants')
        .select('id, business_status, is_active')
        .eq('id', restaurantId)
        .is('deleted_at', null)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant || restaurant.business_status !== 'active') {
        throw new Error('This store is not available');
      }
      if (restaurant.is_active === false) {
        throw new Error('This store is currently closed and not accepting orders');
      }

      const address = await this.addressRepository.findById(addressId);
      if (!address || address.userId !== linkedCustomerId) {
        throw new Error('Selected address is invalid');
      }

      const branchId = await this.branchRepository.ensureMainBranchId(restaurantId);

      const hoursOk = await this.branchRepository.isBranchOpenNow(branchId);
      if (hoursOk === false) {
        throw new Error(
          'This store is closed right now. Please try again during open hours.',
        );
      }

      const deliveryCheck = await this.addressRepository.validateDelivery(
        addressId,
        branchId,
      );

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

      const computedSubtotal = Number(
        lineItems.reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2),
      );
      const safeSubtotal =
        Number.isFinite(computedSubtotal) && computedSubtotal > 0
          ? computedSubtotal
          : Number(subtotal);

      let serverDelivery = Number(deliveryCharge);
      let serverTaxRate = 0.05;
      try {
        const { data: quoted } = await this.supabaseClient.rpc(
          'quote_delivery_charge',
          { p_restaurant_id: restaurantId, p_subtotal: safeSubtotal },
        );
        if (quoted != null) serverDelivery = Number(quoted);
      } catch {
        // fallback to client deliveryCharge
      }
      try {
        const { data: rate } = await this.supabaseClient.rpc(
          'get_restaurant_tax_rate',
          { p_restaurant_id: restaurantId },
        );
        if (rate != null) serverTaxRate = Number(rate);
      } catch {
        // fallback
      }

      const safeDiscount = Math.max(0, Number(discountAmount) || 0);
      const safeDeliveryDiscount = Math.max(0, Number(deliveryDiscount) || 0);
      const payableDelivery = Math.max(serverDelivery - safeDeliveryDiscount, 0);
      const taxable = Math.max(safeSubtotal - safeDiscount, 0);
      const serverTax = Math.round(taxable * serverTaxRate);
      const serverGrand = Math.max(taxable + payableDelivery + serverTax, 0);

      const finalDelivery = Number.isFinite(serverDelivery)
        ? serverDelivery
        : Number(deliveryCharge);
      const finalTax = Number.isFinite(serverTax) ? serverTax : Number(taxAmount);
      const finalGrand = Number.isFinite(serverGrand)
        ? serverGrand
        : Number(grandTotal);

      let orderNumber = generateOrderNumber();
      try {
        const { data: seqNum } = await this.supabaseClient.rpc('next_order_number', {
          p_prefix: 'GN',
        });
        if (seqNum) orderNumber = seqNum;
      } catch {
        // migration not applied — keep client-generated number
      }

      const orderRow = {
        order_number: orderNumber,
        restaurant_id: restaurantId,
        branch_id: branchId,
        customer_id: linkedCustomerId,
        address_id: addressId,
        subtotal: safeSubtotal,
        discount_amount: 0,
        delivery_charge: finalDelivery,
        tax_amount: finalTax,
        grand_total: finalGrand + safeDiscount + safeDeliveryDiscount,
        payment_status: 'pending',
        order_status: 'placed',
        payment_method: 'cod',
        customer_notes: customerNotes || null,
        delivery_snapshot: deliveryCheck?.snapshot || null,
        delivery_distance_m:
          deliveryCheck?.distance_m != null
            ? Number(deliveryCheck.distance_m)
            : null,
      };

      const paymentRow = {
        transaction_id: `COD-${orderNumber}`,
        provider: 'cod',
        amount: finalGrand,
        currency: 'INR',
        status: 'pending',
      };

      return await this.orderRepository.createWithItems({
        orderRow,
        items: lineItems,
        paymentRow,
        couponCode,
      });
    } catch (err) {
      throw mapRlsError(err);
    }
  }
}
