import { createClient } from "@/lib/supabase";
import type {
  Order,
  Payment,
  CreateOrderRequest,
  CreateOrderResponse,
} from "@/lib/types/order";

class OrderService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Get the current session and add the access token to headers
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  /**
   * Create a new order
   */
  async createOrder(
    orderData: CreateOrderRequest
  ): Promise<CreateOrderResponse> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      return await response.json();
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Order[]> {
    try {
      const params = new URLSearchParams();

      if (options.limit) params.append("limit", options.limit.toString());
      if (options.offset) params.append("offset", options.offset.toString());

      const headers = await this.getHeaders();

      // Create an AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`/api/orders?${params.toString()}`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch orders");
      }

      const data = await response.json();
      return data.orders || [];
    } catch (error) {
      console.error("Error fetching orders:", error);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          "Request timeout - please check your connection and try again"
        );
      }

      throw error;
    }
  }

  /**
   * Get a specific order by ID
   */
  async getOrder(
    orderId: string
  ): Promise<{ order: Order; payments: Payment[] }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`/api/orders/${orderId}`, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch order");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  }

  /**
   * Update order notes
   */
  async updateOrder(
    orderId: string,
    updates: { notes?: string }
  ): Promise<Order> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update order");
      }

      const data = await response.json();
      return data.order;
    } catch (error) {
      console.error("Error updating order:", error);
      throw error;
    }
  }

  /**
   * Create a payment record
   */
  async createPayment(paymentData: {
    order_id: string;
    payment_reference: string;
    payment_method: string;
    gateway_provider: string;
    amount: number;
    currency?: string;
    gateway_response?: Record<string, any>;
  }): Promise<Payment> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch("/api/payments", {
        method: "POST",
        headers,
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create payment");
      }

      const data = await response.json();
      return data.payment;
    } catch (error) {
      console.error("Error creating payment:", error);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePayment(
    paymentId: string,
    updates: {
      status?: string;
      gateway_response?: Record<string, any>;
      failure_reason?: string;
      card_last_four?: string;
      card_brand?: string;
      card_type?: string;
      upi_id?: string;
      bank_name?: string;
      bank_reference?: string;
      notes?: string;
    }
  ): Promise<Payment> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update payment");
      }

      const data = await response.json();
      return data.payment;
    } catch (error) {
      console.error("Error updating payment:", error);
      throw error;
    }
  }

  /**
   * Get payments for an order
   */
  async getOrderPayments(orderId: string): Promise<Payment[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`/api/payments?order_id=${orderId}`, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch payments");
      }

      const data = await response.json();
      return data.payments;
    } catch (error) {
      console.error("Error fetching payments:", error);
      throw error;
    }
  }

  /**
   * Format order status for display
   */
  formatOrderStatus(status: string): string {
    const statusMap: Record<string, string> = {
      payment_pending: "Payment Pending",
      payment_confirmed: "Payment Confirmed",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
      refunded: "Refunded",
    };

    return statusMap[status] || status;
  }

  /**
   * Format payment status for display
   */
  formatPaymentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: "Pending",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      refunded: "Refunded",
      partially_refunded: "Partially Refunded",
    };

    return statusMap[status] || status;
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      payment_pending: "orange",
      payment_confirmed: "blue",
      processing: "blue",
      shipped: "purple",
      delivered: "green",
      cancelled: "red",
      refunded: "gray",
      pending: "orange",
      completed: "green",
      failed: "red",
    };

    return colorMap[status] || "gray";
  }
}

export const orderService = new OrderService();
