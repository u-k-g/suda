import { TabRecency } from "./tab_recency.js";

export function tabNoLongerExists(error) {
  return error?.message?.includes("No tab with id");
}

// Browser tab APIs necessarily race tabs being closed. Run an operation against a tab snapshot and
// ignore only that expected race; preserve every other failure.
export async function runTabOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!tabNoLongerExists(error)) throw error;
  }
}

// TODO(philc): tabRecency imports bg_utils. We should resovle the cycle for the sake of clarity.
export const tabRecency = new TabRecency();
tabRecency.init();
