const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const OrderItem = require('../models/orderItem.model');

module.exports = {
  async generatePaymentLink(order) {
    try {
      // Convert order items to Stripe line items
      const lineItems = await Promise.all(order.items.map(async (itemId) => {
        const orderItem = await OrderItem.findById(itemId).populate('food');
        return {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(orderItem.totalPrice * 100),
            product_data: {
              name: orderItem.food.name,
            },
          },
          quantity: orderItem.quantity,
        };
      }));

      if (!lineItems.length) {
        throw new Error('No valid items in the order');
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        success_url: `https://food-delivery-backend-9f2i.onrender.com/payment/success/${order._id}`,
        cancel_url: 'https://food-delivery-backend-9f2i.onrender.com/cancel',
        line_items: lineItems,
      });

      console.log('Session:', session);
      return { payment_url: session.url };
    } catch (error) {
      throw new Error(`Failed to generate payment link: ${error.message}`);
    }
  }
};

