export type RefundPolicy = {
    version: string;
    automatic_limit: number;
    manual_review_limit: number;
    eligible_statuses: string[];
    fraud_flag_action: "BLOCK";
};

export type RefundDecision = {
    decision: "ALLOW" | "MANUAL_REVIEW" | "BLOCK";
    reason: string;
    policy_version: string;
};

type RefundOrder = {
    status: string;
    amount: number;
    refunded: boolean;
};

type RefundCustomer = {
    fraud_flag: boolean;
    active: boolean;
};

const POLICY_URL = "http://localhost:3002/policies/refund";
const POLICY_TTL_MS = 60_000;

let cachedPolicy: RefundPolicy | undefined;
let fetchedAt = 0;

export async function getRefundPolicy(): Promise<RefundPolicy> {
    if (cachedPolicy && Date.now() - fetchedAt < POLICY_TTL_MS) {
        return cachedPolicy;
    }

    try {
        const response = await fetch(POLICY_URL);

        if (!response.ok) {
            throw new Error(`Policy service returned HTTP ${response.status}`);
        }

        cachedPolicy = await response.json() as RefundPolicy;
        fetchedAt = Date.now();
        return cachedPolicy;
    } catch (error) {
        if (cachedPolicy) {
            return cachedPolicy;
        }

        throw new Error("Refund policy is unavailable; refund evaluation failed closed.", {
            cause: error
        });
    }
}

export async function getRefundPolicySummary(): Promise<string> {
    const policy = await getRefundPolicy();
    const eligibleStatuses = policy.eligible_statuses.join("/");

    return [
        `CURRENT REFUND POLICY (version ${policy.version}):`,
        "",
        `- ${eligibleStatuses} orders are eligible.`,
        `- Refund <= ₹${policy.automatic_limit} may be automated.`,
        `- Refund > ₹${policy.automatic_limit} and <= ₹${policy.manual_review_limit} requires MANUAL_REVIEW.`,
        `- Refund > ₹${policy.manual_review_limit} is BLOCKED.`,
        `- Fraud-flagged customers are ${policy.fraud_flag_action}.`,
        "- Inactive customers are BLOCKED."
    ].join("\n");
}

export function evaluateRefund(
    order: RefundOrder,
    customer: RefundCustomer,
    policy: RefundPolicy
): RefundDecision {
    if (!customer.active) {
        return block("Customer account is inactive.", policy);
    }

    if (customer.fraud_flag) {
        return block("Customer is blocked by the fraud flag.", policy);
    }

    if (order.refunded) {
        return block("Order has already been refunded.", policy);
    }

    if (!policy.eligible_statuses.includes(order.status)) {
        return block(`Order status ${order.status} is not eligible for a refund.`, policy);
    }

    if (order.amount <= policy.automatic_limit) {
        return {
            decision: "ALLOW",
            reason: "Refund is within the automatic approval limit.",
            policy_version: policy.version
        };
    }

    if (order.amount <= policy.manual_review_limit) {
        return {
            decision: "MANUAL_REVIEW",
            reason: "Human review is required because the refund exceeds the automatic limit.",
            policy_version: policy.version
        };
    }

    return block("Refund exceeds the manual review limit.", policy);
}

function block(reason: string, policy: RefundPolicy): RefundDecision {
    return {
        decision: "BLOCK",
        reason,
        policy_version: policy.version
    };
}
