import { Router } from "express";
import Stripe from "stripe";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const GRAND_FATHER_CUTOFF_ISO =
  process.env.SUBSCRIPTION_GRANDFATHER_CUTOFF || "2026-06-12T00:00:00.000Z";

type BillingPlan = "starter" | "pro" | "enterprise";
type BillingInterval = "monthly" | "yearly";
type BillingStatus =
  | "active"
  | "inactive"
  | "trialing"
  | "past_due"
  | "canceled"
  | "grandfathered";

const PRICE_ENV_MAP: Record<
  Exclude<BillingPlan, "enterprise">,
  Record<BillingInterval, string | undefined>
> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "price_1ThLdFPce3c8fWksNdoY5H7n",
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || "price_1ThLdFPce3c8fWksNdoY5H7n",
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_1ThLdfPce3c8fWksr9KuTuLb",
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "price_1ThLdfPce3c8fWksr9KuTuLb",
  },
};

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(secretKey);
}

import { getServerDb } from "../firebase.js";

function getDb() {
  return getServerDb();
}

function isGrandfatheredCreationTime(creationTime?: string | null) {
  if (!creationTime) return false;
  const created = Date.parse(creationTime);
  const cutoff = Date.parse(GRAND_FATHER_CUTOFF_ISO);
  if (Number.isNaN(created) || Number.isNaN(cutoff)) return false;
  return created < cutoff;
}

function defaultBillingState(creationTime?: string | null) {
  const grandfathered = isGrandfatheredCreationTime(creationTime);
  return {
    hasAccess: true,
    billingRequired: !grandfathered,
    subscriptionActive: grandfathered,
    subscriptionStatus: (grandfathered ? "grandfathered" : "inactive") as BillingStatus,
    subscriptionSource: grandfathered ? "grandfathered" : null,
    subscriptionGrandfathered: grandfathered,
    subscriptionPlan: null,
    subscriptionInterval: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionCurrentPeriodEnd: null,
    subscriptionCheckoutCompletedAt: null,
  };
}

function resolveSubscriptionCurrentPeriodEnd(subscription?: Stripe.Subscription | null) {
  const firstItem = subscription?.items?.data?.[0];
  return firstItem?.current_period_end || null;
}

function normalizeStripeStatus(status?: string | null): BillingStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "incomplete":
      return "canceled";
    default:
      return "inactive";
  }
}

function resolveAppBaseUrl(req: any) {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/+$/, "");
  }
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]
      : req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

async function findUidByStripeCustomerId(customerId: string) {
  const db = getDb();
  const snapshot = await getDocs(
    query(collection(db, "users"), where("stripeCustomerId", "==", customerId)),
  );
  return snapshot.empty ? null : snapshot.docs[0].id;
}

async function ensureUserDocument(uid: string, email?: string | null) {
  const db = getDb();
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const initialBilling = defaultBillingState(null);
    await setDoc(
      userRef,
      {
        email: email || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...initialBilling,
      },
      { merge: true },
    );
    return { ref: userRef, data: initialBilling };
  }

  const data = userSnap.data() || {};
  return { ref: userRef, data };
}

async function syncSubscriptionState(params: {
  uid: string;
  email?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  plan?: string | null;
  interval?: string | null;
  status?: string | null;
  currentPeriodEnd?: number | null;
  checkoutCompleted?: boolean;
}) {
  const { uid, email } = params;
  const { ref, data } = await ensureUserDocument(uid, email);
  const existingEmail = typeof (data as any).email === "string" ? (data as any).email : null;
  const normalizedStatus = normalizeStripeStatus(params.status);
  const isActive = normalizedStatus === "active" || normalizedStatus === "trialing";

  await setDoc(
    ref,
    {
      email: email || existingEmail,
      updatedAt: serverTimestamp(),
      hasAccess: data.hasAccess !== false,
      billingRequired: true,
      subscriptionActive: isActive,
      subscriptionStatus: normalizedStatus,
      subscriptionSource: "stripe",
      subscriptionGrandfathered: false,
      subscriptionPlan: params.plan || data.subscriptionPlan || null,
      subscriptionInterval: params.interval || data.subscriptionInterval || null,
      stripeCustomerId: params.customerId || data.stripeCustomerId || null,
      stripeSubscriptionId: params.subscriptionId || data.stripeSubscriptionId || null,
      subscriptionCurrentPeriodEnd: params.currentPeriodEnd
        ? new Date(params.currentPeriodEnd * 1000).toISOString()
        : data.subscriptionCurrentPeriodEnd || null,
      subscriptionCheckoutCompletedAt: params.checkoutCompleted
        ? new Date().toISOString()
        : data.subscriptionCheckoutCompletedAt || null,
    },
    { merge: true },
  );

  return {
    subscriptionActive: isActive,
    subscriptionStatus: normalizedStatus,
  };
}

async function syncFromStripeSession(sessionId: string) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });

  const uid = session.metadata?.uid || session.client_reference_id || null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

  const resolvedUid = uid || (customerId ? await findUidByStripeCustomerId(customerId) : null);
  if (!resolvedUid) {
    throw new Error("Unable to resolve RepairSync user for Stripe session.");
  }

  const result = await syncSubscriptionState({
    uid: resolvedUid,
    email: session.customer_details?.email || undefined,
    customerId,
    subscriptionId: subscription?.id || null,
    plan: session.metadata?.plan || subscription?.metadata?.plan || null,
    interval: session.metadata?.interval || subscription?.metadata?.interval || null,
    status: subscription?.status || "active",
    currentPeriodEnd: resolveSubscriptionCurrentPeriodEnd(subscription),
    checkoutCompleted: true,
  });

  return {
    uid: resolvedUid,
    customerId,
    subscriptionId: subscription?.id || null,
    ...result,
  };
}

export const billingRouter = Router();

billingRouter.post("/api/billing/checkout-session", async (req: any, res) => {
  try {
    const stripe = getStripeClient();
    const db = getDb();
    const uid = req.headers["x-user-id"] || req.body.uid;
    const email = req.headers["x-user-email"] || req.body.email || null;

    if (!uid || typeof uid !== "string") {
      return res.status(401).json({ error: "Authenticated user required." });
    }

    const plan = (req.body.plan || "pro") as BillingPlan;
    const interval = (req.body.interval || "yearly") as BillingInterval;
    if (plan === "enterprise") {
      return res.status(400).json({ error: "Enterprise checkout is configured as manual sales only." });
    }

    const priceId = PRICE_ENV_MAP[plan]?.[interval];
    
    if (!priceId) {
      return res.status(500).json({
        error: `Missing Stripe price configuration for ${plan} ${interval}.`,
      });
    }

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    let customerId = userData?.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: typeof email === "string" ? email : undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await setDoc(
        userRef,
        {
          email: typeof email === "string" ? email : null,
          createdAt: userSnap.exists() ? userData.createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...defaultBillingState(null),
          stripeCustomerId: customerId,
        },
        { merge: true },
      );
    }

    const baseUrl = resolveAppBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: uid,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        uid,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          uid,
          plan,
          interval,
        },
      },
      success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payments?plan=${plan}&interval=${interval}&canceled=1`,
    });

    await setDoc(
      userRef,
      {
        email: typeof email === "string" ? email : userData?.email || null,
        updatedAt: serverTimestamp(),
        billingRequired: true,
        subscriptionPlan: plan,
        subscriptionInterval: interval,
        stripeCustomerId: customerId,
        pendingStripeCheckoutSessionId: session.id,
      },
      { merge: true },
    );

    res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error("Stripe checkout session creation failed", error);
    res.status(500).json({ error: error.message || "Unable to create Stripe checkout session." });
  }
});

billingRouter.get("/api/billing/checkout-session/:sessionId", async (req, res) => {
  try {
    const result = await syncFromStripeSession(req.params.sessionId);
    res.json(result);
  } catch (error: any) {
    console.error("Stripe session sync failed", error);
    res.status(500).json({ error: error.message || "Unable to verify Stripe checkout session." });
  }
});

billingRouter.post("/api/billing/webhook", async (req: any, res) => {
  try {
    const stripe = getStripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
    }

    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return res.status(400).send("Missing Stripe signature");
    }

    const event = stripe.webhooks.constructEvent(req.body, signature, secret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.id) {
          await syncFromStripeSession(session.id);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id || null;
        const uid =
          subscription.metadata?.uid || (customerId ? await findUidByStripeCustomerId(customerId) : null);

        if (uid) {
          await syncSubscriptionState({
            uid,
            customerId,
            subscriptionId: subscription.id,
            plan: subscription.metadata?.plan || null,
            interval: subscription.metadata?.interval || null,
            status: subscription.status,
            currentPeriodEnd: resolveSubscriptionCurrentPeriodEnd(subscription),
          });
        }
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook processing failed", error);
    res.status(400).send(error.message || "Webhook error");
  }
});
