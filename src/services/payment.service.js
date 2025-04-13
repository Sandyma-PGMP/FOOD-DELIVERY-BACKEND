const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = {
  async generatePaymentLink(order) {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        success_url: `https://food-delivery-backend-9f2i.onrender.com/payment/success/${order._id}`,
        cancel_url: 'https://food-delivery-backend-9f2i.onrender.com/cancel',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(order.totalAmount * 100), 
              product_data: {
                name: 'Pizza Burger',
              },
            },
            quantity: 1,
          },
        ],
      });

      console.log('Session:', session);
      
      return { payment_url: session.url };
    } catch (error) {
      throw new Error(`Failed to generate payment link: ${error.message}`);
    }
  }
};
