import {
    evaluateRefund,
    getRefundPolicy,
    type RefundDecision
} from "./policy.js";

export type Order = {
    order_id: number;
    customer_id: number;
    status: string;
    amount: number;
    refunded: boolean;
    refund_amount?: number;
};

export type Customer = {
    customer_id: number;
    name: string;
    tier: "Standard" | "Premium";
    fraud_flag: boolean;
    active: boolean;
};

export type RefundResult = RefundDecision & {
    external_write_executed: boolean;
    order?: Order;
};

export async function getOrder(orderId: number): Promise<Order> {
    return getJson<Order>(`http://localhost:3000/orders/${orderId}`, "Order");
}

export async function getCustomer(customerId: number): Promise<Customer> {
    return getJson<Customer>(
        `http://localhost:3001/customers/${customerId}`,
        "Customer"
    );
}

export async function requestRefund(
    orderId: number,
    reason: string
): Promise<RefundResult> {
    void reason;

    const order = await getOrder(orderId);
    const customer = await getCustomer(order.customer_id);
    const policy = await getRefundPolicy();
    const evaluation = evaluateRefund(order, customer, policy);

    if (evaluation.decision !== "ALLOW") {
        return {
            ...evaluation,
            external_write_executed: false
        };
    }

    const response = await fetch(
        `http://localhost:3000/orders/${orderId}/refund`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: order.amount })
        }
    );

    if (!response.ok) {
        throw new Error(`Refund API returned HTTP ${response.status}`);
    }

    return {
        ...evaluation,
        external_write_executed: true,
        order: await response.json() as Order
    };
}

async function getJson<T>(url: string, resourceName: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`${resourceName} API returned HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
}
