export function computeProjectDays(
  planDuration: number,
  paymentType?: string,
  periodDuration?: number
): number {
  if (planDuration < 30) return planDuration;
  if (paymentType === "monthly" && periodDuration) return periodDuration * 30;
  if (paymentType === "yearly" && periodDuration) return periodDuration * 360;
  return planDuration;
}