"use client";

import { useEffect } from "react";
import { markSeen } from "./actions";

// Opening the page counts as reading it; the list keeps its "new" dots until
// the next visit so you can still see what was new.
export function MarkSeen() {
  useEffect(() => {
    markSeen();
  }, []);
  return null;
}
