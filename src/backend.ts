import http from "http";

type Order = {
    order_id: number;
    customer_id: number;
    status: string;
    amount: number;
    refunded: boolean;
    refund_amount?: number;
};

const orders: Record<number, Order> = {
    101: { order_id: 101, customer_id: 501, status: "Delayed", amount: 1200, refunded: false },
    102: { order_id: 102, customer_id: 502, status: "Delayed", amount: 8500, refunded: false },
    103: { order_id: 103, customer_id: 503, status: "Delayed", amount: 15000, refunded: false },
    104: { order_id: 104, customer_id: 504, status: "Delivered", amount: 1200, refunded: false },
    105: { order_id: 105, customer_id: 505, status: "Delayed", amount: 1000, refunded: false }
};

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
    const getOrderMatch = req.url?.match(/^\/orders\/(\d+)$/);
    const refundMatch = req.url?.match(/^\/orders\/(\d+)\/refund$/);

    if (req.method === "GET" && getOrderMatch) {
        const order = orders[Number(getOrderMatch[1])];

        if (!order) {
            sendJson(res, 404, { error: "Order not found" });
            return;
        }

        sendJson(res, 200, order);
        return;
    }

    if (req.method === "POST" && refundMatch) {
        const order = orders[Number(refundMatch[1])];

        if (!order) {
            sendJson(res, 404, { error: "Order not found" });
            return;
        }

        let body: unknown;

        try {
            body = await readJsonBody(req);
        } catch {
            sendJson(res, 400, { error: "Request body must be valid JSON" });
            return;
        }

        const amount =
            typeof body === "object" && body !== null && "amount" in body
                ? (body as { amount?: unknown }).amount
                : undefined;

        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            sendJson(res, 400, { error: "Refund amount must be greater than 0" });
            return;
        }

        if (amount > order.amount) {
            sendJson(res, 400, { error: "Refund amount cannot exceed the order amount" });
            return;
        }

        if (order.refunded) {
            sendJson(res, 409, { error: "Order has already been refunded" });
            return;
        }

        if (order.status !== "Delayed" && order.status !== "Cancelled") {
            sendJson(res, 400, { error: "Only Delayed or Cancelled orders are refundable" });
            return;
        }

        order.refunded = true;
        order.refund_amount = amount;

        sendJson(res, 200, order);
        return;
    }

    sendJson(res, 404, { error: "Route not found" });
});

server.listen(3000, () => {
    console.log("Order backend running on http://localhost:3000");
});
