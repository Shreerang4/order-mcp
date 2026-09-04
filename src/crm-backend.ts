import http from "http";

type Customer = {
    customer_id: number;
    name: string;
    tier: "Standard" | "Premium";
    fraud_flag: boolean;
    active: boolean;
};

const customers: Record<number, Customer> = {
    501: { customer_id: 501, name: "Customer 501", tier: "Standard", fraud_flag: false, active: true },
    502: { customer_id: 502, name: "Customer 502", tier: "Premium", fraud_flag: false, active: true },
    503: { customer_id: 503, name: "Customer 503", tier: "Premium", fraud_flag: false, active: true },
    504: { customer_id: 504, name: "Customer 504", tier: "Standard", fraud_flag: false, active: true },
    505: { customer_id: 505, name: "Customer 505", tier: "Standard", fraud_flag: true, active: true }
};

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
    const match = req.url?.match(/^\/customers\/(\d+)$/);

    if (req.method === "GET" && match) {
        const customer = customers[Number(match[1])];

        if (!customer) {
            sendJson(res, 404, { error: "Customer not found" });
            return;
        }

        sendJson(res, 200, customer);
        return;
    }

    sendJson(res, 404, { error: "Route not found" });
});

server.listen(3001, () => {
    console.log("CRM backend running on http://localhost:3001");
});
