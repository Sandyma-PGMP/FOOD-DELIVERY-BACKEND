const Address = require("../models/adress.model");
const Order = require("../models/order.model");
const Food=require("../models/food.model")
const OrderItem = require("../models/orderItem.model");
const Restaurant = require("../models/restaurant.model");
const cartService = require("./cart.service");
const paymentService = require("./payment.service");

module.exports = {
  async createOrder(order, user) {
    try {
      const address = order.deliveryAddress;
      console.log("Address:",address)
      let savedAddress;
      if (address._id) {
        const isAddressExist = await Address.findById(address._id);
        if (isAddressExist) {
          savedAddress = isAddressExist;
        } else {
          const shippingAddress = new Address(address);
          savedAddress = await shippingAddress.save();
        }
      }else {
        // New address without _id
        const shippingAddress = new Address(order.deliveryAddress);
        savedAddress = await shippingAddress.save();
      }

      if (!user.addresses.includes(savedAddress._id)) {
        user.addresses.push(savedAddress._id);
        await user.save();
      }

      const restaurant = await Restaurant.findById(order.restaurantId);
      if (!restaurant) {
        throw new Error(`Restaurant not found with ID ${order.restaurantId}`);
      }

      const cart = await cartService.findCartByUserId(user._id);

      if (!cart) {
        throw new Error("cart not found");
      }
      const orderItems = [];

      for (const cartItem of cart.items) {
        const food = await Food.findById(cartItem.food);
        if (!food) throw new Error(`Food item not found with ID: ${cartItem.food}`);
      
        const orderItem = new OrderItem({
          food: food._id,
          ingredients: cartItem.ingredients,
          quantity: cartItem.quantity,
          totalPrice: food.price * cartItem.quantity,
        });
        const savedOrderItem = await orderItem.save();
        orderItems.push(savedOrderItem._id);
      }
      

      const totalPrice = await cartService.calculateCartTotals(cart);

      console.log("Creating order with:", {
  customer: user._id,
  deliveryAddress: savedAddress._id,
  totalAmount: totalPrice,
  restaurant: restaurant._id,
  items: orderItems
});

      const createdOrder = new Order({
        customer: user._id,
        deliveryAddress: savedAddress._id,
        createdAt: new Date(),
        orderStatus: "PENDING",
        totalAmount: totalPrice,
        restaurant: restaurant._id,
        items: orderItems,
      });

      console.log("About to save order:", createdOrder);
      const savedOrder = await createdOrder.save();
      console.log("Saved order:", savedOrder);
      if (!savedOrder || !savedOrder._id) {
        console.error("Order not saved correctly:", savedOrder);
        throw new Error("Order not saved correctly");
      }

      restaurant.orders.push(savedOrder._id);
      await restaurant.save();

      const paymentResponse = await paymentService.generatePaymentLink(
        savedOrder
      );
      console.log(paymentResponse);
      return paymentResponse;
      // return savedOrder
    } catch (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }
  },

  async cancelOrder(orderId) {
    try {
      await Order.findByIdAndDelete(orderId);
    } catch (error) {
      throw new Error(
        `Failed to cancel order with ID ${orderId}: ${error.message}`
      );
    }
  },

  async findOrderById(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error(`Order not found with ID ${orderId}`);
      }
      return order;
    } catch (error) {
      throw new Error(
        `Failed to find order with ID ${orderId}: ${error.message}`
      );
    }
  },

  async getUserOrders(userId) {
    try {
      // Fetch orders for the given user ID
      const orders = await Order.find({ customer: userId })
        .populate({
          path: 'items',
          populate: {
            path: 'food',
            select: 'name price images'  // Only select specific fields from the food
          },
        });
        const order = await Order.findOne({ customer: userId })
           .populate({ path: 'items', populate: { path: 'food' } });

         console.log(JSON.stringify(order.items, null, 2));

  
      if (!orders || orders.length === 0) {
        throw new Error('No orders found for this user');
      }
  
      return orders;
    } catch (error) {
      // Log the error for debugging purposes
      console.error(`Failed to get orders for user ${userId}:`, error);
      throw new Error(`Failed to get user orders: ${error.message}`);
    }
  }
  ,

  async getOrdersOfRestaurant(restaurantId, orderStatus) {
    try {
      let orders = await Order.find({ restaurant: restaurantId }).populate([{
        path: "items",populate:{path:"food"}
      },'customer']);
      if (orderStatus) {
        orders = orders.filter((order) => order.orderStatus === orderStatus);
      }
      return orders;
    } catch (error) {
      throw new Error(
        `Failed to get orders of restaurant with ID ${restaurantId}: ${error.message}`
      );
    }
  },

  async updateOrder(orderId, orderStatus) {
    try {
      const validStatuses = [
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COMPLETED",
        "PENDING",
      ];
      if (!validStatuses.includes(orderStatus)) {
        throw new Error("Please select a valid order status");
      }

      const order = await Order.findById(orderId).populate({
        path: "items",populate:{path:"food"}
      });
      if (!order) {
        throw new Error(`Order not found with ID ${orderId}`);
      }

      order.orderStatus = orderStatus;
      await order.save();

      // Send notification
      // await NotificationService.sendOrderStatusNotification(order);

      return order;
    } catch (error) {
      throw new Error(
        `Failed to update order with ID ${orderId}: ${error.message}`
      );
    }
  },
};
