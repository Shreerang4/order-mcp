import http from "http";

const refundPolicy = {
    version: "2026-09-04.1",
    automatic_limit: 2000,
    manual_review_limit: 10000,
    eligible_statuses: ["Delayed", "Cancelled"],
    fraud_flag_action: "BLOCK"
};

const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && req.url === "/policies/refund") {
        res.statusCode = 200;
        res.end(JSON.stringify(refundPolicy));
        return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(3002, () => {
    console.log("Policy service running on http://localhost:3002");
});
