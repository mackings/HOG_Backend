import { getEffectivePlan, PLAN_ORDER } from "../modules/subscription/services/subscriptionPlan.service.js";

/**
 * Middleware factory that gates a route to designers (tailors) on a minimum plan.
 * Regular users (buyers) and admins always pass through unchecked.
 *
 * Sets req.effectivePlan and req.planRank for downstream use in controllers.
 *
 * Usage:
 *   router.post("/some-route", requirePlan("premium"), handler);
 */
export const requirePlan = (minPlan) => (req, res, next) => {
  const user = req.user;

  // Buyers and admins are not subject to designer plan restrictions
  if (["admin", "superAdmin", "user"].includes(user.role)) return next();

  const effectivePlan = getEffectivePlan(user);
  const userRank = PLAN_ORDER[effectivePlan] ?? 0;
  const requiredRank = PLAN_ORDER[minPlan] ?? 0;

  if (userRank < requiredRank) {
    const planLabel = minPlan.charAt(0).toUpperCase() + minPlan.slice(1);
    return res.status(403).json({
      success: false,
      message: `This feature is available on the ${planLabel} plan and above. Upgrade your subscription to access it.`,
      currentPlan: effectivePlan,
      requiredPlan: minPlan,
      upgradeRequired: true,
    });
  }

  req.effectivePlan = effectivePlan;
  req.planRank = userRank;
  next();
};
