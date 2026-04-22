export function computeProjectDays(
  planDuration: number,
  paymentType?: string,
  periodDuration?: number,
): number {
  if (planDuration < 30) return planDuration;
  if (paymentType === "monthly" && periodDuration) return periodDuration * 30;
  if (paymentType === "yearly" && periodDuration) return periodDuration * 360;
  return planDuration;
}

export function computeProjectAmount(
  planPrice: number,
  paymentType?: string,
  periodDuration?: number,
): number {
  if (planPrice <= 0) return 0;
  if (paymentType === "monthly" && periodDuration)
    return planPrice * periodDuration;
  if (paymentType === "yearly" && periodDuration)
    return (planPrice * 12 * periodDuration) - (planPrice * 0.5);
  return planPrice;
}
