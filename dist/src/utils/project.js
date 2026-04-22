"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeProjectDays = computeProjectDays;
exports.computeProjectAmount = computeProjectAmount;
function computeProjectDays(planDuration, paymentType, periodDuration) {
    if (planDuration < 30)
        return planDuration;
    if (paymentType === "monthly" && periodDuration)
        return periodDuration * 30;
    if (paymentType === "yearly" && periodDuration)
        return periodDuration * 360;
    return planDuration;
}
function computeProjectAmount(planPrice, paymentType, periodDuration) {
    if (planPrice <= 0)
        return 0;
    if (paymentType === "monthly" && periodDuration)
        return planPrice * periodDuration;
    if (paymentType === "yearly" && periodDuration)
        return (planPrice * 12 * periodDuration) - (planPrice * 0.5);
    return planPrice;
}
