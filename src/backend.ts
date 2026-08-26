import http from "http";

const orders: Record<number, string> = {
    101: "Shipped",
    102: "Delivered",
    103: "Cancelled"
};

const server = http.createServer((req, res) => {

    const match = req.url?.match(/^\/orders\/(\d+)$/);

    if (req.method === "GET" && match) {

        const orderId = Number(match[1]);
        const status = orders[orderId];

        res.setHeader("Content-Type", "application/json");

        if (!status) {
            res.statusCode = 404;

            res.end(
                JSON.stringify({
                    error: "Order not found"
                })
            );

            return;
        }

        res.statusCode = 200;

        res.end(
            JSON.stringify({
                order_id: orderId,
                status: status
            })
        );

        return;
    }

    res.statusCode = 404;

    res.end(
        JSON.stringify({
            error: "Route not found"
        })
    );
});


server.listen(3000, () => {
    console.log("Order backend running on http://localhost:3000");
});