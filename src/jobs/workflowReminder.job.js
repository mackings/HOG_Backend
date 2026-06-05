import OrderWorkflow from "../modules/customOrder/model/orderWorkflow.model.js";
import User from "../modules/user/model/user.model.js";
import { sendEmail } from "../utils/emailService.utils.js";

const ACTIVE_STATUSES = ["quote_received", "accepted", "not_started", "in_production", "ready", "shipped", "delayed"];
const DAY_MS = 24 * 60 * 60 * 1000;

const reminderLabel = (daysRemaining) => {
  if (daysRemaining <= 3) return "threeDays";
  if (daysRemaining <= 7) return "oneWeek";
  return null;
};

const reminderField = (label) => `reminderNotifications.${label === "threeDays" ? "threeDaysSentAt" : "oneWeekSentAt"}`;

const buildWorkflowReminderHtml = ({ designer, workflow, daysRemaining }) => `
  <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <h2>Production workflow reminder</h2>
    <p>Hello ${designer.fullName || "Designer"},</p>
    <p>
      This is a reminder that <strong>${workflow.workflowTitle || workflow.attireName || "a production workflow"}</strong>
      for <strong>${workflow.customerName || workflow.customerId?.fullName || "your customer"}</strong>
      is due in about <strong>${daysRemaining} day${daysRemaining === 1 ? "" : "s"}</strong>.
    </p>
    <p><strong>Status:</strong> ${workflow.currentStatus}</p>
    <p><strong>Completion date:</strong> ${new Date(workflow.estimatedCompletionDate).toDateString()}</p>
    ${workflow.productionNotes ? `<p><strong>Notes:</strong> ${workflow.productionNotes}</p>` : ""}
    <p>Please update the workflow status in Designer Studio if the production state has changed.</p>
  </div>
`;

const processWorkflowReminderBatch = async () => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * DAY_MS);

  const workflows = await OrderWorkflow.find({
    designerId: { $exists: true, $ne: null },
    estimatedCompletionDate: { $gte: now, $lte: sevenDaysFromNow },
    currentStatus: { $in: ACTIVE_STATUSES },
  })
    .populate("customerId", "fullName")
    .sort({ estimatedCompletionDate: 1 })
    .limit(50)
    .lean();

  for (const workflow of workflows) {
    const daysRemaining = Math.ceil((new Date(workflow.estimatedCompletionDate).getTime() - now.getTime()) / DAY_MS);
    const label = reminderLabel(daysRemaining);
    if (!label) continue;

    const field = reminderField(label);
    const alreadySent = label === "threeDays"
      ? workflow.reminderNotifications?.threeDaysSentAt
      : workflow.reminderNotifications?.oneWeekSentAt;
    if (alreadySent) continue;

    const designer = await User.findById(workflow.designerId).select("fullName email").lean();
    if (!designer?.email) continue;

    const result = await sendEmail({
      to: designer.email,
      subject: `Workflow reminder: ${workflow.workflowTitle || workflow.attireName || "Attire production"}`,
      htmlContent: buildWorkflowReminderHtml({ designer, workflow, daysRemaining }),
    });

    if (result.success) {
      await OrderWorkflow.findOneAndUpdate(
        { _id: workflow._id, [field]: { $exists: false } },
        { $set: { [field]: new Date() } }
      );
    }
  }
};

export const startWorkflowReminderJob = () => {
  const intervalMs = Number(process.env.WORKFLOW_REMINDER_INTERVAL_MS || 6 * 60 * 60 * 1000);
  setInterval(() => {
    processWorkflowReminderBatch().catch((error) => {
      console.error("❌ Workflow reminder job error:", error.message);
    });
  }, intervalMs);
};

